const Distributor = require("../models/Distributor");
const StockLedger = require("../models/StockLedger");
const DistributionSession = require("../models/DistributionSession");
const User = require("../models/User");
const { writeAudit } = require("../services/audit.service");
const { notifyUser } = require("../services/notification.service");
const { normalizeDivision } = require("../utils/division.utils");
const { normalizeWardNo } = require("../utils/ward.utils");
const {
  STOCK_ITEMS,
  normalizeStockItem,
} = require("../utils/stock-items.utils");

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function ensureDistributorProfile(reqUser) {
  if (reqUser.userType === "Admin") return null;

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

async function resolveStockDistributor(req, distributorIdInput) {
  if (req.user.userType === "Admin") {
    if (!distributorIdInput) return null;
    return Distributor.findById(distributorIdInput);
  }

  return ensureDistributorProfile(req.user);
}

// POST /api/stock/in
async function addStockIn(req, res) {
  try {
    const { distributorId, qtyKg, item, ref, dateKey, division, ward, wardNo } =
      req.body || {};

    let distributor = await resolveStockDistributor(req, distributorId);

    if (req.user.userType === "Admin" && !distributor) {
      const normalizedDivision = normalizeDivision(division);
      const normalizedWard = normalizeWardNo(wardNo || ward);

      if (!normalizedDivision || !normalizedWard) {
        return res.status(400).json({
          success: false,
          message:
            "Admin stock allocation এর জন্য distributorId অথবা division+ward প্রয়োজন",
          code: "VALIDATION_ERROR",
        });
      }

      const matches = await Distributor.find({
        division: normalizedDivision,
        $or: [{ wardNo: normalizedWard }, { ward: normalizedWard }],
      })
        .select("_id authorityStatus")
        .lean();

      if (!matches.length) {
        return res.status(404).json({
          success: false,
          message:
            "নির্বাচিত division+ward এর জন্য কোনো distributor পাওয়া যায়নি",
          code: "NOT_FOUND",
        });
      }

      const activeMatches = matches.filter(
        (m) => m.authorityStatus === "Active",
      );
      const resolved = activeMatches.length ? activeMatches : matches;

      if (resolved.length > 1) {
        return res.status(409).json({
          success: false,
          message:
            "এই division+ward এ একাধিক distributor আছে। নির্দিষ্ট distributor নির্বাচন করুন",
          code: "AMBIGUOUS_DISTRIBUTOR",
        });
      }

      distributor = await Distributor.findById(resolved[0]._id);
    }

    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    if (req.user.userType === "Admin" && !distributor) {
      return res.status(400).json({
        success: false,
        message: "distributorId is required for admin stock allocation",
      });
    }

    const qty = Number(qtyKg);
    if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty < 1) {
      return res.status(400).json({
        success: false,
        message: "স্টক IN এর পরিমাণ ১ কেজি বা তার বেশি পূর্ণসংখ্যা হতে হবে।",
      });
    }

    const normalizedItem = normalizeStockItem(item);
    if (!normalizedItem) {
      return res.status(400).json({
        success: false,
        message: `item must be one of: ${STOCK_ITEMS.join(", ")}`,
      });
    }

    const effectiveDateKey = dateKey || todayKey();

    if (distributor?._id) {
      const startedSession = await DistributionSession.findOne({
        distributorId: distributor._id,
        dateKey: effectiveDateKey,
        status: { $in: ["Open", "Paused", "Closed"] },
      })
        .select("_id status")
        .lean();

      if (startedSession) {
        return res.status(400).json({
          success: false,
          message:
            "Stock IN is locked because session already started for this date",
        });
      }
    }

    const entry = await StockLedger.create({
      distributorId: distributor ? distributor._id : undefined,
      dateKey: effectiveDateKey,
      type: "IN",
      item: normalizedItem,
      qtyKg: qty,
      ref: ref || undefined,
    });

    await writeAudit({
      actorUserId: req.user.userId,
      actorType:
        req.user.userType === "Admin" ? "Central Admin" : "Distributor",
      action: "STOCK_IN_RECORDED",
      entityType: "StockLedger",
      entityId: String(entry._id),
      severity: "Info",
      meta: {
        distributorId: distributor ? String(distributor._id) : null,
        qtyKg: qty,
        dateKey: entry.dateKey,
        item: entry.item,
      },
    });

    if (req.user.userType === "Admin" && distributor?.userId) {
      await notifyUser(distributor.userId, {
        title: "Stock allocated",
        message: `${qty}kg ${normalizedItem} stock allocated for ${entry.dateKey}.`,
        meta: {
          stockLedgerId: String(entry._id),
          dateKey: entry.dateKey,
          qtyKg: qty,
          item: normalizedItem,
        },
      });
    }

    res.status(201).json({
      success: true,
      message: "Stock IN recorded",
      data: { entry },
    });
  } catch (error) {
    console.error("addStockIn error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// GET /api/stock/summary
async function getStockSummary(req, res) {
  try {
    const distributorId = String(req.query.distributorId || "").trim();
    const distributor = await resolveStockDistributor(
      req,
      distributorId || null,
    );

    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    if (req.user.userType === "Admin" && distributorId && !distributor) {
      return res
        .status(404)
        .json({ success: false, message: "Distributor not found" });
    }

    const query = {};
    const activeSession = distributor
      ? await DistributionSession.findOne({
          distributorId: distributor._id,
          status: { $in: ["Open", "Paused"] },
        })
          .sort({ createdAt: -1 })
          .select("dateKey")
          .lean()
      : null;

    const targetDateKey = String(
      req.query.dateKey || activeSession?.dateKey || todayKey(),
    ).trim();
    if (targetDateKey) query.dateKey = targetDateKey;
    if (distributor) query.distributorId = distributor._id;

    const entries = await StockLedger.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const totals = entries.reduce(
      (acc, entry) => {
        const qty = Number(entry.qtyKg || 0);
        if (entry.type === "IN") acc.stockInKg += qty;
        if (entry.type === "OUT") acc.stockOutKg += qty;
        if (entry.type === "ADJUST") acc.adjustKg += qty;
        return acc;
      },
      { stockInKg: 0, stockOutKg: 0, adjustKg: 0 },
    );

    const byItem = STOCK_ITEMS.reduce((acc, itemName) => {
      acc[itemName] = {
        stockInKg: 0,
        stockOutKg: 0,
        adjustKg: 0,
        balanceKg: 0,
      };
      return acc;
    }, {});

    for (const entry of entries) {
      const itemName = normalizeStockItem(entry.item);
      if (!itemName) continue;
      const qty = Number(entry.qtyKg || 0);
      if (!byItem[itemName]) continue;
      if (entry.type === "IN") byItem[itemName].stockInKg += qty;
      if (entry.type === "OUT") byItem[itemName].stockOutKg += qty;
      if (entry.type === "ADJUST") byItem[itemName].adjustKg += qty;
    }

    for (const itemName of Object.keys(byItem)) {
      const v = byItem[itemName];
      v.stockInKg = Number(v.stockInKg.toFixed(3));
      v.stockOutKg = Number(v.stockOutKg.toFixed(3));
      v.adjustKg = Number(v.adjustKg.toFixed(3));
      v.balanceKg = Number(
        (v.stockInKg - v.stockOutKg + v.adjustKg).toFixed(3),
      );
    }

    const balanceKg = Number(
      (totals.stockInKg - totals.stockOutKg + totals.adjustKg).toFixed(3),
    );

    res.json({
      success: true,
      data: {
        dateKey: targetDateKey,
        distributorId: distributor ? String(distributor._id) : null,
        summary: {
          stockInKg: Number(totals.stockInKg.toFixed(3)),
          stockOutKg: Number(totals.stockOutKg.toFixed(3)),
          adjustKg: Number(totals.adjustKg.toFixed(3)),
          balanceKg,
        },
        byItem,
        entries,
      },
    });
  } catch (error) {
    console.error("getStockSummary error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = {
  addStockIn,
  getStockSummary,
};
