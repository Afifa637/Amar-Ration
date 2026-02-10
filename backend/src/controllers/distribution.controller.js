const DistributionRecord = require("../models/DistributionRecord");
const StockLedger = require("../models/StockLedger"); // optional if you ever query; not required
const SystemSetting = require("../models/SystemSetting");
const { stockOut } = require("../services/stock.service");
const { writeAudit } = require("../services/audit.service");

const mongoose = require("mongoose");
const Distributor = require("../models/Distributor");
const OMSCard = require("../models/OMSCard");
const Consumer = require("../models/Consumer");
const DistributionSession = require("../models/DistributionSession");
const Token = require("../models/Token");
const { hashPayload, isQRCodeValidByHash } = require("../services/qr.service");
const { rationQtyByCategory, makeTokenCode } = require("../services/token.service");

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function getDistributorByUserId(userId) {
  return Distributor.findOne({ userId }).lean();
}

async function getOrCreateSession(distributorId, session) {
  const dateKey = todayKey();
  const existing = await DistributionSession.findOne({ distributorId, dateKey }).session(session);
  if (existing) return existing;

  const created = await DistributionSession.create([{ distributorId, dateKey, status: "Open" }], { session });
  return created[0];
}

// POST /api/distribution/scan { qrPayload }
async function scanAndIssueToken(req, res) {
  const userId = req.user.id;
  const dist = await getDistributorByUserId(userId);
  if (!dist) return res.status(403).json({ message: "Distributor profile not found" });

  const { qrPayload } = req.body;
  if (!qrPayload) return res.status(400).json({ message: "qrPayload required" });

  const payloadHash = hashPayload(qrPayload);
  const valid = await isQRCodeValidByHash(payloadHash);

  if (!valid.ok) return res.status(400).json({ message: "QR Invalid বা মেয়াদোত্তীর্ণ" });

  const card = await OMSCard.findOne({ qrCodeId: valid.qr._id }).lean();
  if (!card) return res.status(404).json({ message: "Card not found" });

  const consumer = await Consumer.findById(card.consumerId).lean();
  if (!consumer) return res.status(404).json({ message: "Consumer not found" });

  if (consumer.blacklistStatus !== "None") return res.status(400).json({ message: "উপকারভোগী ব্ল্যাকলিস্টেড" });
  if (consumer.status !== "Active" || card.cardStatus !== "Active")
    return res.status(400).json({ message: "উপকারভোগী/কার্ড Active নয়" });

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const daySession = await getOrCreateSession(dist._id, session);
    const rationQtyKg = rationQtyByCategory(consumer.category);

    let tokenDoc = null;
    for (let i = 0; i < 5; i++) {
      try {
        const created = await Token.create([{
          tokenCode: makeTokenCode(),
          consumerId: consumer._id,
          distributorId: dist._id,
          sessionId: daySession._id,
          rationQtyKg,
          status: "Issued"
        }], { session });

        tokenDoc = created[0];
        break;
      } catch (e) {
        if (e?.code === 11000) {
          const existing = await Token.findOne({ consumerId: consumer._id, sessionId: daySession._id }).session(session);
          if (existing) {
            await session.abortTransaction();
            return res.status(400).json({ message: "আজকের জন্য ইতিমধ্যে টোকেন আছে", token: existing });
          }
          continue;
        }
        throw e;
      }
    }

    if (!tokenDoc) throw new Error("Token creation failed");

    await session.commitTransaction();
    return res.json({ ok: true, token: tokenDoc });
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    return res.status(500).json({ message: "Server Error" });
  } finally {
    session.endSession();
  }
}

// POST /api/distribution/complete { tokenCode, actualKg }
async function completeDistribution(req, res) {
  const userId = req.user.id;
  const dist = await getDistributorByUserId(userId);
  if (!dist) return res.status(403).json({ message: "Distributor profile not found" });

  const { tokenCode, actualKg } = req.body;
  if (!tokenCode || actualKg === undefined) {
    return res.status(400).json({ message: "tokenCode, actualKg required" });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const token = await Token.findOne({ tokenCode }).session(session);
    if (!token) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Token not found" });
    }

    // Distributor safety: token must belong to same distributor
    if (String(token.distributorId) !== String(dist._id)) {
      await session.abortTransaction();
      return res.status(403).json({ message: "Forbidden: token অন্য ডিলারের" });
    }

    if (token.status !== "Issued") {
      await session.abortTransaction();
      return res.status(400).json({ message: "Token usable নয়" });
    }

    // Settings: default maxDiff = 0.05kg
    const setting = await SystemSetting.findOne({ key: "weightThresholdKg" }).session(session).lean();
    const maxDiff = Number(setting?.value?.maxDiff ?? 0.05);

    const expected = Number(token.rationQtyKg);
    const actual = Number(actualKg);

    if (Number.isNaN(actual) || actual <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: "actualKg invalid" });
    }

    const mismatch = Math.abs(actual - expected) > maxDiff;

    // Record distribution (1:1 token)
    await DistributionRecord.create(
      [{ tokenId: token._id, expectedKg: expected, actualKg: actual, mismatch }],
      { session }
    );

    // Mark token used
    token.status = "Used";
    token.usedAt = new Date();
    await token.save({ session });

    // Stock OUT ledger (immutable)
    await stockOut(
      { distributorId: dist._id, dateKey: todayKey(), qtyKg: actual, ref: token.tokenCode },
      session
    );

    // Audit event
    await writeAudit(
      {
        actorUserId: userId,
        actorType: "Distributor",
        action: mismatch ? "WEIGHT_MISMATCH" : "DISTRIBUTION_SUCCESS",
        entityType: "Token",
        entityId: String(token._id),
        severity: mismatch ? "Critical" : "Info",
        meta: { token: token.tokenCode, expected, actual, maxDiff }
      },
      session
    );

    await session.commitTransaction();
    return res.json({ ok: true, mismatch, expected, actual, maxDiff });
  } catch (err) {
    await session.abortTransaction();

    // duplicate distribution record safety
    if (err?.code === 11000) {
      return res.status(400).json({ message: "Already completed (duplicate token record)" });
    }

    console.error(err);
    return res.status(500).json({ message: "Server Error" });
  } finally {
    session.endSession();
  }
}

module.exports = { scanAndIssueToken, completeDistribution };

