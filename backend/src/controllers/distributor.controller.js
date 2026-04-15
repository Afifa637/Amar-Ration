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
const { normalizeWardNo, buildWardMatchQuery } = require("../utils/ward.utils");
const {
  normalizeDivision,
  buildDivisionMatchQuery,
} = require("../utils/division.utils");

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function toDateKey(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function lastNDates(n = 7) {
  const out = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function buildWardQuery(distributor) {
  const query = {};

  const divisionQuery = buildDivisionMatchQuery(distributor?.division);
  if (divisionQuery) {
    query.division = divisionQuery;
  }

  const wardInput = distributor?.wardNo || distributor?.ward;
  const wardQuery = buildWardMatchQuery(wardInput);
  if (wardQuery) {
    Object.assign(query, wardQuery);
  }

  return query;
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

  return created.toObject();
}

async function getDistributorDashboard(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);

    if (!distributor) {
      return res.status(404).json({ message: "Distributor profile not found" });
    }

    const tokenDocs = await Token.find({ distributorId: distributor._id })
      .select("_id status rationQtyKg issuedAt usedAt sessionId")
      .lean();

    const tokenIds = tokenDocs.map((t) => t._id);
    const last7 = lastNDates(7);
    const last7Set = new Set(last7);

    const wardQuery = buildWardQuery(distributor);

    const [
      mismatchDocs,
      recentSessions,
      sessionStatsAgg,
      stockOutTodayAgg,
      stockTodayByItemAgg,
      stockLast7OutAgg,
      totalConsumers,
      activeConsumers,
      pendingOffline,
      recentAudit,
    ] = await Promise.all([
      DistributionRecord.find({
        tokenId: { $in: tokenIds },
        mismatch: true,
      })
        .select("tokenId createdAt")
        .lean(),
      DistributionSession.find({ distributorId: distributor._id })
        .sort({ dateKey: -1, createdAt: -1 })
        .limit(6)
        .lean(),
      DistributionSession.aggregate([
        { $match: { distributorId: distributor._id } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
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
      StockLedger.aggregate([
        {
          $match: {
            distributorId: distributor._id,
            dateKey: todayKey(),
          },
        },
        {
          $group: {
            _id: { item: "$item", type: "$type" },
            qtyKg: { $sum: "$qtyKg" },
          },
        },
      ]),
      StockLedger.aggregate([
        {
          $match: {
            distributorId: distributor._id,
            dateKey: { $in: last7 },
            type: "OUT",
          },
        },
        {
          $group: {
            _id: "$dateKey",
            qtyKg: { $sum: "$qtyKg" },
          },
        },
      ]),
      Consumer.countDocuments(wardQuery),
      Consumer.countDocuments({
        ...wardQuery,
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
    ]);

    const mismatchCount = mismatchDocs.length;

    const issuedTokens = tokenDocs.length;
    const usedTokens = tokenDocs.filter((t) => t.status === "Used").length;
    const cancelledTokens = tokenDocs.filter(
      (t) => t.status === "Cancelled",
    ).length;
    const expiredTokens = tokenDocs.filter(
      (t) => t.status === "Expired",
    ).length;

    const sessionStats = {
      planned: 0,
      open: 0,
      paused: 0,
      closed: 0,
    };
    sessionStatsAgg.forEach((row) => {
      if (row._id === "Planned") sessionStats.planned = row.count;
      if (row._id === "Open") sessionStats.open = row.count;
      if (row._id === "Paused") sessionStats.paused = row.count;
      if (row._id === "Closed") sessionStats.closed = row.count;
    });

    const stockTodayByItem = {};
    for (const row of stockTodayByItemAgg) {
      const item = String(row?._id?.item || "");
      const type = String(row?._id?.type || "");
      if (!item) continue;
      if (!stockTodayByItem[item]) {
        stockTodayByItem[item] = {
          inKg: 0,
          outKg: 0,
          adjustKg: 0,
          balanceKg: 0,
        };
      }
      if (type === "IN") stockTodayByItem[item].inKg += Number(row.qtyKg || 0);
      if (type === "OUT")
        stockTodayByItem[item].outKg += Number(row.qtyKg || 0);
      if (type === "ADJUST")
        stockTodayByItem[item].adjustKg += Number(row.qtyKg || 0);
    }
    Object.values(stockTodayByItem).forEach((row) => {
      row.balanceKg = Number((row.inKg + row.adjustKg - row.outKg).toFixed(2));
    });

    const trendMap = new Map(
      last7.map((dateKey) => [
        dateKey,
        {
          dateKey,
          issuedTokens: 0,
          usedTokens: 0,
          mismatchCount: 0,
          stockOutKg: 0,
        },
      ]),
    );

    tokenDocs.forEach((token) => {
      const issuedKey = toDateKey(token.issuedAt);
      if (last7Set.has(issuedKey)) {
        trendMap.get(issuedKey).issuedTokens += 1;
      }

      if (token.status === "Used") {
        const usedKey = toDateKey(token.usedAt || token.issuedAt);
        if (last7Set.has(usedKey)) {
          trendMap.get(usedKey).usedTokens += 1;
        }
      }
    });

    mismatchDocs.forEach((record) => {
      const key = toDateKey(record.createdAt);
      if (last7Set.has(key)) {
        trendMap.get(key).mismatchCount += 1;
      }
    });

    stockLast7OutAgg.forEach((row) => {
      const key = String(row._id || "");
      if (!last7Set.has(key)) return;
      trendMap.get(key).stockOutKg = Number(row.qtyKg || 0);
    });

    const recentSessionRows = recentSessions.map((session) => {
      const sessionTokens = tokenDocs.filter(
        (t) => String(t.sessionId) === String(session._id),
      );
      return {
        id: String(session._id),
        dateKey: session.dateKey,
        status: session.status,
        rationItem: session.rationItem || "চাল",
        openedAt: session.openedAt || null,
        closedAt: session.closedAt || null,
        issuedTokens: sessionTokens.length,
        usedTokens: sessionTokens.filter((t) => t.status === "Used").length,
        cancelledTokens: sessionTokens.filter((t) => t.status === "Cancelled")
          .length,
      };
    });

    const latestSession = recentSessions[0] || null;
    const todayIssued = tokenDocs.filter(
      (t) => last7[6] === toDateKey(t.issuedAt),
    ).length;
    const todayUsed = tokenDocs.filter(
      (t) =>
        t.status === "Used" && last7[6] === toDateKey(t.usedAt || t.issuedAt),
    ).length;
    const todayMismatch = mismatchDocs.filter(
      (r) => last7[6] === toDateKey(r.createdAt),
    ).length;

    res.json({
      distributor: {
        id: String(distributor._id),
        wardNo: distributor.wardNo || "",
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
        cancelledTokens,
        expiredTokens,
        mismatchCount,
        pendingOffline,
        stockOutTodayKg: stockOutTodayAgg[0]?.totalKg || 0,
      },
      session: latestSession
        ? {
            id: String(latestSession._id),
            dateKey: latestSession.dateKey,
            status: latestSession.status,
            rationItem: latestSession.rationItem || "চাল",
            openedAt: latestSession.openedAt || null,
            closedAt: latestSession.closedAt || null,
          }
        : null,
      sessions: {
        total:
          sessionStats.planned +
          sessionStats.open +
          sessionStats.paused +
          sessionStats.closed,
        ...sessionStats,
        recent: recentSessionRows,
      },
      stock: {
        today: {
          outKg: stockOutTodayAgg[0]?.totalKg || 0,
          byItem: stockTodayByItem,
        },
      },
      trends: {
        today: {
          issuedTokens: todayIssued,
          usedTokens: todayUsed,
          mismatchCount: todayMismatch,
          stockOutKg: stockOutTodayAgg[0]?.totalKg || 0,
        },
        last7Days: Array.from(trendMap.values()),
      },
      quality: {
        mismatchRate:
          issuedTokens > 0
            ? Number(((mismatchCount / issuedTokens) * 100).toFixed(2))
            : 0,
        fulfilmentRate:
          issuedTokens > 0
            ? Number(((usedTokens / issuedTokens) * 100).toFixed(2))
            : 0,
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

    const filter = {};

    Object.assign(filter, buildWardQuery(distributor));

    if (ward && ward !== "সব") {
      const explicitWard = buildWardMatchQuery(ward);
      if (explicitWard?.$or) {
        if (filter.$or) {
          filter.$and = filter.$and || [];
          filter.$and.push({ $or: filter.$or }, { $or: explicitWard.$or });
          delete filter.$or;
        } else {
          filter.$or = explicitWard.$or;
        }
      }
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
