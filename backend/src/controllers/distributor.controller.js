const Distributor = require("../models/Distributor");
const Consumer = require("../models/Consumer");
const Family = require("../models/Family");
const OMSCard = require("../models/OMSCard");
const QRCode = require("../models/QRCode");
const Token = require("../models/Token");
const AuditLog = require("../models/AuditLog");
const BlacklistEntry = require("../models/BlacklistEntry");
const OfflineQueue = require("../models/OfflineQueue");
const DistributionRecord = require("../models/DistributionRecord");
const DistributionSession = require("../models/DistributionSession");
const StockLedger = require("../models/StockLedger");
const SystemSetting = require("../models/SystemSetting");
const User = require("../models/User");

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function getDistributorProfileByUserId(userId) {
  if (!userId) return null;
  return Distributor.findOne({ userId }).lean();
}

async function ensureDistributorProfile(reqUser) {
  const userId = reqUser?.userId;
  if (!userId) return null;

  let distributor = await Distributor.findOne({ userId }).lean();
  if (distributor) return distributor;

  const user = await User.findById(userId).lean();
  if (!user) return null;
  if (user.userType !== "Distributor" && user.userType !== "FieldUser") {
    return null;
  }

  const created = await Distributor.create({
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

  return created.toObject();
}

async function getDistributorDashboard(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);

    if (!distributor) {
      return res.status(404).json({ message: "Distributor profile not found" });
    }

    const tokenDocs = await Token.find({ distributorId: distributor._id })
      .select("_id status rationQtyKg")
      .lean();

    const tokenIds = tokenDocs.map((t) => t._id);

    const [
      totalConsumers,
      activeConsumers,
      pendingOffline,
      recentAudit,
      stockOutTodayAgg,
      mismatchCount,
    ] = await Promise.all([
      Consumer.countDocuments({ createdByDistributor: distributor._id }),
      Consumer.countDocuments({
        createdByDistributor: distributor._id,
        status: "Active",
      }),
      OfflineQueue.countDocuments({
        distributorId: distributor._id,
        status: "Pending",
      }),
      AuditLog.find({
        $or: [{ actorUserId: req.user.userId }, { actorType: "Distributor" }],
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      StockLedger.aggregate([
        {
          $match: {
            distributorId: distributor._id,
            dateKey: todayKey(),
            type: "OUT",
          },
        },
        {
          $group: {
            _id: null,
            totalKg: { $sum: "$qtyKg" },
          },
        },
      ]),
      DistributionRecord.countDocuments({
        tokenId: { $in: tokenIds },
        mismatch: true,
      }),
    ]);

    const issuedTokens = tokenDocs.length;
    const usedTokens = tokenDocs.filter((t) => t.status === "Used").length;

    res.json({
      distributor: {
        id: String(distributor._id),
        division: distributor.division || "",
        district: distributor.district || "",
        upazila: distributor.upazila || "",
        unionName: distributor.unionName || "",
        ward: distributor.ward || "",
        status: distributor.authorityStatus || "",
      },
      stats: {
        totalConsumers,
        activeConsumers,
        issuedTokens,
        usedTokens,
        mismatchCount,
        pendingOffline,
        stockOutTodayKg: stockOutTodayAgg[0]?.totalKg || 0,
      },
      recentAudit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
}

async function getBeneficiaries(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);

    if (!distributor) {
      return res.status(404).json({ message: "Distributor profile not found" });
    }

    const { tab = "long", q = "", status, ward } = req.query;

    const filter = {
      createdByDistributor: distributor._id,
    };

    if (ward && ward !== "সব") {
      filter.ward = ward;
    }

    if (tab === "short") {
      filter.status = "Active";
    } else if (status && status !== "সব" && tab !== "flags") {
      filter.status = status;
    }

    const consumers = await Consumer.find(filter)
      .populate("familyId")
      .sort({ createdAt: -1 })
      .lean();

    const consumerIds = consumers.map((c) => c._id);

    const cards = await OMSCard.find({
      consumerId: { $in: consumerIds },
    }).lean();

    const cardMap = new Map(cards.map((c) => [String(c.consumerId), c]));

    const qrIds = cards.map((c) => c.qrCodeId).filter(Boolean);

    const qrs = await QRCode.find({
      _id: { $in: qrIds },
    }).lean();

    const qrMap = new Map(qrs.map((q) => [String(q._id), q]));

    let rows = consumers.map((c) => {
      const family = c.familyId || null;
      const card = cardMap.get(String(c._id)) || null;
      const qr = card?.qrCodeId ? qrMap.get(String(card.qrCodeId)) : null;

      return {
        id: String(c._id),
        consumerCode: c.consumerCode,
        name: c.name,
        nidLast4: c.nidLast4,
        status: c.status,
        category: c.category,
        ward: c.ward || "",
        blacklistStatus: c.blacklistStatus,
        familyFlag: !!family?.flaggedDuplicate,
        cardStatus: card?.cardStatus || null,
        qrStatus: qr?.status || null,
        createdAt: c.createdAt,
      };
    });

    if (tab === "flags") {
      rows = rows.filter((r) => r.familyFlag || r.blacklistStatus !== "None");
    }

    if (q && q.trim()) {
      const needle = q.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.consumerCode || "").toLowerCase().includes(needle) ||
          (r.name || "").toLowerCase().includes(needle) ||
          (r.nidLast4 || "").includes(q.trim()),
      );
    }

    res.json({
      rows,
      total: rows.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
}

async function getDistributorTokens(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);

    if (!distributor) {
      return res.status(404).json({ message: "Distributor profile not found" });
    }

    const tokens = await Token.find({ distributorId: distributor._id })
      .populate("consumerId")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const rows = tokens.map((t) => ({
      id: String(t._id),
      tokenCode: t.tokenCode,
      status: t.status,
      rationQtyKg: t.rationQtyKg,
      issuedAt: t.issuedAt,
      usedAt: t.usedAt,
      consumer: t.consumerId
        ? {
            id: String(t.consumerId._id),
            consumerCode: t.consumerId.consumerCode,
            name: t.consumerId.name,
            category: t.consumerId.category,
            status: t.consumerId.status,
          }
        : null,
    }));

    res.json({ rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
}

async function getDistributorAudit(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);

    if (!distributor) {
      return res.status(404).json({ message: "Distributor profile not found" });
    }

    const logs = await AuditLog.find({
      $or: [{ actorUserId: req.user.userId }, { actorType: "Distributor" }],
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const blacklist = await BlacklistEntry.find({ active: true })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ logs, blacklist });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
}

async function getDistributorReports(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);

    if (!distributor) {
      return res.status(404).json({ message: "Distributor profile not found" });
    }

    const tokenDocs = await Token.find({ distributorId: distributor._id })
      .select("_id status")
      .lean();

    const tokenIds = tokenDocs.map((t) => t._id);

    const [stockOutAgg, mismatchCount] = await Promise.all([
      StockLedger.aggregate([
        {
          $match: {
            distributorId: distributor._id,
            type: "OUT",
          },
        },
        {
          $group: {
            _id: null,
            totalKg: { $sum: "$qtyKg" },
          },
        },
      ]),
      DistributionRecord.countDocuments({
        tokenId: { $in: tokenIds },
        mismatch: true,
      }),
    ]);

    const totalTokens = tokenDocs.length;
    const usedTokens = tokenDocs.filter((t) => t.status === "Used").length;
    const cancelledTokens = tokenDocs.filter(
      (t) => t.status === "Cancelled",
    ).length;

    res.json({
      totalTokens,
      usedTokens,
      cancelledTokens,
      mismatchCount,
      totalStockOutKg: stockOutAgg[0]?.totalKg || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
}

async function getDistributorMonitoring(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);

    if (!distributor) {
      return res.status(404).json({ message: "Distributor profile not found" });
    }

    const [offline, sessions, criticalLogs] = await Promise.all([
      OfflineQueue.find({ distributorId: distributor._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      DistributionSession.find({ distributorId: distributor._id })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean(),
      AuditLog.find({
        actorUserId: req.user.userId,
        severity: "Critical",
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    res.json({
      offline,
      sessions,
      criticalLogs,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
}

async function getDistributorSettings(req, res) {
  try {
    const settings = await SystemSetting.find({}).lean();

    const settingMap = {};
    for (const s of settings) {
      settingMap[s.key] = s.value;
    }

    res.json(settingMap);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
}

module.exports = {
  getDistributorDashboard,
  getBeneficiaries,
  getDistributorTokens,
  getDistributorAudit,
  getDistributorReports,
  getDistributorMonitoring,
  getDistributorSettings,
};
