const User = require("../models/User");
const Distributor = require("../models/Distributor");
const Consumer = require("../models/Consumer");
const Family = require("../models/Family");
const OMSCard = require("../models/OMSCard");
const QRCode = require("../models/QRCode");
const Token = require("../models/Token");
const DistributionRecord = require("../models/DistributionRecord");
const StockLedger = require("../models/StockLedger");
const OfflineQueue = require("../models/OfflineQueue");
const AuditLog = require("../models/AuditLog");
const BlacklistEntry = require("../models/BlacklistEntry");
const AuditReportRequest = require("../models/AuditReportRequest");
const { writeAudit } = require("../services/audit.service");
const { notifyUser } = require("../services/notification.service");

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

async function getAdminSummary(req, res) {
  try {
    const { start, end } = getTodayRange();

    const todayTokenQuery = {
      $or: [
        { issuedAt: { $gte: start, $lt: end } },
        { issuedAt: { $exists: false }, createdAt: { $gte: start, $lt: end } },
      ],
    };

    const [
      pendingDistributors,
      activeConsumers,
      duplicateFamilies,
      issuedQRCards,
      todayTokens,
      auditAlerts,
      offlinePending,
      stockOutAgg,
      recentAlerts,
    ] = await Promise.all([
      User.countDocuments({
        userType: "Distributor",
        $or: [
          { authorityStatus: { $exists: false } },
          { authorityStatus: null },
          { authorityStatus: "Pending" },
        ],
      }),
      Consumer.countDocuments({ status: "Active" }),
      Family.countDocuments({ flaggedDuplicate: true }),
      OMSCard.countDocuments({}),
      Token.countDocuments(todayTokenQuery),
      AuditLog.countDocuments({
        severity: { $in: ["Warning", "Critical"] },
        createdAt: { $gte: start, $lt: end },
      }),
      OfflineQueue.countDocuments({ status: "Pending" }),
      StockLedger.aggregate([
        { $match: { dateKey: todayKey(), type: "OUT" } },
        { $group: { _id: null, totalKg: { $sum: "$qtyKg" } } },
      ]),
      AuditLog.find({ severity: { $in: ["Warning", "Critical"] } })
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          pendingDistributors,
          activeConsumers,
          duplicateFamilies,
          issuedQRCards,
          todayTokens,
          auditAlerts,
        },
        ops: {
          validScans: todayTokens,
          rejectedScans: 0,
          tokensGenerated: todayTokens,
          stockOutKg: stockOutAgg[0]?.totalKg || 0,
          offlineQueue: offlinePending,
        },
        alerts: recentAlerts,
      },
    });
  } catch (error) {
    console.error("getAdminSummary error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function getAdminDistributors(req, res) {
  try {
    const users = await User.find({ userType: "Distributor" })
      .select(
        "name phone email ward division district upazila unionName ward authorityStatus status officeAddress",
      )
      .lean();

    const distributorDocs = await Distributor.find({
      userId: { $in: users.map((u) => u._id) },
    }).lean();

    const distributorMap = new Map(
      distributorDocs.map((d) => [String(d.userId), d]),
    );

    const auditRequests = await AuditReportRequest.find({
      status: { $in: ["Requested", "Submitted", "Reviewed"] },
      decision: { $ne: "Approved" },
    })
      .select("distributorUserId status decision dueAt")
      .lean();

    const auditMap = new Map(
      auditRequests.map((r) => [String(r.distributorUserId), r]),
    );

    const rows = users.map((user) => {
      const distributor = distributorMap.get(String(user._id));
      const authorityStatus =
        user.authorityStatus || distributor?.authorityStatus || "Pending";
      const auditReq = auditMap.get(String(user._id));

      return {
        userId: String(user._id),
        distributorId: distributor?._id ? String(distributor._id) : null,
        name: user.name,
        phone: user.phone,
        email: user.email,
        ward: user.ward || distributor?.ward || "",
        officeAddress: user.officeAddress || "",
        authorityStatus,
        auditRequired: Boolean(auditReq),
        auditRequestStatus: auditReq?.status || null,
        auditDueAt: auditReq?.dueAt || null,
        createdAt: user.createdAt,
      };
    });

    const stats = rows.reduce(
      (acc, row) => {
        acc.total += 1;
        acc[row.authorityStatus] = (acc[row.authorityStatus] || 0) + 1;
        if (!row.authorityStatus || row.authorityStatus === "Pending") {
          acc.pending += 1;
        }
        return acc;
      },
      { total: 0, pending: 0 },
    );

    res.json({ success: true, data: { rows, stats } });
  } catch (error) {
    console.error("getAdminDistributors error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function updateDistributorStatus(req, res) {
  try {
    const { status } = req.body || {};
    if (!status || !["Active", "Suspended", "Revoked"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status must be Active, Suspended, or Revoked",
      });
    }

    const user = await User.findById(req.params.userId);
    if (!user || user.userType !== "Distributor") {
      return res.status(404).json({
        success: false,
        message: "Distributor user not found",
      });
    }

    user.authorityStatus = status;
    await user.save();

    let distributor = await Distributor.findOne({ userId: user._id });
    if (!distributor) {
      distributor = await Distributor.create({
        userId: user._id,
        division: user.division,
        district: user.district,
        upazila: user.upazila,
        unionName: user.unionName,
        ward: user.ward,
        authorityStatus: status,
        authorityFrom: user.authorityFrom || new Date(),
        authorityTo: user.authorityTo,
      });
    } else {
      distributor.authorityStatus = status;
      await distributor.save();
    }

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Admin",
      action: "DISTRIBUTOR_STATUS_UPDATED",
      entityType: "Distributor",
      entityId: String(distributor._id),
      severity: status === "Active" ? "Info" : "Warning",
      meta: { status },
    });

    await notifyUser(user._id, {
      title: "Distributor status updated",
      message: `Your distributor account status is now ${status}.`,
      meta: { status },
    });

    res.json({
      success: true,
      message: "Distributor status updated",
      data: { userId: String(user._id), authorityStatus: status },
    });
  } catch (error) {
    console.error("updateDistributorStatus error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function getAdminCardsSummary(req, res) {
  try {
    const now = new Date();
    const rotationThreshold = new Date(now.getTime() + 7 * 86400000);

    const [issuedCards, activeQR, inactiveQR, dueForRotation] =
      await Promise.all([
        OMSCard.countDocuments({}),
        QRCode.countDocuments({ status: "Valid" }),
        QRCode.countDocuments({ status: { $ne: "Valid" } }),
        QRCode.countDocuments({ validTo: { $lte: rotationThreshold } }),
      ]);

    res.json({
      success: true,
      data: {
        issuedCards,
        activeQR,
        inactiveRevoked: inactiveQR,
        dueForRotation,
      },
    });
  } catch (error) {
    console.error("getAdminCardsSummary error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function getAdminDistributionMonitoring(req, res) {
  try {
    const records = await DistributionRecord.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .populate({
        path: "tokenId",
        populate: {
          path: "consumerId",
          select: "ward",
        },
      })
      .lean();

    const rows = records.map((record) => {
      const token =
        record.tokenId && typeof record.tokenId === "object"
          ? record.tokenId
          : null;
      const consumer =
        token?.consumerId && typeof token.consumerId === "object"
          ? token.consumerId
          : null;

      return {
        ward: consumer?.ward || "Unknown",
        expectedKg: record.expectedKg,
        actualKg: record.actualKg,
        status: record.mismatch ? "Mismatch" : "Matched",
        action: record.mismatch ? "Pause + Alert" : "Continue",
      };
    });

    res.json({ success: true, data: { rows } });
  } catch (error) {
    console.error("getAdminDistributionMonitoring error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function getAdminConsumerReview(req, res) {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

    const consumers = await Consumer.find({})
      .populate("familyId", "flaggedDuplicate")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const rows = consumers.map((consumer) => {
      const family = consumer.familyId || null;
      return {
        id: String(consumer._id),
        consumerCode: consumer.consumerCode,
        name: consumer.name,
        nidLast4: consumer.nidLast4,
        status: consumer.status,
        blacklistStatus: consumer.blacklistStatus,
        familyFlag: !!family?.flaggedDuplicate,
      };
    });

    res.json({ success: true, data: { rows } });
  } catch (error) {
    console.error("getAdminConsumerReview error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function getAdminAuditDetail(req, res) {
  try {
    const log = await AuditLog.findById(req.params.id).lean();
    if (!log) {
      return res
        .status(404)
        .json({ success: false, message: "Audit log not found" });
    }

    let consumer = null;

    const populateConsumer = async (id) =>
      Consumer.findById(id)
        .populate(
          "createdByDistributor",
          "name phone email ward officeAddress division district upazila unionName",
        )
        .populate("familyId")
        .lean();

    if (log.entityType === "Consumer" && log.entityId) {
      consumer = await populateConsumer(log.entityId);
    }

    if (!consumer && log.entityType === "Token" && log.entityId) {
      const token = await Token.findById(log.entityId)
        .populate({
          path: "consumerId",
          populate: [
            { path: "createdByDistributor", select: "name phone email ward" },
            { path: "familyId" },
          ],
        })
        .lean();
      consumer = token?.consumerId || null;
    }

    if (!consumer && log.entityType === "BlacklistEntry" && log.entityId) {
      const entry = await BlacklistEntry.findById(log.entityId).lean();
      if (entry?.targetType === "Consumer" && entry.targetRefId) {
        consumer = await populateConsumer(entry.targetRefId);
      }
    }

    res.json({ success: true, data: { log, consumer } });
  } catch (error) {
    console.error("getAdminAuditDetail error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = {
  getAdminSummary,
  getAdminDistributors,
  updateDistributorStatus,
  getAdminCardsSummary,
  getAdminDistributionMonitoring,
  getAdminConsumerReview,
  getAdminAuditDetail,
};
