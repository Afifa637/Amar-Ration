const mongoose = require("mongoose");

const Token = require("../models/Token");
const DistributionRecord = require("../models/DistributionRecord");
const DistributionSession = require("../models/DistributionSession");
const SystemSetting = require("../models/SystemSetting");
const Distributor = require("../models/Distributor");
const { stockOut } = require("../services/stock.service");
const { writeAudit } = require("../services/audit.service");
const {
  notifyAdmins,
  notifyUser,
} = require("../services/notification.service");
const { checkDistributorMismatchCount } = require("../services/fraud.service");

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

  const maxDiff = parseThreshold(
    weightSetting?.value ?? settingsDoc?.value?.distribution?.weightThresholdKg,
  );
  const autoPauseOnMismatch = parseAutoPause(
    settingsDoc?.value?.distribution?.autoPauseOnMismatch,
  );

  return { maxDiff, autoPauseOnMismatch };
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
  if (!Number.isFinite(actual) || actual <= 0) {
    return res.status(400).json({
      success: false,
      message: "measuredKg must be a positive number",
    });
  }

  const session = await mongoose.startSession();
  let distributorIdForFraudCheck = null;

  try {
    session.startTransaction();

    const token = await Token.findOne({ tokenCode }).session(session);
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

    const { maxDiff, autoPauseOnMismatch } =
      await resolveDistributionSettings(session);

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
        distributorId: token.distributorId,
        dateKey: todayKey(),
        qtyKg: actual,
        ref: token.tokenCode,
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

    await session.commitTransaction();

    if (mismatch) {
      const distributor = await Distributor.findById(token.distributorId)
        .select("userId")
        .lean();
      distributorIdForFraudCheck = String(token.distributorId);

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

    const maxDiff = parseThreshold(
      setting?.value ?? settingsDoc?.value?.distribution?.weightThresholdKg,
    );
    const autoPauseOnMismatch = parseAutoPause(
      settingsDoc?.value?.distribution?.autoPauseOnMismatch,
    );

    return res.json({
      success: true,
      data: {
        weightThresholdKg: maxDiff,
        autoPauseOnMismatch,
      },
    });
  } catch (error) {
    console.error("getWeightThreshold error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = {
  handleWeightReading,
  getWeightThreshold,
};
