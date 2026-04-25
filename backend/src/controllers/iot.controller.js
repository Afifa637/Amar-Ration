const mongoose = require("mongoose");

const Token = require("../models/Token");
const DistributionRecord = require("../models/DistributionRecord");
const DistributionSession = require("../models/DistributionSession");
const SystemSetting = require("../models/SystemSetting");
const IotWeightAlert = require("../models/IotWeightAlert");
const Distributor = require("../models/Distributor");
const Consumer = require("../models/Consumer");
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
const { generateReceipt } = require("../services/receipt.service");
const { normalizeStockItem } = require("../utils/stock-items.utils");

const lastPollTime = new Map();

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function parseThreshold(settingValue) {
  if (typeof settingValue === "number") return settingValue;
  if (settingValue && typeof settingValue.maxDiff === "number") {
    return settingValue.maxDiff;
  }
  return 0.05;
}

function parseThresholdPercent(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return 0.05;
  return Math.max(0.01, raw > 1 ? raw / 100 : raw);
}

function parseAutoPause(value) {
  if (typeof value === "boolean") return value;
  return true;
}

async function resolveDistributionSettings(session) {
  const [weightSetting, settingsDoc] = await Promise.all([
    SystemSetting.findOne({ key: "weightThresholdKg" }).session(session).lean(),
    SystemSetting.findOne({ key: "distributor:global:settings" })
      .session(session)
      .lean(),
  ]);

  const thresholdPercent = parseThresholdPercent(
    settingsDoc?.value?.distribution?.weightThresholdPercent ??
      settingsDoc?.value?.distribution?.weightThresholdKg ??
      weightSetting?.value ??
      0.05,
  );

  const absoluteFallbackKg = Math.max(
    0.05,
    Number(parseThreshold(weightSetting?.value)) || 0.05,
  );
  const autoPauseOnMismatch = parseAutoPause(
    settingsDoc?.value?.distribution?.autoPauseOnMismatch,
  );

  return { thresholdPercent, absoluteFallbackKg, autoPauseOnMismatch };
}

