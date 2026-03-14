const mongoose = require("mongoose");

const Distributor = require("../models/Distributor");
const Consumer = require("../models/Consumer");
const DistributionSession = require("../models/DistributionSession");
const Token = require("../models/Token");
const DistributionRecord = require("../models/DistributionRecord");
const OfflineQueue = require("../models/OfflineQueue");
const SystemSetting = require("../models/SystemSetting");
const StockLedger = require("../models/StockLedger");
const User = require("../models/User");
const {
  rationQtyByCategory,
  makeTokenCode,
} = require("../services/token.service");
const { stockOut } = require("../services/stock.service");
const { writeAudit } = require("../services/audit.service");

function todayKey() {
  return new Date().toISOString().slice(0, 10);
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
    division: user.division,
    district: user.district,
    upazila: user.upazila,
    unionName: user.unionName,
    ward: user.ward,
    authorityStatus: user.authorityStatus || "Active",
    authorityFrom: user.authorityFrom || new Date(),
    authorityTo: user.authorityTo,
  });

  return distributor;
}

async function getOrCreateSession(distributorId, session) {
  const dateKey = todayKey();
  const existing = await DistributionSession.findOne({
    distributorId,
    dateKey,
  }).session(session);
  if (existing) return existing;

  const created = await DistributionSession.create(
    [{ distributorId, dateKey, status: "Open" }],
    { session },
  );
  return created[0];
}

async function resolveConsumerFromPayload(qrPayload) {
  const payload = String(qrPayload || "").trim();
  if (!payload) return null;

  const orConditions = [{ consumerCode: payload }, { qrToken: payload }];

  if (/^[a-f\d]{24}$/i.test(payload)) {
    orConditions.push({ _id: payload });
  }

  return Consumer.findOne({ $or: orConditions });
}

function parseThreshold(settingValue) {
  if (typeof settingValue === "number") return settingValue;
  if (settingValue && typeof settingValue.maxDiff === "number")
    return settingValue.maxDiff;
  return 0.05;
}

function buildTokenSearchQuery(search) {
  if (!search) return null;
  return {
    $or: [{ tokenCode: { $regex: search, $options: "i" } }],
  };
}

// POST /api/distribution/scan { qrPayload }
async function scanAndIssueToken(req, res) {
  const userId = req.user.userId;
  const distributor = await ensureDistributorProfile(req.user);

  if (!distributor) {
    return res
      .status(403)
      .json({ success: false, message: "Distributor profile not found" });
  }

  const { qrPayload } = req.body;
  if (!qrPayload) {
    return res
      .status(400)
      .json({ success: false, message: "qrPayload required" });
  }

  const consumer = await resolveConsumerFromPayload(qrPayload);
  if (!consumer) {
    return res
      .status(404)
      .json({ success: false, message: "Consumer not found" });
  }

  if (distributor.ward && consumer.ward && distributor.ward !== consumer.ward) {
    return res
      .status(403)
      .json({ success: false, message: "Consumer is outside your ward" });
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

    const daySession = await getOrCreateSession(distributor._id, session);
    const rationQtyKg = rationQtyByCategory(consumer.category);

    let tokenDoc = null;

    for (let i = 0; i < 5; i += 1) {
      try {
        const created = await Token.create(
          [
            {
              tokenCode: makeTokenCode(),
              consumerId: consumer._id,
              distributorId: distributor._id,
              sessionId: daySession._id,
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
          sessionId: daySession._id,
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

    await session.commitTransaction();

    return res.json({
      success: true,
      message: "Token issued successfully",
      data: {
        token: tokenDoc,
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

// POST /api/distribution/complete { tokenCode, actualKg }
async function completeDistribution(req, res) {
  const distributor = await ensureDistributorProfile(req.user);

  if (!distributor) {
    return res
      .status(403)
      .json({ success: false, message: "Distributor profile not found" });
  }

  const { tokenCode, actualKg } = req.body;

  if (!tokenCode || actualKg === undefined) {
    return res
      .status(400)
      .json({ success: false, message: "tokenCode and actualKg are required" });
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

    const token = await Token.findOne({ tokenCode }).session(session);
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

    const existingRecord = await DistributionRecord.findOne({
      tokenId: token._id,
    }).session(session);
    if (existingRecord) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ success: false, message: "Distribution already completed" });
    }

    const setting = await SystemSetting.findOne({ key: "weightThresholdKg" })
      .session(session)
      .lean();
    const maxDiff = parseThreshold(setting?.value);

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

    await session.commitTransaction();
    return res.json({
      success: true,
      message: "Distribution completed",
      data: { mismatch, expected, actual, maxDiff },
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
    const { search, status, page = 1, limit = 20 } = req.query;
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

    const [total, tokens] = await Promise.all([
      Token.countDocuments(query),
      Token.find(query)
        .populate("consumerId", "consumerCode name ward status")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
    ]);

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

module.exports = {
  scanAndIssueToken,
  completeDistribution,
  listTokens,
  cancelToken,
  getDistributionRecords,
  getDistributionStats,
  getDistributionQuickInfo,
};
