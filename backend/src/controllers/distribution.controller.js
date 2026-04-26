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
const SmsOutbox = require("../models/SmsOutbox");
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
  sendDistributionSms,
  sendMismatchSms,
} = require("../services/sms.service");
const {
  generateReceipt,
  generateReconciliationReport,
} = require("../services/receipt.service");
const {
  mapSingleItemQty,
  normalizeQtyByItem,
  hydrateRecordItemFields,
} = require("../services/distributionRecord.service");
const { makeSessionCode } = require("../services/sessionCode.service");
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
const {
  buildArQrPayload,
  verifyArQrPayload,
  isArQrPayload,
  normalizeArWard,
  normalizeArCategory,
} = require("../utils/qr-payload.utils");
const {
  STOCK_ITEMS,
  normalizeStockItem,
} = require("../utils/stock-items.utils");

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function getItemBalanceKg({ distributorId, dateKey, item, session }) {
  const normalizedItem = normalizeStockItem(item);
  if (!normalizedItem) {
    const error = new Error("Invalid stock item");
    error.code = "INVALID_STOCK_ITEM";
    throw error;
  }

  const query = {
    distributorId,
    dateKey,
    item: normalizedItem,
  };
  const entries = await StockLedger.find(query)
    .session(session)
    .select("type qtyKg")
    .lean();

  return entries.reduce((sum, entry) => {
    const qty = Number(entry.qtyKg || 0);
    if (entry.type === "IN") return sum + qty;
    if (entry.type === "OUT") return sum - qty;
    if (entry.type === "ADJUST") return sum + qty;
    return sum;
  }, 0);
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

  // FieldUsers are not distributors themselves — find the real distributor
  // for their ward+division so their session lookup works correctly.
  if (user.userType === "FieldUser") {
    const ward = normalizeWardNo(user.wardNo || user.ward);
    const division = normalizeDivision(user.division);
    if (ward && division) {
      distributor = await Distributor.findOne({ division, wardNo: ward });
      if (distributor) return distributor;
    }
    return null;
  }

  // Distributor users: auto-create profile if missing
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
    const requestedRationItem = req.body?.rationItem;
    const rationItem =
      req.user.userType === "Admin"
        ? requestedRationItem
          ? normalizeStockItem(requestedRationItem)
          : "চাল"
        : "চাল";

    if (!rationItem) {
      return res.status(400).json({
        success: false,
        message: "Invalid ration item",
        code: "VALIDATION_ERROR",
      });
    }
    const scheduledStartAt =
      req.user.userType === "Admin" && req.body?.scheduledStartAt
        ? new Date(req.body.scheduledStartAt)
        : undefined;
    const plannedAllocationByItem =
      req.body?.plannedAllocationByItem &&
      typeof req.body.plannedAllocationByItem === "object"
        ? normalizeQtyByItem(req.body.plannedAllocationByItem)
        : mapSingleItemQty(rationItem, Number(req.body?.plannedQtyKg || 0));

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
        data: {
          session: {
            ...existing.toObject(),
            sessionCode: makeSessionCode(existing),
          },
        },
      });
    }

    const sessionDoc = await DistributionSession.create({
      distributorId: distributor._id,
      dateKey,
      rationItem,
      plannedAllocationByItem,
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
        rationItem,
        plannedAllocationByItem,
        distributorId: String(distributor._id),
        scheduledStartAt: scheduledStartAt || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Distribution session planned",
      data: {
        session: {
          ...sessionDoc.toObject(),
          sessionCode: makeSessionCode(sessionDoc),
        },
      },
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
        data: {
          session: {
            ...daySession.toObject(),
            sessionCode: makeSessionCode(daySession),
          },
        },
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
      data: {
        session: {
          ...daySession.toObject(),
          sessionCode: makeSessionCode(daySession),
        },
      },
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

  const verified = verifyArQrPayload(payload);
  if (!verified.valid || !verified.parsed) {
    return {
      consumer: null,
      qr: null,
      card: null,
      reason:
        verified.reason === "AR_QR_EXPIRED"
          ? "QR_EXPIRED_BY_DATE"
          : "INVALID_AR_QR",
    };
  }

  const structured = verified.parsed;

  const consumer = await Consumer.findOne({
    consumerCode: {
      $regex: `^${String(structured.consumerCode).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      $options: "i",
    },
  });
  if (!consumer) {
    return {
      consumer: null,
      qr: null,
      card: null,
      reason: "CONSUMER_NOT_FOUND",
    };
  }

  const consumerWard = normalizeArWard(consumer.ward || consumer.wardNo || "");
  const consumerCategory = normalizeArCategory(consumer.category || "");
  if (
    consumerWard !== structured.ward ||
    consumerCategory !== structured.category
  ) {
    return {
      consumer: null,
      qr: null,
      card: null,
      reason: "QR_FIELD_MISMATCH",
    };
  }

  const card = await OMSCard.findOne({ consumerId: consumer._id }).lean();
  if (!card?.qrCodeId) {
    return {
      consumer: null,
      qr: null,
      card: null,
      reason: "CARD_NOT_FOUND",
    };
  }

  const qr = await QRCode.findById(card.qrCodeId).lean();
  if (!qr) {
    return {
      consumer: null,
      qr: null,
      card: null,
      reason: "QR_NOT_FOUND",
    };
  }

  const payloadHash = sha256(payload);
  const isCurrentPayload =
    String(qr.payload || "") === payload ||
    String(qr.payloadHash || "") === payloadHash;
  if (!isCurrentPayload) {
    return {
      consumer: null,
      qr: null,
      card: null,
      reason: "QR_NOT_CURRENT",
    };
  }

  return { consumer, qr, card, parsed: structured };
}

async function resolveConsumerFromInput(input) {
  const raw = String(input || "").trim();
  if (!raw) return { consumer: null, qr: null, card: null };

  if (isArQrPayload(raw)) {
    return resolveConsumerFromPayload(raw);
  }

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
      .select("_id status consumerCode ward wardNo category")
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

    const now = new Date();
    const validTo = new Date(now.getTime() + qrDays * 86400000);
    const qrStatus = consumer.status === "Active" ? "Valid" : "Invalid";
    const qrToken = buildArQrPayload({
      consumerCode: consumer.consumerCode,
      ward: consumer.ward || consumer.wardNo,
      category: consumer.category,
      expiryDate: validTo,
    });

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

  const { consumer, qr, card, reason } =
    await resolveConsumerFromInput(issueInput);
  if (!qr || !card || !consumer) {
    if (reason === "INVALID_AR_QR") {
      return res.status(400).json({
        success: false,
        message: "Invalid AR card QR format/signature",
        code: "INVALID_AR_QR",
      });
    }
    if (reason === "QR_EXPIRED_BY_DATE") {
      return res.status(400).json({
        success: false,
        message: "AR card QR has expired",
        code: "AR_QR_EXPIRED",
      });
    }
    if (reason === "QR_FIELD_MISMATCH") {
      return res.status(400).json({
        success: false,
        message: "AR card fields mismatch with consumer profile",
        code: "AR_QR_FIELD_MISMATCH",
      });
    }
    if (reason === "QR_NOT_CURRENT") {
      return res.status(400).json({
        success: false,
        message: "AR card QR is not current. Use the latest rotated card",
        code: "AR_QR_NOT_CURRENT",
      });
    }
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
      message: "AR ration card is not active",
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

    // Accept an Open session (active today) or a Planned session (upcoming).
    // Open sessions are created/started by admin from the web dashboard;
    // Planned sessions are pre-scheduled. Prefer Open over Planned.
    const activeSession =
      (await DistributionSession.findOne({
        distributorId: distributor._id,
        status: "Open",
        dateKey: todayKey(),
      }).session(session)) ||
      (await DistributionSession.findOne({
        distributorId: distributor._id,
        status: "Planned",
        dateKey: { $gte: todayKey() },
      })
        .sort({ dateKey: 1, createdAt: 1 })
        .session(session));

    if (!activeSession) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "কোনো সক্রিয় বিতরণ সেশন নেই। আগে সেশন শুরু করুন।",
        code: "NO_ACTIVE_SESSION",
      });
    }

    const rationQtyKg = await rationQtyByCategory(consumer.category);

    let tokenDoc = null;

    const plannedRationItem = normalizeStockItem(activeSession.rationItem);
    if (!plannedRationItem) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid planned ration item",
        code: "VALIDATION_ERROR",
      });
    }

    for (let i = 0; i < 5; i += 1) {
      try {
        const tokenCode = makeTokenCode();
        const tokenQrPayload = makeTokenQrPayload({
          tokenCode,
          consumerCode: consumer.consumerCode,
          dateKey: activeSession.dateKey,
          omsQrPayload: qr.payload,
        });
        const created = await Token.create(
          [
            {
              tokenCode,
              qrPayload: tokenQrPayload,
              qrPayloadHash: sha256(tokenQrPayload),
              sessionDateKey: activeSession.dateKey,
              omsQrPayload: qr.payload,
              consumerId: consumer._id,
              distributorId: distributor._id,
              sessionId: activeSession._id,
              rationItem: plannedRationItem,
              rationQtyKg,
              entitlementByItem: mapSingleItemQty(
                plannedRationItem,
                rationQtyKg,
              ),
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
          sessionId: activeSession._id,
        }).session(session);

        if (existing) {
          await session.abortTransaction();

          return res.status(409).json({
            success: false,
            message: "এই গ্রাহককে আজ ইতিমধ্যে রেশন দেওয়া হয়েছে।",
            code: "ALREADY_ISSUED",
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
        meta: {
          token: tokenDoc.tokenCode,
          consumer: consumer.consumerCode,
          rationItem: tokenDoc.rationItem,
        },
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
        sessionDateKey: activeSession.dateKey,
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
  if (!Number.isFinite(actual) || !Number.isInteger(actual) || actual <= 0) {
    return res.status(400).json({
      success: false,
      message: "actualKg must be a positive integer in 1kg step",
    });
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

    let tokenSession = null;
    if (token.sessionId) {
      tokenSession = await DistributionSession.findById(token.sessionId)
        .session(session)
        .select("status dateKey")
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

    const itemName = normalizeStockItem(token.rationItem);
    if (!itemName) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid token ration item",
        code: "VALIDATION_ERROR",
      });
    }
    const stockDateKey =
      tokenSession?.dateKey || token.sessionDateKey || todayKey();
    const currentBalanceKg = await getItemBalanceKg({
      distributorId: distributor._id,
      dateKey: stockDateKey,
      item: itemName,
      session,
    });
    if (actual > currentBalanceKg) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: `${itemName} মজুদ অপর্যাপ্ত। বর্তমান ব্যালেন্স ${Number(currentBalanceKg.toFixed(3))}kg`,
      });
    }

    const [globalSetting, legacySetting, consumer] = await Promise.all([
      SystemSetting.findOne({ key: "distributor:global:settings" })
        .session(session)
        .lean(),
      SystemSetting.findOne({ key: "weightThresholdKg" })
        .session(session)
        .lean(),
      Consumer.findById(token.consumerId)
        .session(session)
        .select("consumerCode category guardianPhone guardianName name")
        .lean(),
    ]);

    const rawThreshold = Number(
      globalSetting?.value?.distribution?.weightThresholdPercent ??
        globalSetting?.value?.distribution?.weightThresholdKg ??
        parseThreshold(legacySetting?.value) ??
        0.05,
    );
    const autoPauseOnMismatch =
      globalSetting?.value?.distribution?.autoPauseOnMismatch !== false;
    const thresholdPercent = Math.max(
      0.01,
      Number.isFinite(rawThreshold)
        ? rawThreshold > 1
          ? rawThreshold / 100
          : rawThreshold
        : 0.05,
    );

    const expected = Number(token.rationQtyKg);
    const maxDiff = Math.max(0.05, expected * thresholdPercent);
    const mismatch = Math.abs(actual - expected) > maxDiff;
    const { expectedByItem, actualByItem, mismatchDetails } =
      hydrateRecordItemFields({
        item: itemName,
        expectedKg: expected,
        actualKg: actual,
      });

    const thresholdDetails = {
      expected,
      actual,
      maxDiff: Number(maxDiff.toFixed(3)),
      thresholdPercent: Number((thresholdPercent * 100).toFixed(1)),
      category: consumer?.category || "Unknown",
      item: itemName,
    };

    await DistributionRecord.create(
      [
        {
          tokenId: token._id,
          distributorId: distributor._id,
          sessionId: token.sessionId || null,
          item: itemName,
          expectedKg: expected,
          actualKg: actual,
          expectedByItem,
          actualByItem,
          mismatchDetails,
          mismatch,
        },
      ],
      { session },
    );

    token.status = "Used";
    token.usedAt = new Date();
    token.iotVerified = false;
    await token.save({ session });

    await stockOut(
      {
        distributorId: distributor._id,
        dateKey: stockDateKey,
        qtyKg: actual,
        ref: token.tokenCode,
        item: itemName,
      },
      session,
    );

    if (token.sessionId) {
      await DistributionSession.findByIdAndUpdate(
        token.sessionId,
        {
          $inc: {
            [`distributedByItem.${itemName}`]: Number(actual || 0),
          },
        },
        { session },
      );
    }

    await writeAudit(
      {
        actorUserId: req.user.userId,
        actorType: "Distributor",
        action: mismatch ? "WEIGHT_MISMATCH" : "DISTRIBUTION_SUCCESS",
        entityType: "Token",
        entityId: String(token._id),
        severity: mismatch ? "Critical" : "Info",
        meta: {
          token: token.tokenCode,
          consumer: consumer?.consumerCode,
          ...thresholdDetails,
        },
      },
      session,
    );

    if (mismatch && autoPauseOnMismatch && token.sessionId) {
      await DistributionSession.findByIdAndUpdate(
        token.sessionId,
        { $set: { status: "Paused" } },
        { session },
      );
    }

    if (mismatch) {
      await notifyUser(req.user.userId, {
        title: "Weight mismatch alert",
        message: `Token ${token.tokenCode} mismatch: expected ${expected}kg, actual ${actual}kg.`,
        meta: {
          token: token.tokenCode,
          consumer: consumer?.consumerCode,
          ...thresholdDetails,
        },
      });

      await notifyAdmins({
        title: "Weight mismatch alert",
        message: `Token ${token.tokenCode} mismatch: expected ${expected}kg, actual ${actual}kg.`,
        meta: {
          token: token.tokenCode,
          consumer: consumer?.consumerCode,
          ...thresholdDetails,
        },
      });
    }

    await session.commitTransaction();
    if (mismatch) {
      void sendMismatchSms(
        {
          _id: token.consumerId,
          guardianPhone: consumer?.guardianPhone,
          phone: consumer?.guardianPhone,
        },
        token.tokenCode,
        expected,
        actual,
      );
    } else {
      void sendDistributionSms(
        {
          _id: token.consumerId,
          guardianPhone: consumer?.guardianPhone,
          phone: consumer?.guardianPhone,
        },
        token.tokenCode,
        actual,
        itemName,
      );
      setImmediate(() => {
        generateReceipt(token._id).catch((err) =>
          console.error(
            "generateReceipt distribution complete error:",
            err?.message || err,
          ),
        );
      });
    }

    let fraudCheck = null;
    if (mismatch) {
      fraudCheck = await checkDistributorMismatchCount(distributor._id);
    }

    return res.json({
      success: true,
      message: "Distribution completed",
      data: {
        mismatch,
        item: itemName,
        expected,
        actual,
        expectedByItem,
        actualByItem,
        mismatchDetails,
        maxDiff: Number(maxDiff.toFixed(3)),
        thresholdPercent: Number((thresholdPercent * 100).toFixed(1)),
        fraudCheck,
      },
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
    const {
      search,
      status,
      sessionId,
      page = 1,
      limit = 20,
      withImage,
    } = req.query;
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
    if (sessionId) query.sessionId = String(sessionId);

    const textQuery = buildTokenSearchQuery(search);
    if (textQuery) Object.assign(query, textQuery);

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(1000, Math.max(1, Number(limit) || 20));

    const [total, rawTokens] = await Promise.all([
      Token.countDocuments(query),
      Token.find(query)
        .populate("consumerId", "consumerCode name ward wardNo division status")
        .populate("sessionId", "_id dateKey status")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
    ]);

    const tokenIds = rawTokens.map((t) => t._id);
    const records = await DistributionRecord.find({
      tokenId: { $in: tokenIds },
    })
      .select(
        "tokenId expectedKg actualKg mismatch expectedByItem actualByItem mismatchDetails item",
      )
      .lean();
    const recordMap = new Map(records.map((r) => [String(r.tokenId), r]));

    const tokens = await Promise.all(
      rawTokens.map(async (token) => {
        const tokenRecord = recordMap.get(String(token._id));
        const { expectedByItem, actualByItem, mismatchDetails } =
          hydrateRecordItemFields({
            item: tokenRecord?.item || token.rationItem,
            expectedKg: tokenRecord
              ? Number(tokenRecord.expectedKg || token.rationQtyKg || 0)
              : Number(token.rationQtyKg || 0),
            actualKg: tokenRecord ? Number(tokenRecord.actualKg || 0) : 0,
            expectedByItem: tokenRecord?.expectedByItem,
            actualByItem: tokenRecord?.actualByItem,
          });

        const row = {
          ...token,
          sessionId: token.sessionId ? String(token.sessionId._id) : null,
          sessionCode: makeSessionCode(token.sessionId),
          session: token.sessionId
            ? {
                id: String(token.sessionId._id),
                dateKey: token.sessionId.dateKey,
                status: token.sessionId.status,
                sessionCode: makeSessionCode(token.sessionId),
              }
            : null,
          expectedByItem,
          actualByItem,
          mismatch: Boolean(tokenRecord?.mismatch),
          mismatchDetails:
            tokenRecord?.mismatchDetails?.length > 0
              ? tokenRecord.mismatchDetails
              : mismatchDetails,
          expectedKg: tokenRecord
            ? Number(tokenRecord.expectedKg || 0)
            : Number(token.rationQtyKg || 0),
          actualKg: tokenRecord ? Number(tokenRecord.actualKg || 0) : 0,
          division:
            (typeof token.consumerId === "object" &&
              token.consumerId?.division) ||
            distributor?.division ||
            "",
          ward:
            (typeof token.consumerId === "object" &&
              (token.consumerId?.ward || token.consumerId?.wardNo)) ||
            distributor?.wardNo ||
            distributor?.ward ||
            "",
        };

        if (!includeImage) return row;
        return {
          ...row,
          qrImageDataUrl: await buildQrImageDataUrl(token.qrPayload),
        };
      }),
    );

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
    const { search, mismatch, sessionId, page = 1, limit = 20 } = req.query;
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
    if (sessionId) tokenQuery.sessionId = String(sessionId);

    if (search) {
      tokenQuery.tokenCode = { $regex: search, $options: "i" };
    }

    const tokenIds = await Token.find(tokenQuery)
      .select("_id sessionId rationItem rationQtyKg distributorId")
      .lean();
    const ids = tokenIds.map((item) => item._id);
    const tokenMap = new Map(tokenIds.map((row) => [String(row._id), row]));

    const sessionIds = Array.from(
      new Set(
        tokenIds.map((row) => String(row.sessionId || "")).filter(Boolean),
      ),
    );
    const sessionRows = await DistributionSession.find({
      _id: { $in: sessionIds },
    })
      .select("_id dateKey status")
      .lean();
    const sessionMap = new Map(sessionRows.map((s) => [String(s._id), s]));

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
          select:
            "_id tokenCode sessionId rationItem rationQtyKg distributorId",
          populate: {
            path: "consumerId",
            select: "consumerCode name ward wardNo division",
          },
        })
        .select(
          "tokenId expectedKg actualKg mismatch expectedByItem actualByItem mismatchDetails item createdAt updatedAt distributorId sessionId",
        )
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
    ]);

    const enrichedRecords = records.map((record) => {
      const token =
        typeof record.tokenId === "object"
          ? record.tokenId
          : tokenMap.get(String(record.tokenId));
      const session = token?.sessionId
        ? sessionMap.get(String(token.sessionId))
        : null;

      const { item, expectedByItem, actualByItem, mismatchDetails } =
        hydrateRecordItemFields({
          item: record.item || token?.rationItem,
          expectedKg: record.expectedKg,
          actualKg: record.actualKg,
          expectedByItem: record.expectedByItem,
          actualByItem: record.actualByItem,
        });

      return {
        ...record,
        sessionId: token?.sessionId ? String(token.sessionId) : null,
        sessionCode: makeSessionCode({
          _id: token?.sessionId,
          dateKey: session?.dateKey,
        }),
        dateKey: session?.dateKey || null,
        item,
        expectedByItem,
        actualByItem,
        mismatchDetails: record.mismatch
          ? record.mismatchDetails?.length
            ? record.mismatchDetails
            : mismatchDetails
          : [],
        division:
          (token?.consumerId && token.consumerId.division) ||
          distributor?.division ||
          "",
        ward:
          (token?.consumerId &&
            (token.consumerId.ward || token.consumerId.wardNo)) ||
          distributor?.wardNo ||
          distributor?.ward ||
          "",
      };
    });

    let dateKey = todayKey();
    if (sessionId) {
      const scopedSession = await DistributionSession.findById(
        String(sessionId),
      )
        .select("dateKey")
        .lean();
      if (scopedSession?.dateKey) dateKey = scopedSession.dateKey;
    }
    const stockQuery = { dateKey };
    if (distributor) stockQuery.distributorId = distributor._id;

    const stockEntries = await StockLedger.find(stockQuery).lean();
    const stockOutKg = stockEntries
      .filter((entry) => entry.type === "OUT")
      .reduce((sum, entry) => sum + Number(entry.qtyKg || 0), 0);

    const stockOutByItem = STOCK_ITEMS.reduce((acc, item) => {
      acc[item] = 0;
      return acc;
    }, {});

    stockEntries.forEach((entry) => {
      if (entry.type !== "OUT") return;
      const item = normalizeStockItem(entry.item);
      if (!item) return;
      stockOutByItem[item] += Number(entry.qtyKg || 0);
    });

    res.json({
      success: true,
      data: {
        records: enrichedRecords,
        stock: {
          dateKey,
          stockOutKg,
          byItem: stockOutByItem,
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
    const sessionId = String(req.query.sessionId || "").trim();
    if (distributor) tokenQuery.distributorId = distributor._id;
    if (sessionId) tokenQuery.sessionId = sessionId;

    const tokenIds = await Token.find(tokenQuery)
      .select("_id status rationItem")
      .lean();
    const idSet = tokenIds.map((item) => item._id);
    const tokenMap = new Map(tokenIds.map((t) => [String(t._id), t]));

    const [recordCount, mismatchCount, records] = await Promise.all([
      DistributionRecord.countDocuments({ tokenId: { $in: idSet } }),
      DistributionRecord.countDocuments({
        tokenId: { $in: idSet },
        mismatch: true,
      }),
      DistributionRecord.find({ tokenId: { $in: idSet } })
        .select(
          "tokenId expectedKg actualKg mismatch expectedByItem actualByItem item",
        )
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

    const byItem = STOCK_ITEMS.reduce((acc, item) => {
      acc[item] = {
        expectedKg: 0,
        actualKg: 0,
        mismatchCount: 0,
      };
      return acc;
    }, {});

    records.forEach((record) => {
      const token = tokenMap.get(String(record.tokenId));
      const hydrated = hydrateRecordItemFields({
        item: record.item || token?.rationItem,
        expectedKg: record.expectedKg,
        actualKg: record.actualKg,
        expectedByItem: record.expectedByItem,
        actualByItem: record.actualByItem,
      });

      for (const item of STOCK_ITEMS) {
        byItem[item].expectedKg += Number(hydrated.expectedByItem[item] || 0);
        byItem[item].actualKg += Number(hydrated.actualByItem[item] || 0);
      }

      if (record.mismatch && byItem[hydrated.item]) {
        byItem[hydrated.item].mismatchCount += 1;
      }
    });

    STOCK_ITEMS.forEach((item) => {
      byItem[item].expectedKg = Number(byItem[item].expectedKg.toFixed(3));
      byItem[item].actualKg = Number(byItem[item].actualKg.toFixed(3));
    });

    const stats = {
      totalTokens: tokenIds.length,
      issued: tokenIds.filter((item) => item.status === "Issued").length,
      used: tokenIds.filter((item) => item.status === "Used").length,
      cancelled: tokenIds.filter((item) => item.status === "Cancelled").length,
      mismatches: mismatchCount,
      completedRecords: recordCount,
      expectedKg: Number(expectedKg.toFixed(2)),
      actualKg: Number(actualKg.toFixed(2)),
      byItem,
      totals: {
        expectedKg: Number(expectedKg.toFixed(2)),
        actualKg: Number(actualKg.toFixed(2)),
        label: "Derived grand total from item-wise records",
      },
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

    if (!distributor && inputWard && !inputDivision) {
      return res.status(400).json({
        success: false,
        message: "ওয়ার্ড ফিল্টার ব্যবহার করতে বিভাগ একসাথে দিতে হবে",
        code: "VALIDATION_ERROR",
      });
    }

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

    const distributorIds = Array.from(
      new Set(
        sessions.map((s) => String(s.distributorId || "")).filter(Boolean),
      ),
    );

    const distributors = distributorIds.length
      ? await Distributor.find({ _id: { $in: distributorIds } })
          .select("_id division wardNo ward")
          .lean()
      : [];
    const distributorMap = new Map(distributors.map((d) => [String(d._id), d]));

    const sessionRows = sessions.map((session) => {
      const owner = distributorMap.get(String(session.distributorId || ""));
      return {
        ...session,
        sessionId: String(session._id),
        sessionCode: makeSessionCode(session),
        division: owner?.division || distributor?.division || "",
        ward:
          owner?.wardNo ||
          owner?.ward ||
          distributor?.wardNo ||
          distributor?.ward ||
          "",
      };
    });

    res.json({
      success: true,
      data: {
        sessions: sessionRows,
        context: {
          distributorId: distributor ? String(distributor._id) : null,
          division: distributor?.division || "",
          ward: distributor?.wardNo || distributor?.ward || "",
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

    const expectedUsedByItem = STOCK_ITEMS.reduce((acc, item) => {
      acc[item] = 0;
      return acc;
    }, {});

    usedTokens.forEach((token) => {
      const item = normalizeStockItem(token.rationItem);
      if (!item) return;
      expectedUsedByItem[item] += Number(token.rationQtyKg || 0);
    });

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

    const stockOutByItemAgg = await StockLedger.aggregate([
      { $match: stockOutMatch },
      { $group: { _id: "$item", totalKg: { $sum: "$qtyKg" } } },
    ]);

    const stockOutByItem = STOCK_ITEMS.reduce((acc, item) => {
      acc[item] = 0;
      return acc;
    }, {});
    stockOutByItemAgg.forEach((row) => {
      const item = normalizeStockItem(row._id);
      if (!item) return;
      stockOutByItem[item] = Number(Number(row.totalKg || 0).toFixed(3));
    });

    const byItem = STOCK_ITEMS.reduce((acc, item) => {
      const expectedKg = Number(
        Number(expectedUsedByItem[item] || 0).toFixed(3),
      );
      const actualKg = Number(Number(stockOutByItem[item] || 0).toFixed(3));
      const diffKg = Number((actualKg - expectedKg).toFixed(3));
      acc[item] = {
        expectedKg,
        actualKg,
        diffKg,
        mismatch: Math.abs(diffKg) > 0.001,
      };
      return acc;
    }, {});

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
        sessionCode: makeSessionCode(daySession),
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

    setImmediate(() => {
      generateReconciliationReport(daySession._id).catch((err) =>
        console.error(
          "generateReconciliationReport auto error:",
          err?.message || err,
        ),
      );
    });

    res.json({
      success: true,
      message: "Distribution session closed",
      data: {
        session: daySession,
        reconciliation: {
          sessionId: String(daySession._id),
          sessionCode: makeSessionCode(daySession),
          issuedTokens: tokenDocs.length,
          usedTokens: usedTokens.length,
          pendingTokens: issuedTokens.length,
          expectedUsedKg: Number(expectedUsedKg.toFixed(3)),
          expectedIssuedKg: Number(expectedIssuedKg.toFixed(3)),
          stockOutKg: Number(stockOutKg.toFixed(3)),
          mismatch: isMismatch,
          mismatchKg,
          byItem,
          qrRotation,
        },
      },
    });
  } catch (error) {
    console.error("closeDistributionSession error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

/**
 * GET /api/field/consumer-preview?qrPayload=...
 * Returns consumer info, card status, QR status, and active session
 * availability WITHOUT issuing any token. Used by Flutter app to show
 * a clean preview after scanning.
 */
async function consumerPreview(req, res) {
  try {
    const qrPayload = String(req.query.qrPayload || "").trim();
    if (!qrPayload) {
      return res.status(400).json({ success: false, message: "qrPayload required" });
    }

    const { consumer, qr, card, reason } = await resolveConsumerFromInput(qrPayload);

    if (!consumer) {
      const msgMap = {
        INVALID_AR_QR: "অবৈধ QR ফরম্যাট",
        QR_EXPIRED_BY_DATE: "QR এর মেয়াদ শেষ",
        QR_FIELD_MISMATCH: "QR তথ্য মিলছে না",
        QR_NOT_CURRENT: "QR সর্বশেষ আপডেট নয়",
      };
      return res.status(404).json({
        success: false,
        message: msgMap[reason] || "গ্রাহক পাওয়া যায়নি",
        code: reason || "NOT_FOUND",
      });
    }

    // Resolve session status: find any Open/Planned session whose distributor
    // covers the consumer's ward+division. Uses multiple fallback strategies.
    let sessionStatus = "none"; // "none" | "planned" | "open"
    let distributorForSession = null;
    let strategyUsed = "none";

    const cWard = normalizeWardNo(consumer.ward || "");
    const cDivision = normalizeDivision(consumer.division || "");

    console.log(`[consumerPreview] consumer=${consumer.consumerCode} ward_raw="${consumer.ward}" div_raw="${consumer.division}" cWard="${cWard}" cDivision="${cDivision}"`);

    // Collect ALL distributor IDs that match the consumer's ward+division.
    // We need ALL because some Distributor docs may have English division names
    // (e.g. "Khulna") instead of normalized Bangla ("খুলনা") if they were
    // created outside of Mongoose save hooks (seed scripts, admin inserts).
    const candidateDistributorIds = new Set();

    if (cWard && cDivision) {
      // Pass 1: exact normalized string match
      const exactMatches = await Distributor.find({
        $or: [
          { division: cDivision, wardNo: cWard },
          { division: cDivision, ward: cWard },
        ],
      })
        .select("_id")
        .lean();
      exactMatches.forEach((d) => candidateDistributorIds.add(String(d._id)));

      // Pass 2: regex alias match — catches English variants like "Khulna"
      const wardQuery = buildWardMatchQuery(cWard, ["wardNo", "ward"]);
      const divisionQuery = buildDivisionMatchQuery(cDivision);
      if (wardQuery && divisionQuery) {
        const aliasMatches = await Distributor.find({
          division: { $in: divisionQuery.$in },
          $or: wardQuery.$or,
        })
          .select("_id")
          .lean();
        aliasMatches.forEach((d) => candidateDistributorIds.add(String(d._id)));
      }
    }

    console.log(`[consumerPreview] candidate distributorIds: [${[...candidateDistributorIds].join(", ")}]`);

    // Find an active session for ANY of the candidate distributors
    if (candidateDistributorIds.size > 0) {
      const activeSession = await DistributionSession.findOne({
        distributorId: { $in: [...candidateDistributorIds].map((id) => new mongoose.Types.ObjectId(id)) },
        status: { $in: ["Open", "Planned"] },
      })
        .select("status dateKey distributorId")
        .lean();
      if (activeSession) {
        distributorForSession = { _id: activeSession.distributorId };
        sessionStatus = activeSession.status === "Open" ? "open" : "planned";
        strategyUsed = "1-candidate-scan";
        console.log(`[consumerPreview] found session dateKey="${activeSession.dateKey}" status="${activeSession.status}" via strategy 1`);
      }
    }

    // Strategy 2: fall back to the FieldUser's own linked distributor profile
    if (!distributorForSession) {
      const fuDist = await ensureDistributorProfile(req.user);
      if (fuDist) {
        const fuSession = await DistributionSession.findOne({
          distributorId: fuDist._id,
          status: { $in: ["Open", "Planned"] },
        })
          .select("status dateKey")
          .lean();
        if (fuSession) {
          distributorForSession = fuDist;
          sessionStatus = fuSession.status === "Open" ? "open" : "planned";
          strategyUsed = "2-fielduser";
          console.log(`[consumerPreview] found session via fielduser distributor dateKey="${fuSession.dateKey}"`);
        }
      }
    }

    // Strategy 3: scan all open sessions and match their distributor by normalized ward+div
    if (!distributorForSession && cWard && cDivision) {
      const openSessions = await DistributionSession.find({
        status: { $in: ["Open", "Planned"] },
      })
        .select("distributorId status dateKey")
        .lean();

      for (const sess of openSessions) {
        const dist = await Distributor.findById(sess.distributorId)
          .select("_id wardNo ward division")
          .lean();
        if (!dist) continue;
        const dWard = normalizeWardNo(dist.wardNo || dist.ward || "");
        const dDiv = normalizeDivision(dist.division || "");
        if (dWard === cWard && dDiv === cDivision) {
          distributorForSession = dist;
          sessionStatus = sess.status === "Open" ? "open" : "planned";
          strategyUsed = "3-session-scan";
          console.log(`[consumerPreview] found session via full scan dateKey="${sess.dateKey}" distId="${dist._id}"`);
          break;
        }
      }
    }

    // Strategy 4: last resort — any single open session (single-distributor setups)
    if (!distributorForSession) {
      const anyOpenSession = await DistributionSession.findOne({
        status: { $in: ["Open", "Planned"] },
      })
        .select("distributorId status")
        .lean();
      if (anyOpenSession) {
        distributorForSession = { _id: anyOpenSession.distributorId };
        sessionStatus = anyOpenSession.status === "Open" ? "open" : "planned";
        strategyUsed = "4-any-open";
      }
    }

    console.log(`[consumerPreview] strategy="${strategyUsed}" distId="${distributorForSession?._id}" sessionStatus="${sessionStatus}"`);

    // Check if token already issued for today
    let alreadyIssued = false;
    if (distributorForSession) {
      const today = todayKey();
      const existing = await Token.findOne({
        consumerId: consumer._id,
        distributorId: distributorForSession._id,
        sessionDateKey: today,
      })
        .select("_id tokenCode")
        .lean();
      alreadyIssued = !!existing;
    }

    console.log(`[consumerPreview] result sessionStatus="${sessionStatus}" alreadyIssued=${alreadyIssued}`);

    return res.json({
      success: true,
      data: {
        consumer: {
          name: consumer.name,
          consumerCode: consumer.consumerCode,
          division: consumer.division || "",
          ward: consumer.ward || "",
          unionName: consumer.unionName || "",
          upazila: consumer.upazila || "",
          status: consumer.status,
          category: consumer.category,
          blacklistStatus: consumer.blacklistStatus,
        },
        card: {
          cardStatus: card?.cardStatus || "Inactive",
        },
        qr: {
          qrStatus: qr?.status || "Invalid",
          validTo: qr?.validTo || null,
        },
        session: {
          status: sessionStatus,
          alreadyIssued,
        },
      },
    });
  } catch (err) {
    console.error("consumerPreview error:", err);
    return res.status(500).json({ success: false, message: "সার্ভার ত্রুটি" });
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
  consumerPreview,
};