// POST /api/iot/weight-reading
async function handleWeightReading(req, res) {
  const { tokenCode, measuredKg, deviceId, timestamp } = req.body || {};

  if (!tokenCode || measuredKg === undefined || measuredKg === null) {
    return res.status(400).json({
      success: false,
      message: "tokenCode and measuredKg are required",
    });
  }

  const actual = Number(measuredKg);
  if (!Number.isFinite(actual) || actual <= 0 || !Number.isInteger(actual)) {
    return res.status(400).json({
      success: false,
      message: "measuredKg must be a positive integer in 1kg step",
    });
  }

  const session = await mongoose.startSession();
  let distributorIdForFraudCheck = null;

  try {
    session.startTransaction();

    const token = await Token.findOne({ tokenCode }).session(session);
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

    if (!token) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "Token not found" });
    }

    if (token.status !== "Issued") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Token is not in issued state",
      });
    }

    const existingRecord = await DistributionRecord.findOne({
      tokenId: token._id,
    }).session(session);
    if (existingRecord) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Distribution already completed",
      });
    }

    const { thresholdPercent, absoluteFallbackKg, autoPauseOnMismatch } =
      await resolveDistributionSettings(session);

    const expected = Number(token.rationQtyKg);
    const maxDiff = Math.max(absoluteFallbackKg, expected * thresholdPercent);
    const mismatch = Math.abs(actual - expected) > maxDiff;
    const itemName = normalizeStockItem(token.rationItem);
    if (!itemName) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid token ration item",
        code: "VALIDATION_ERROR",
      });
    }

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
        distributorId: token.distributorId,
        dateKey: tokenSession?.dateKey || token.sessionDateKey || todayKey(),
        qtyKg: actual,
        ref: token.tokenCode,
        item: itemName,
      },
      session,
    );

    await writeAudit(
      {
        actorType: "System",
        action: mismatch ? "WEIGHT_MISMATCH_IOT" : "DISTRIBUTION_SUCCESS_IOT",
        entityType: "Token",
        entityId: String(token._id),
        severity: mismatch ? "Critical" : "Info",
        meta: {
          token: token.tokenCode,
          expected,
          actual,
          maxDiff,
          source: "iot",
          deviceId: String(deviceId || "").trim() || undefined,
          at: timestamp || new Date().toISOString(),
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

    token.iotVerified = !mismatch;
    await token.save({ session });

    await session.commitTransaction();

    if (mismatch) {
      const distributor = await Distributor.findById(token.distributorId)
        .select("userId")
        .lean();
      distributorIdForFraudCheck = String(token.distributorId);

      const consumer = await Consumer.findById(token.consumerId)
        .select("_id guardianPhone phone")
        .lean();
      void sendMismatchSms(consumer, token.tokenCode, expected, actual);

      if (distributor?.userId) {
        await notifyUser(distributor.userId, {
          title: "Weight mismatch alert",
          message: `Token ${token.tokenCode} mismatch: expected ${expected}kg, actual ${actual}kg.`,
          meta: {
            token: token.tokenCode,
            expected,
            actual,
            source: "iot",
            deviceId: String(deviceId || "").trim() || undefined,
          },
        });
      }

      await notifyAdmins({
        title: "Weight mismatch alert (IoT)",
        message: `Token ${token.tokenCode} mismatch: expected ${expected}kg, actual ${actual}kg.`,
        meta: {
          token: token.tokenCode,
          expected,
          actual,
          source: "iot",
          distributorId: String(token.distributorId),
        },
      });
    } else {
      const consumer = await Consumer.findById(token.consumerId)
        .select("_id guardianPhone phone")
        .lean();
      void sendDistributionSms(consumer, token.tokenCode, actual, itemName);
      setImmediate(() => {
        generateReceipt(token._id).catch((err) =>
          console.error(
            "generateReceipt iot success error:",
            err?.message || err,
          ),
        );
      });
    }

    if (distributorIdForFraudCheck) {
      await checkDistributorMismatchCount(distributorIdForFraudCheck);
    }

    return res.json({
      success: true,
      data: {
        tokenCode: String(token.tokenCode),
        expectedKg: expected,
        measuredKg: actual,
        mismatch,
        maxDiff: Number(maxDiff.toFixed(3)),
        thresholdPercent: Number((thresholdPercent * 100).toFixed(1)),
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("handleWeightReading error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    session.endSession();
  }
}

// GET /api/iot/weight-threshold
async function getWeightThreshold(req, res) {
  try {
    const setting = await SystemSetting.findOne({
      key: "weightThresholdKg",
    }).lean();
    const settingsDoc = await SystemSetting.findOne({
      key: "distributor:global:settings",
    }).lean();

    const thresholdPercent = parseThresholdPercent(
      settingsDoc?.value?.distribution?.weightThresholdPercent ??
        settingsDoc?.value?.distribution?.weightThresholdKg ??
        setting?.value ??
        0.05,
    );
    const maxDiff = Math.max(
      0.05,
      Number(parseThreshold(setting?.value)) || 0.05,
    );
    const autoPauseOnMismatch = parseAutoPause(
      settingsDoc?.value?.distribution?.autoPauseOnMismatch,
    );

    return res.json({
      success: true,
      data: {
        weightThresholdKg: maxDiff,
        weightThresholdPercent: thresholdPercent,
        autoPauseOnMismatch,
      },
    });
  } catch (error) {
    console.error("getWeightThreshold error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// GET /api/iot/pending-token
async function getPendingToken(req, res) {
  try {
    const deviceId = String(req.query?.deviceId || "").trim();
    const sessionId = String(req.query?.sessionId || "").trim();

    if (!deviceId || !sessionId) {
      return res.status(400).json({
        success: false,
        message: "deviceId and sessionId are required",
        code: "VALIDATION_ERROR",
      });
    }

    const last = lastPollTime.get(deviceId);
    const now = Date.now();
    if (last && now - last < 1000) {
      return res.status(429).json({
        success: false,
        message: "Too many requests",
        code: "RATE_LIMITED",
      });
    }
    lastPollTime.set(deviceId, now);

    const distSession = await DistributionSession.findById(sessionId)
      .select("_id status")
      .lean();
    if (!distSession || distSession.status !== "Open") {
      return res.status(404).json({
        success: false,
        message: "Active session not found",
        code: "NOT_FOUND",
      });
    }

    const token = await Token.findOne({
      sessionId,
      status: "Issued",
      iotVerified: false,
      issuedAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
    })
      .sort({ issuedAt: -1 })
      .populate("consumerId", "consumerCode name category")
      .lean();

    if (!token) {
      return res.json({ success: true, data: { found: false } });
    }

    return res.json({
      success: true,
      data: {
        found: true,
        tokenCode: token.tokenCode,
        rationQtyKg: Number(token.rationQtyKg),
        tokenId: String(token._id),
        consumerName: token?.consumerId?.name || null,
        consumerCode: token?.consumerId?.consumerCode || null,
        category: token?.consumerId?.category || null,
      },
    });
  } catch (error) {
    console.error("getPendingToken error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = {
  handleWeightReading,
  getWeightThreshold,
  getPendingToken,
  getProductTargets,
  receiveWeightAlert,
};

// GET /api/iot/product-targets?distributorId=xxx
async function getProductTargets(req, res) {
  try {
    const distributorId = String(req.query.distributorId || "").trim();
    const key = distributorId ? `iot:product-targets:${distributorId}` : "iot:product-targets";
    let setting = await SystemSetting.findOne({ key }).lean();
    if (!setting && distributorId) {
      setting = await SystemSetting.findOne({ key: "iot:product-targets" }).lean();
    }
    const targets = setting?.value || { p1Kg: 0, p2Kg: 0, p3Kg: 0, productNames: ["Rice", "Lentil", "Onion"] };
    return res.json({ success: true, data: targets });
  } catch (error) {
    console.error("getProductTargets error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// POST /api/iot/weight-alert
async function receiveWeightAlert(req, res) {
  try {
    const { product, expectedKg, measuredKg, deviceId } = req.body || {};
    if (!product || expectedKg === undefined || measuredKg === undefined) {
      return res.status(400).json({
        success: false,
        message: "product, expectedKg, and measuredKg are required",
      });
    }

    const diffG = Math.round((Number(measuredKg) - Number(expectedKg)) * 1000);

    const setting = await SystemSetting.findOne({ key: "iot:product-targets" }).lean();
    const productNames = setting?.value?.productNames || ["Rice", "Lentil", "Onion"];
    const idx = product === "P1" ? 0 : product === "P2" ? 1 : 2;
    const productName = productNames[idx] || product;

    const alert = await IotWeightAlert.create({
      product,
      productName,
      expectedKg: Number(expectedKg),
      measuredKg: Number(measuredKg),
      diffG,
      deviceId: String(deviceId || "esp32").trim(),
    });

    const { notifyAdmins } = require("../services/notification.service");
    await notifyAdmins({
      title: `IoT Weight Mismatch — ${productName} (${product})`,
      message: `Device measured ${measuredKg}kg, expected ${expectedKg}kg (diff: ${diffG > 0 ? "+" : ""}${diffG}g). Device: ${deviceId || "esp32"}.`,
      meta: { alertId: String(alert._id), product, productName, expectedKg, measuredKg, diffG },
    });

    return res.json({ success: true, message: "Alert recorded" });
  } catch (error) {
    console.error("receiveWeightAlert error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
