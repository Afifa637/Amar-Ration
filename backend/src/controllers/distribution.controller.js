const mongoose = require("mongoose");

const Distributor = require("../models/Distributor");
const OMSCard = require("../models/OMSCard");
const Consumer = require("../models/Consumer");
const DistributionSession = require("../models/DistributionSession");
const Token = require("../models/Token");
const { rationQtyByCategory, makeTokenCode } = require("../services/token.service");
const { stockOut } = require("../services/stock.service");
const { writeAudit } = require("../services/audit.service");

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

  const created = await DistributionSession.create(
    [{ distributorId, dateKey, status: "Open" }],
    { session }
  );
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

  if (!valid.ok) {
    await writeAudit({
      actorUserId: userId,
      actorType: "Distributor",
      action: "QR_SCAN_REJECT",
      severity: "Warning",
      meta: { reason: valid.reason }
    });
    return res.status(400).json({ message: "QR Invalid বা মেয়াদোত্তীর্ণ" });
  }

  // find card -> consumer
  const card = await OMSCard.findOne({ qrCodeId: valid.qr._id }).lean();
  if (!card) return res.status(404).json({ message: "Card not found" });

  const consumer = await Consumer.findById(card.consumerId).lean();
  if (!consumer) return res.status(404).json({ message: "Consumer not found" });

  if (consumer.blacklistStatus !== "None") {
    await writeAudit({
      actorUserId: userId,
      actorType: "Distributor",
      action: "QR_SCAN_REJECT_BLACKLIST",
      entityType: "Consumer",
      entityId: String(consumer._id),
      severity: "Critical",
      meta: { consumer: consumer.consumerCode }
    });
    return res.status(400).json({ message: "উপকারভোগী ব্ল্যাকলিস্টেড" });
  }

  if (consumer.status !== "Active" || card.cardStatus !== "Active") {
    await writeAudit({
      actorUserId: userId,
      actorType: "Distributor",
      action: "QR_SCAN_REJECT_INACTIVE",
      entityType: "Consumer",
      entityId: String(consumer._id),
      severity: "Warning",
      meta: { consumer: consumer.consumerCode }
    });
    return res.status(400).json({ message: "উপকারভোগী/কার্ড Active নয়" });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const daySession = await getOrCreateSession(dist._id, session);

    // enforce one token/day per consumer per session via unique index (consumerId+sessionId)
    const rationQtyKg = rationQtyByCategory(consumer.category);

    // tokenCode generation retry loop (rare collision)
    let tokenDoc = null;
    for (let i = 0; i < 5; i++) {
      try {
        const created = await Token.create(
          [{
            tokenCode: makeTokenCode(),
            consumerId: consumer._id,
            distributorId: dist._id,
            sessionId: daySession._id,
            rationQtyKg,
            status: "Issued"
          }],
          { session }
        );
        tokenDoc = created[0];
        break;
      } catch (e) {
        // duplicate tokenCode or duplicate consumerId+sessionId
        if (e?.code === 11000) {
          // If consumer already has token today, return that token
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

    await writeAudit({
      actorUserId: userId,
      actorType: "Distributor",
      action: "TOKEN_ISSUED",
      entityType: "Token",
      entityId: String(tokenDoc._id),
      severity: "Info",
      meta: { token: tokenDoc.tokenCode, consumer: consumer.consumerCode }
    }, session);

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
    if (token.status !== "Issued") {
      await session.abortTransaction();
      return res.status(400).json({ message: "Token usable নয়" });
    }

    // settings threshold
    const setting = await SystemSetting.findOne({ key: "weightThresholdKg" }).session(session).lean();
    const maxDiff = setting?.value?.maxDiff ?? 0.05;

    const expected = Number(token.rationQtyKg);
    const actual = Number(actualKg);
    const mismatch = Math.abs(actual - expected) > Number(maxDiff);

    await DistributionRecord.create([{
      tokenId: token._id,
      expectedKg: expected,
      actualKg: actual,
      mismatch
    }], { session });

    token.status = "Used";
    token.usedAt = new Date();
    await token.save({ session });

    await stockOut({
      distributorId: dist._id,
      dateKey: todayKey(),
      qtyKg: actual,
      ref: token.tokenCode
    }, session);

    await writeAudit({
      actorUserId: userId,
      actorType: "Distributor",
      action: mismatch ? "WEIGHT_MISMATCH" : "DISTRIBUTION_SUCCESS",
      entityType: "Token",
      entityId: String(token._id),
      severity: mismatch ? "Critical" : "Info",
      meta: { token: token.tokenCode, expected, actual }
    }, session);

    await session.commitTransaction();
    return res.json({ ok: true, mismatch, expected, actual, maxDiff });
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    return res.status(500).json({ message: "Server Error" });
  } finally {
    session.endSession();
  }
}

module.exports = { scanAndIssueToken, completeDistribution };
