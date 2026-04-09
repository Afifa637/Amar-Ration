const mongoose = require("mongoose");

const crypto = require("crypto");
const QRCodeImage = require("qrcode");

const Distributor = require("../models/Distributor");
const Consumer = require("../models/Consumer");
const DistributionSession = require("../models/DistributionSession");
const StockLedger = require("../models/StockLedger");
const DistributionRecord = require("../models/DistributionRecord");
const OfflineQueue = require("../models/OfflineQueue");
const SystemSetting = require("../models/SystemSetting");
const Token = require("../models/Token");
const User = require("../models/User");
const Family = require("../models/Family");
const OMSCard = require("../models/OMSCard");
const QRCode = require("../models/QRCode");
const {
  rationQtyByCategory,
  makeTokenCode,
} = require("../services/token.service");
const { stockOut } = require("../services/stock.service");
const { writeAudit } = require("../services/audit.service");
const {
  notifyAdmins,
  notifyUser,
} = require("../services/notification.service");
const { checkDistributorMismatchCount } = require("../services/fraud.service");
const {
  normalizeWardNo,
  isSameWard: isSameWardScoped,
  buildWardMatchQuery,
} = require("../utils/ward.utils");
const {
  normalizeDivision,
  isSameDivision,
  buildDivisionMatchQuery,
} = require("../utils/division.utils");

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isSameDivisionScoped(distributor, consumer) {
  const d = normalizeDivision(distributor?.division);
  if (!d) return true;
  return isSameDivision(d, consumer?.division);
}

function isSameWard(distributor, consumer) {
  return isSameWardScoped(
    distributor?.wardNo || distributor?.ward,
    consumer?.ward || consumer?.wardNo,
  );
}

async function ensureDistributorProfile(reqUser) {
  let distributor = await Distributor.findOne({ userId: reqUser.userId });
  if (distributor) return distributor;

  const user = await User.findById(reqUser.userId).lean();
  if (
    !user ||
    (user.userType !== "Distributor" && user.userType !== "FieldUser")
  ) {
    return null;
  }

  distributor = await Distributor.create({
    userId: user._id,
    wardNo: normalizeWardNo(user.wardNo || user.ward),
    division: normalizeDivision(user.division),
    district: user.district,
    upazila: user.upazila,
    unionName: user.unionName,
    ward: normalizeWardNo(user.ward || user.wardNo),
    authorityStatus: user.authorityStatus || "Active",
    authorityFrom: user.authorityFrom || new Date(),
    authorityTo: user.authorityTo,
  });

  return distributor;
}

async function getOrCreateSession(
  distributorId,
  session,
  status = "Planned",
  dateKeyInput,
) {
  const dateKey = String(dateKeyInput || todayKey()).trim();
  const existing = await DistributionSession.findOne({
    distributorId,
    dateKey,
  }).session(session);
  if (existing) return existing;

  const created = await DistributionSession.create(
    [{ distributorId, dateKey, status }],
    { session },
  );
  return created[0];
}

// POST /api/distribution/session/create
async function createDistributionSession(req, res) {
  try {
    const distributor = await resolveDistributorScope(req);
    if (distributor === "NOT_FOUND") {
      return res
        .status(404)
        .json({ success: false, message: "Distributor not found" });
    }

    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    if (req.user.userType === "Admin" && !distributor) {
      return res.status(400).json({
        success: false,
        message: "distributorId is required for admin",
      });
    }

    const dateKey = String(req.body?.dateKey || todayKey()).trim();
    const scheduledStartAt = req.body?.scheduledStartAt
      ? new Date(req.body.scheduledStartAt)
      : undefined;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return res
        .status(400)
        .json({ success: false, message: "dateKey must be YYYY-MM-DD" });
    }

    if (scheduledStartAt && Number.isNaN(scheduledStartAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: "scheduledStartAt must be a valid datetime",
      });
    }

    const existing = await DistributionSession.findOne({
      distributorId: distributor._id,
      dateKey,
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Session already exists",
        data: { session: existing },
      });
    }

    const existingPlanned = await DistributionSession.findOne({
      distributorId: distributor._id,
      status: "Planned",
    }).lean();

    if (existingPlanned) {
      return res.status(409).json({
        success: false,
        message:
          "Only one planned session is allowed. Start or close the existing planned session first.",
        data: { session: existingPlanned },
      });
    }

    const sessionDoc = await DistributionSession.create({
      distributorId: distributor._id,
      dateKey,
      status: "Planned",
      scheduledStartAt,
    });

    await writeAudit({
      actorUserId: req.user.userId,
      actorType:
        req.user.userType === "Admin" ? "Central Admin" : "Distributor",
      action: "DISTRIBUTION_SESSION_PLANNED",
      entityType: "DistributionSession",
      entityId: String(sessionDoc._id),
      severity: "Info",
      meta: {
        dateKey,
        distributorId: String(distributor._id),
        scheduledStartAt: scheduledStartAt || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Distribution session planned",
      data: { session: sessionDoc },
    });
  } catch (error) {
    console.error("createDistributionSession error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// POST /api/distribution/session/start
async function startDistributionSession(req, res) {
  try {
    const distributor = await resolveDistributorScope(req);
    if (distributor === "NOT_FOUND") {
      return res
        .status(404)
        .json({ success: false, message: "Distributor not found" });
    }

    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    if (req.user.userType === "Admin" && !distributor) {
      return res.status(400).json({
        success: false,
        message: "distributorId is required for admin",
      });
    }

    const { sessionId } = req.body || {};
    const dateKeyInput = String(req.body?.dateKey || "").trim();

    let daySession = null;
    if (sessionId) {
      const byIdQuery = { _id: sessionId };
      if (distributor) byIdQuery.distributorId = distributor._id;
      daySession = await DistributionSession.findOne(byIdQuery);
    } else {
      const plannedQuery = {
        distributorId: distributor._id,
        status: "Planned",
      };
      if (dateKeyInput) plannedQuery.dateKey = dateKeyInput;

      daySession = await DistributionSession.findOne(plannedQuery).sort({
        dateKey: 1,
        createdAt: 1,
      });
    }

    if (!daySession) {
      return res.status(404).json({
        success: false,
        message: "No planned session found. Create planned session first",
      });
    }

    if (daySession.status === "Closed") {
      return res.status(400).json({
        success: false,
        message: "Distribution session is already closed",
      });
    }

    if (daySession.status === "Open") {
      return res.json({
        success: true,
        message: "Distribution session already open",
        data: { session: daySession },
      });
    }

    if (daySession.status !== "Planned") {
      return res.status(400).json({
        success: false,
        message: "Only planned session can be started",
      });
    }

    daySession.status = "Open";
    if (!daySession.openedAt) daySession.openedAt = new Date();
    await daySession.save();

    await writeAudit({
      actorUserId: req.user.userId,
      actorType:
        req.user.userType === "Admin" ? "Central Admin" : "Distributor",
      action: "DISTRIBUTION_SESSION_STARTED",
      entityType: "DistributionSession",
      entityId: String(daySession._id),
      severity: "Info",
      meta: {
        dateKey: daySession.dateKey,
        distributorId: String(daySession.distributorId),
      },
    });

    return res.json({
      success: true,
      message: "Distribution session started",
      data: { session: daySession },
    });
  } catch (error) {
    console.error("startDistributionSession error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function makeTokenQrPayload({
  tokenCode,
  consumerCode,
  dateKey,
  omsQrPayload,
}) {
  return `AR-TOKEN:${tokenCode}:${consumerCode || ""}:${dateKey || ""}:${omsQrPayload || ""}`;
}

function readTokenCodeFromQrPayload(payload) {
  const raw = String(payload || "").trim();
  if (!raw) return "";
  if (raw.startsWith("AR-TOKEN:")) {
    const [, tokenCode] = raw.split(":");
    return String(tokenCode || "").trim();
  }
  return "";
}

async function buildQrImageDataUrl(payload) {
  if (!payload) return "";
  try {
    return await QRCodeImage.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 256,
    });
  } catch {
    return "";
  }
}

async function resolveConsumerFromPayload(qrPayload) {
  const payload = String(qrPayload || "").trim();
  if (!payload) return { consumer: null, qr: null, card: null };

  const payloadHash = sha256(payload);
  const qr = await QRCode.findOne({
    $or: [{ payload }, { payloadHash }],
  }).lean();

  if (!qr) return { consumer: null, qr: null, card: null };

  const card = await OMSCard.findOne({ qrCodeId: qr._id }).lean();
  if (!card) return { consumer: null, qr, card: null };

  const consumer = await Consumer.findById(card.consumerId);
  return { consumer, qr, card };
}

async function resolveConsumerFromInput(input) {
  const raw = String(input || "").trim();
  if (!raw) return { consumer: null, qr: null, card: null };

  const byPayload = await resolveConsumerFromPayload(raw);
  if (byPayload.consumer && byPayload.card && byPayload.qr) {
    return byPayload;
  }

  const consumer = await Consumer.findOne({
    consumerCode: {
      $regex: `^${raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      $options: "i",
    },
  });
  if (!consumer) return { consumer: null, qr: null, card: null };

  const card = await OMSCard.findOne({ consumerId: consumer._id }).lean();
  const qr = card?.qrCodeId
    ? await QRCode.findById(card.qrCodeId).lean()
    : null;

  return { consumer, qr, card };
}

function parseThreshold(settingValue) {
  if (typeof settingValue === "number") return settingValue;
  if (settingValue && typeof settingValue.maxDiff === "number")
    return settingValue.maxDiff;
  return 1;
}

async function rotateOmsQrAfterSessionClose(consumerIds) {
  const ids = Array.from(
    new Set(
      (consumerIds || [])
        .filter(Boolean)
        .map((id) => String(id))
        .filter(Boolean),
    ),
  );
  if (!ids.length) return { rotated: 0, skipped: 0 };

  const globalSetting = await SystemSetting.findOne({
    key: "distributor:global:settings",
  }).lean();

  const autoRotation = globalSetting?.value?.qr?.autoRotation !== false;
  if (!autoRotation) {
    return { rotated: 0, skipped: ids.length };
  }

  const qrDays = Math.max(
    1,
    Number(globalSetting?.value?.qr?.expiryCycleDays || 30) || 30,
  );

  const [consumers, cards] = await Promise.all([
    Consumer.find({ _id: { $in: ids } })
      .select("_id status")
      .lean(),
    OMSCard.find({ consumerId: { $in: ids } })
      .select("_id consumerId qrCodeId")
      .lean(),
  ]);

  const consumerMap = new Map(
    consumers.map((item) => [String(item._id), item]),
  );
  let rotated = 0;

  for (const card of cards) {
    const consumerId = String(card.consumerId);
    const consumer = consumerMap.get(consumerId);
    if (!consumer) continue;

    if (card.qrCodeId) {
      await QRCode.findByIdAndUpdate(card.qrCodeId, { status: "Revoked" });
    }

    const qrToken = crypto.randomBytes(32).toString("hex");
    const now = new Date();
    const validTo = new Date(now.getTime() + qrDays * 86400000);
    const qrStatus = consumer.status === "Active" ? "Valid" : "Invalid";

    const newQr = await QRCode.create({
      payload: qrToken,
      payloadHash: sha256(qrToken),
      validFrom: now,
      validTo,
      status: qrStatus,
    });

    await Promise.all([
      OMSCard.findByIdAndUpdate(card._id, {
        $set: {
          qrCodeId: newQr._id,
          cardStatus: consumer.status === "Active" ? "Active" : "Inactive",
        },
      }),
      Consumer.findByIdAndUpdate(consumerId, { $set: { qrToken } }),
    ]);

    rotated += 1;
  }

  return { rotated, skipped: Math.max(0, ids.length - rotated) };
}

function buildTokenSearchQuery(search) {
  if (!search) return null;
  return {
    $or: [{ tokenCode: { $regex: search, $options: "i" } }],
  };
}

async function resolveDistributorScope(req) {
  if (req.user.userType === "Admin") {
    const distributorId = String(
      req.query.distributorId || req.body?.distributorId || "",
    ).trim();
    if (!distributorId) return null;
    const distributor = await Distributor.findById(distributorId).lean();
    if (!distributor) return "NOT_FOUND";
    return distributor;
  }

  return ensureDistributorProfile(req.user);
}

// POST /api/distribution/scan { qrPayload | consumerCode | consumerId | input }
async function scanAndIssueToken(req, res) {
  const userId = req.user.userId;
  const distributor = await ensureDistributorProfile(req.user);
  if (!distributor) {
    return res
      .status(403)
      .json({ success: false, message: "Distributor profile not found" });
  }

  const { qrPayload, consumerCode, consumerId, input } = req.body || {};
  const issueInput = String(
    qrPayload || consumerCode || consumerId || input || "",
  ).trim();

  if (!issueInput) {
    return res.status(400).json({
      success: false,
      message: "qrPayload/consumerCode/consumerId required",
    });
  }

  const { consumer, qr, card } = await resolveConsumerFromInput(issueInput);
  if (!qr || !card || !consumer) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid QR or consumer code" });
  }

  if (card.cardStatus !== "Active") {
    await writeAudit({
      actorUserId: userId,
      actorType: "Distributor",
      action: "QR_SCAN_REJECT_CARD_INACTIVE",
      entityType: "OMSCard",
      entityId: String(card._id),
      severity: "Warning",
      meta: { consumer: consumer.consumerCode, cardStatus: card.cardStatus },
    });

    return res.status(400).json({
      success: false,
      message: "OMS card is not active",
    });
  }

  if (qr.status !== "Valid") {
    await writeAudit({
      actorUserId: userId,
      actorType: "Distributor",
      action: "QR_SCAN_REJECT_QR_STATUS",
      entityType: "QRCode",
      entityId: String(qr._id),
      severity: "Warning",
      meta: { status: qr.status },
    });

    return res
      .status(400)
      .json({ success: false, message: "QR code is not valid" });
  }

  if (qr.validTo && new Date() > new Date(qr.validTo)) {
    await QRCode.findByIdAndUpdate(qr._id, { status: "Expired" });
    await writeAudit({
      actorUserId: userId,
      actorType: "Distributor",
      action: "QR_SCAN_REJECT_QR_EXPIRED",
      entityType: "QRCode",
      entityId: String(qr._id),
      severity: "Warning",
      meta: { validTo: qr.validTo },
    });

    return res
      .status(400)
      .json({ success: false, message: "QR code has expired" });
  }

  if (
    !isSameDivisionScoped(distributor, consumer) ||
    !isSameWard(distributor, consumer)
  ) {
    return res.status(403).json({
      success: false,
      message: "Consumer is outside your assigned division/ward",
    });
  }

  if (consumer.blacklistStatus !== "None") {
    await writeAudit({
      actorUserId: userId,
      actorType: "Distributor",
      action: "QR_SCAN_REJECT_BLACKLIST",
      entityType: "Consumer",
      entityId: String(consumer._id),
      severity: "Critical",
      meta: { consumer: consumer.consumerCode },
    });

    return res
      .status(400)
      .json({ success: false, message: "Beneficiary is blacklisted" });
  }

  if (consumer.familyId) {
    const family = await Family.findById(consumer.familyId).lean();
    if (family?.flaggedDuplicate) {
      await writeAudit({
        actorUserId: userId,
        actorType: "Distributor",
        action: "QR_SCAN_REJECT_FAMILY_DUPLICATE",
        entityType: "Family",
        entityId: String(consumer.familyId),
        severity: "Warning",
        meta: { consumer: consumer.consumerCode },
      });

      return res.status(400).json({
        success: false,
        message: "Family duplication detected; admin review required",
      });
    }
  }

  if (consumer.status !== "Active") {
    await writeAudit({
      actorUserId: userId,
      actorType: "Distributor",
      action: "QR_SCAN_REJECT_INACTIVE",
      entityType: "Consumer",
      entityId: String(consumer._id),
      severity: "Warning",
      meta: { consumer: consumer.consumerCode },
    });

    return res
      .status(400)
      .json({ success: false, message: "Beneficiary is not active" });
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const plannedSession = await DistributionSession.findOne({
      distributorId: distributor._id,
      status: "Planned",
    })
      .sort({ dateKey: 1, createdAt: 1 })
      .session(session);

    if (!plannedSession) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "No planned session available. Create planned session first",
      });
    }

    if (plannedSession.dateKey < todayKey()) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message:
          "Planned session date is in the past. Create a new planned session",
      });
    }

    const rationQtyKg = await rationQtyByCategory(consumer.category);

    let tokenDoc = null;

    for (let i = 0; i < 5; i += 1) {
      try {
        const tokenCode = makeTokenCode();
        const tokenQrPayload = makeTokenQrPayload({
          tokenCode,
          consumerCode: consumer.consumerCode,
          dateKey: plannedSession.dateKey,
          omsQrPayload: qr.payload,
        });
        const created = await Token.create(
          [
            {
              tokenCode,
              qrPayload: tokenQrPayload,
              qrPayloadHash: sha256(tokenQrPayload),
              sessionDateKey: plannedSession.dateKey,
              omsQrPayload: qr.payload,
              consumerId: consumer._id,
              distributorId: distributor._id,
              sessionId: plannedSession._id,
              rationQtyKg,
              status: "Issued",
            },
          ],
          { session },
        );

        tokenDoc = created[0];
        break;
      } catch (error) {
        if (error?.code !== 11000) throw error;

        const existing = await Token.findOne({
          consumerId: consumer._id,
          sessionId: plannedSession._id,
        }).session(session);

        if (existing) {
          await session.abortTransaction();

          return res.status(400).json({
            success: false,
            message: "Token already issued for today",
            data: { token: existing },
          });
        }
      }
    }

    if (!tokenDoc) throw new Error("Token creation failed");

    await writeAudit(
      {
        actorUserId: userId,
        actorType: "Distributor",
        action: "TOKEN_ISSUED",
        entityType: "Token",
        entityId: String(tokenDoc._id),
        severity: "Info",
        meta: { token: tokenDoc.tokenCode, consumer: consumer.consumerCode },
      },
      session,
    );

    await notifyUser(req.user.userId, {
      title: "Token issued",
      message: `Token ${tokenDoc.tokenCode} issued for ${consumer.consumerCode}.`,
      meta: { token: tokenDoc.tokenCode, consumer: consumer.consumerCode },
    });

    await session.commitTransaction();

    return res.json({
      success: true,
      message: "Token issued successfully",
      data: {
        token: tokenDoc,
        tokenQrPayload: tokenDoc.qrPayload,
        sessionDateKey: plannedSession.dateKey,
        omsQrPayload: qr.payload,
        consumer: {
          _id: consumer._id,
          consumerCode: consumer.consumerCode,
          name: consumer.name,
          ward: consumer.ward,
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("scanAndIssueToken error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    session.endSession();
  }
}

// POST /api/distribution/complete { tokenId|tokenCode|tokenQrPayload, actualKg }
async function completeDistribution(req, res) {
  const userId = req.user.userId;
  const distributor = await ensureDistributorProfile(req.user);
  if (!distributor) {
    return res
      .status(403)
      .json({ success: false, message: "Distributor profile not found" });
  }

  const { tokenId, tokenCode, tokenQrPayload, actualKg } = req.body;
  const parsedTokenCode = readTokenCodeFromQrPayload(tokenQrPayload);
  const effectiveTokenCode = String(tokenCode || parsedTokenCode || "").trim();

  if (
    (!tokenId && !effectiveTokenCode && !tokenQrPayload) ||
    actualKg === undefined
  ) {
    return res.status(400).json({
      success: false,
      message: "tokenId বা tokenCode বা tokenQrPayload এবং actualKg দিতে হবে",
    });
  }

  const actual = Number(actualKg);
  if (!Number.isFinite(actual) || actual <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "actualKg must be a positive number" });
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    let token = null;
    if (tokenId) {
      token = await Token.findById(tokenId).session(session);
    } else if (effectiveTokenCode) {
      token = await Token.findOne({ tokenCode: effectiveTokenCode }).session(
        session,
      );
    } else if (tokenQrPayload) {
      token = await Token.findOne({
        $or: [
          { qrPayload: String(tokenQrPayload).trim() },
          { qrPayloadHash: sha256(String(tokenQrPayload).trim()) },
        ],
      }).session(session);
    }
    if (!token) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "Token not found" });
    }

    if (String(token.distributorId) !== String(distributor._id)) {
      await session.abortTransaction();
      return res
        .status(403)
        .json({ success: false, message: "Token is outside your authority" });
    }

    if (token.status !== "Issued") {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ success: false, message: "Token is not in issued state" });
    }

    if (token.sessionId) {
      const tokenSession = await DistributionSession.findById(token.sessionId)
        .session(session)
        .select("status")
        .lean();
      if (!tokenSession || tokenSession.status !== "Open") {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Distribution session is not open",
        });
      }
    }

    const existingRecord = await DistributionRecord.findOne({
      tokenId: token._id,
    }).session(session);
    if (existingRecord) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ success: false, message: "Distribution already completed" });
    }

    const [globalSetting, legacySetting] = await Promise.all([
      SystemSetting.findOne({ key: "distributor:global:settings" })
        .session(session)
        .lean(),
      SystemSetting.findOne({ key: "weightThresholdKg" })
        .session(session)
        .lean(),
    ]);

    const maxDiff = Math.max(
      1,
      Number(
        globalSetting?.value?.distribution?.weightThresholdKg ??
          parseThreshold(legacySetting?.value),
      ) || 1,
    );

    const expected = Number(token.rationQtyKg);
    const mismatch = Math.abs(actual - expected) > maxDiff;

    await DistributionRecord.create(
      [
        {
          tokenId: token._id,
          expectedKg: expected,
          actualKg: actual,
          mismatch,
        },
      ],
      { session },
    );

    token.status = "Used";
    token.usedAt = new Date();
    await token.save({ session });

    await stockOut(
      {
        distributorId: distributor._id,
        dateKey: todayKey(),
        qtyKg: actual,
        ref: token.tokenCode,
      },
      session,
    );

    await writeAudit(
      {
        actorUserId: req.user.userId,
        actorType: "Distributor",
        action: mismatch ? "WEIGHT_MISMATCH" : "DISTRIBUTION_SUCCESS",
        entityType: "Token",
        entityId: String(token._id),
        severity: mismatch ? "Critical" : "Info",
        meta: { token: token.tokenCode, expected, actual },
      },
      session,
    );

    if (mismatch) {
      await notifyUser(req.user.userId, {
        title: "Weight mismatch alert",
        message: `Token ${token.tokenCode} mismatch: expected ${expected}kg, actual ${actual}kg.`,
        meta: { token: token.tokenCode, expected, actual },
      });

      await notifyAdmins({
        title: "Weight mismatch alert",
        message: `Token ${token.tokenCode} mismatch: expected ${expected}kg, actual ${actual}kg.`,
        meta: { token: token.tokenCode, expected, actual },
      });
    }

    await session.commitTransaction();

    let fraudCheck = null;
    if (mismatch) {
      fraudCheck = await checkDistributorMismatchCount(distributor._id);
    }

    return res.json({
      success: true,
      message: "Distribution completed",
      data: { mismatch, expected, actual, maxDiff, fraudCheck },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("completeDistribution error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    session.endSession();
  }
}

// GET /api/distribution/tokens
async function listTokens(req, res) {
  try {
    const { search, status, page = 1, limit = 20, withImage } = req.query;
    const includeImage = String(withImage || "false") === "true";
    const distributor =
      req.user.userType === "Admin"
        ? null
        : await ensureDistributorProfile(req.user);

    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const query = {};
    if (distributor) query.distributorId = distributor._id;
    if (status) query.status = status;

    const textQuery = buildTokenSearchQuery(search);
    if (textQuery) Object.assign(query, textQuery);

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(1000, Math.max(1, Number(limit) || 20));

    const [total, rawTokens] = await Promise.all([
      Token.countDocuments(query),
      Token.find(query)
        .populate("consumerId", "consumerCode name ward status")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
    ]);

    const tokens = includeImage
      ? await Promise.all(
          rawTokens.map(async (token) => ({
            ...token,
            qrImageDataUrl: await buildQrImageDataUrl(token.qrPayload),
          })),
        )
      : rawTokens;

    res.json({
      success: true,
      data: {
        tokens,
        pagination: {
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum),
          limit: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("listTokens error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// PATCH /api/distribution/tokens/:id/cancel
async function cancelToken(req, res) {
  try {
    const distributor =
      req.user.userType === "Admin"
        ? null
        : await ensureDistributorProfile(req.user);
    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const token = await Token.findById(req.params.id);
    if (!token) {
      return res
        .status(404)
        .json({ success: false, message: "Token not found" });
    }

    if (
      distributor &&
      String(token.distributorId) !== String(distributor._id)
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Token is outside your authority" });
    }

    if (token.status !== "Issued") {
      return res.status(400).json({
        success: false,
        message: "Only issued tokens can be cancelled",
      });
    }

    token.status = "Cancelled";
    await token.save();

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Distributor",
      action: "TOKEN_CANCELLED",
      entityType: "Token",
      entityId: String(token._id),
      severity: "Warning",
      meta: { token: token.tokenCode },
    });

    res.json({ success: true, message: "Token cancelled", data: { token } });
  } catch (error) {
    console.error("cancelToken error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// GET /api/distribution/records
async function getDistributionRecords(req, res) {
  try {
    const { search, mismatch, page = 1, limit = 20 } = req.query;
    const distributor =
      req.user.userType === "Admin"
        ? null
        : await ensureDistributorProfile(req.user);

    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const tokenQuery = {};
    if (distributor) tokenQuery.distributorId = distributor._id;

    if (search) {
      tokenQuery.tokenCode = { $regex: search, $options: "i" };
    }

    const tokenIds = await Token.find(tokenQuery).select("_id").lean();
    const ids = tokenIds.map((item) => item._id);

    const recordQuery = {
      tokenId: { $in: ids },
    };

    if (mismatch === "true") recordQuery.mismatch = true;
    if (mismatch === "false") recordQuery.mismatch = false;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(1000, Math.max(1, Number(limit) || 20));

    const [total, records] = await Promise.all([
      DistributionRecord.countDocuments(recordQuery),
      DistributionRecord.find(recordQuery)
        .populate({
          path: "tokenId",
          populate: {
            path: "consumerId",
            select: "consumerCode name ward",
          },
        })
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
    ]);

    const dateKey = todayKey();
    const stockQuery = { dateKey };
    if (distributor) stockQuery.distributorId = distributor._id;

    const stockEntries = await StockLedger.find(stockQuery).lean();
    const stockOutKg = stockEntries
      .filter((entry) => entry.type === "OUT")
      .reduce((sum, entry) => sum + Number(entry.qtyKg || 0), 0);

    res.json({
      success: true,
      data: {
        records,
        stock: {
          dateKey,
          stockOutKg,
        },
        pagination: {
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum),
          limit: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("getDistributionRecords error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// GET /api/distribution/stats
async function getDistributionStats(req, res) {
  try {
    const distributor =
      req.user.userType === "Admin"
        ? null
        : await ensureDistributorProfile(req.user);

    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const tokenQuery = {};
    if (distributor) tokenQuery.distributorId = distributor._id;

    const tokenIds = await Token.find(tokenQuery).select("_id status").lean();
    const idSet = tokenIds.map((item) => item._id);

    const [recordCount, mismatchCount, records] = await Promise.all([
      DistributionRecord.countDocuments({ tokenId: { $in: idSet } }),
      DistributionRecord.countDocuments({
        tokenId: { $in: idSet },
        mismatch: true,
      }),
      DistributionRecord.find({ tokenId: { $in: idSet } })
        .select("expectedKg actualKg")
        .lean(),
    ]);

    const expectedKg = records.reduce(
      (sum, item) => sum + Number(item.expectedKg || 0),
      0,
    );
    const actualKg = records.reduce(
      (sum, item) => sum + Number(item.actualKg || 0),
      0,
    );

    const stats = {
      totalTokens: tokenIds.length,
      issued: tokenIds.filter((item) => item.status === "Issued").length,
      used: tokenIds.filter((item) => item.status === "Used").length,
      cancelled: tokenIds.filter((item) => item.status === "Cancelled").length,
      mismatches: mismatchCount,
      completedRecords: recordCount,
      expectedKg: Number(expectedKg.toFixed(2)),
      actualKg: Number(actualKg.toFixed(2)),
    };

    res.json({ success: true, data: { stats } });
  } catch (error) {
    console.error("getDistributionStats error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// GET /api/distribution/quick-info
async function getDistributionQuickInfo(req, res) {
  try {
    const distributor =
      req.user.userType === "Admin"
        ? null
        : await ensureDistributorProfile(req.user);

    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const tokenScope = {};
    if (distributor) tokenScope.distributorId = distributor._id;

    const todayTokenQuery = {
      ...tokenScope,
      issuedAt: { $gte: startOfToday, $lt: endOfToday },
    };

    const [todayScans, pendingOffline, tokenIds] = await Promise.all([
      Token.countDocuments(todayTokenQuery),
      OfflineQueue.countDocuments({ ...tokenScope, status: "Pending" }),
      Token.find(tokenScope).select("_id").lean(),
    ]);

    const ids = tokenIds.map((item) => item._id);

    const mismatchQuery = {
      tokenId: { $in: ids },
      mismatch: true,
      createdAt: { $gte: startOfToday, $lt: endOfToday },
    };

    const mismatchCount = ids.length
      ? await DistributionRecord.countDocuments(mismatchQuery)
      : 0;

    res.json({
      success: true,
      data: {
        todayScans,
        mismatchCount,
        offlinePending: pendingOffline,
        systemStatus: "Online",
      },
    });
  } catch (error) {
    console.error("getDistributionQuickInfo error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// GET /api/distribution/sessions
async function listDistributionSessions(req, res) {
  try {
    const distributor = await resolveDistributorScope(req);
    if (distributor === "NOT_FOUND") {
      return res
        .status(404)
        .json({ success: false, message: "Distributor not found" });
    }

    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const { status, dateKey } = req.query;
    const inputDivision = String(req.query.division || "").trim();
    const inputWard = String(req.query.wardNo || req.query.ward || "").trim();
    const pageNum = Math.max(1, Number(req.query.page) || 1);
    const limitNum = Math.min(200, Math.max(1, Number(req.query.limit) || 20));

    const query = {};
    if (distributor) query.distributorId = distributor._id;
    if (status) query.status = status;
    if (dateKey) query.dateKey = String(dateKey);

    if (!distributor && (inputDivision || inputWard)) {
      const distributorQuery = {};

      if (inputDivision) {
        distributorQuery.division =
          buildDivisionMatchQuery(inputDivision) ||
          normalizeDivision(inputDivision);
      }

      if (inputWard) {
        const wardQuery = buildWardMatchQuery(inputWard, ["wardNo", "ward"]);
        if (wardQuery?.$or) {
          distributorQuery.$or = wardQuery.$or;
        }
      }

      const scopedDistributorIds = await Distributor.find(distributorQuery)
        .select("_id")
        .lean();
      const ids = scopedDistributorIds.map((row) => row._id);

      if (!ids.length) {
        return res.json({
          success: true,
          data: {
            sessions: [],
            pagination: {
              total: 0,
              page: pageNum,
              pages: 0,
              limit: limitNum,
            },
          },
        });
      }

      query.distributorId = { $in: ids };
    }

    const [total, sessions] = await Promise.all([
      DistributionSession.countDocuments(query),
      DistributionSession.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum),
          limit: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("listDistributionSessions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// POST /api/distribution/session/close
async function closeDistributionSession(req, res) {
  try {
    const distributor = await resolveDistributorScope(req);
    if (distributor === "NOT_FOUND") {
      return res
        .status(404)
        .json({ success: false, message: "Distributor not found" });
    }

    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const { sessionId, note } = req.body || {};
    const requestedDateKey = String(req.body?.dateKey || todayKey()).trim();

    let sessionQuery = null;
    if (sessionId) {
      sessionQuery = { _id: sessionId };
      if (distributor) sessionQuery.distributorId = distributor._id;
    } else {
      if (!distributor) {
        return res.status(400).json({
          success: false,
          message:
            "distributorId is required for admin when sessionId is not provided",
        });
      }
      sessionQuery = {
        distributorId: distributor._id,
        dateKey: requestedDateKey || todayKey(),
      };
    }

    const daySession = await DistributionSession.findOne(sessionQuery);
    if (!daySession) {
      return res.status(404).json({
        success: false,
        message: "Distribution session not found",
      });
    }

    if (daySession.status === "Planned") {
      return res.status(400).json({
        success: false,
        message: "Session is planned. Start session before close",
      });
    }

    const tokenDocs = await Token.find({ sessionId: daySession._id })
      .select("tokenCode rationQtyKg status consumerId")
      .lean();

    const usedTokens = tokenDocs.filter((t) => t.status === "Used");
    const issuedTokens = tokenDocs.filter((t) => t.status === "Issued");
    const usedTokenCodes = usedTokens.map((t) => t.tokenCode);

    const expectedUsedKg = usedTokens.reduce(
      (sum, token) => sum + Number(token.rationQtyKg || 0),
      0,
    );

    const expectedIssuedKg = tokenDocs.reduce(
      (sum, token) => sum + Number(token.rationQtyKg || 0),
      0,
    );

    const stockOutMatch = {
      distributorId: daySession.distributorId,
      dateKey: daySession.dateKey,
      type: "OUT",
    };
    if (usedTokenCodes.length) {
      stockOutMatch.ref = { $in: usedTokenCodes };
    }

    const stockOutAgg = await StockLedger.aggregate([
      { $match: stockOutMatch },
      { $group: { _id: null, totalKg: { $sum: "$qtyKg" } } },
    ]);

    const stockOutKg = Number(stockOutAgg[0]?.totalKg || 0);
    const mismatchKg = Number(Math.abs(expectedUsedKg - stockOutKg).toFixed(3));
    const isMismatch = mismatchKg > 0.001;

    daySession.status = "Closed";
    daySession.closedAt = new Date();
    await daySession.save();

    const qrRotation = await rotateOmsQrAfterSessionClose(
      tokenDocs.map((item) => item.consumerId),
    );

    await writeAudit({
      actorUserId: req.user.userId,
      actorType:
        req.user.userType === "Admin" ? "Central Admin" : "Distributor",
      action: isMismatch
        ? "DISTRIBUTION_SESSION_CLOSED_MISMATCH"
        : "DISTRIBUTION_SESSION_CLOSED",
      entityType: "DistributionSession",
      entityId: String(daySession._id),
      severity: isMismatch ? "Critical" : "Info",
      meta: {
        note: note || "",
        dateKey: daySession.dateKey,
        issuedTokens: tokenDocs.length,
        usedTokens: usedTokens.length,
        pendingTokens: issuedTokens.length,
        expectedUsedKg: Number(expectedUsedKg.toFixed(3)),
        expectedIssuedKg: Number(expectedIssuedKg.toFixed(3)),
        stockOutKg: Number(stockOutKg.toFixed(3)),
        mismatchKg,
        qrRotated: qrRotation.rotated,
        qrRotationSkipped: qrRotation.skipped,
      },
    });

    if (isMismatch) {
      await notifyAdmins({
        title: "Session reconciliation mismatch",
        message: `Session ${daySession.dateKey} mismatch ${mismatchKg}kg detected.`,
        meta: {
          sessionId: String(daySession._id),
          distributorId: String(daySession.distributorId),
          mismatchKg,
        },
      });
    }

    res.json({
      success: true,
      message: "Distribution session closed",
      data: {
        session: daySession,
        reconciliation: {
          issuedTokens: tokenDocs.length,
          usedTokens: usedTokens.length,
          pendingTokens: issuedTokens.length,
          expectedUsedKg: Number(expectedUsedKg.toFixed(3)),
          expectedIssuedKg: Number(expectedIssuedKg.toFixed(3)),
          stockOutKg: Number(stockOutKg.toFixed(3)),
          mismatch: isMismatch,
          mismatchKg,
          qrRotation,
        },
      },
    });
  } catch (error) {
    console.error("closeDistributionSession error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = {
  createDistributionSession,
  startDistributionSession,
  scanAndIssueToken,
  completeDistribution,
  listTokens,
  cancelToken,
  getDistributionRecords,
  getDistributionStats,
  getDistributionQuickInfo,
  listDistributionSessions,
  closeDistributionSession,
};
