"use strict";

const fs = require("fs");

const DistributionSession = require("../models/DistributionSession");
const Token = require("../models/Token");
const DistributionRecord = require("../models/DistributionRecord");
const StockLedger = require("../models/StockLedger");
const Distributor = require("../models/Distributor");
const Consumer = require("../models/Consumer");
const AuditLog = require("../models/AuditLog");
const { generateReconciliationReport } = require("../services/receipt.service");
const {
  hydrateRecordItemFields,
  roundKg,
} = require("../services/distributionRecord.service");
const {
  STOCK_ITEMS,
  normalizeStockItem,
} = require("../utils/stock-items.utils");
const {
  normalizeDivision,
  isSameDivision,
} = require("../utils/division.utils");
const { normalizeWardNo, isSameWard } = require("../utils/ward.utils");
const { assertSessionAccess } = require("../services/access-control.service");

function emptyItemTotals() {
  return STOCK_ITEMS.reduce((acc, item) => {
    acc[item] = { expectedKg: 0, actualKg: 0, stockInKg: 0, stockOutKg: 0 };
    return acc;
  }, {});
}

async function countEligibleConsumers(distributorId) {
  const distributor = await Distributor.findById(distributorId)
    .select("_id division ward wardNo")
    .lean();

  if (!distributor?._id) return 0;

  const baseConsumers = await Consumer.find({
    status: "Active",
    $or: [
      { createdByDistributor: distributor._id },
      {
        ward: normalizeWardNo(distributor.wardNo || distributor.ward),
      },
    ],
  })
    .select("division ward createdByDistributor")
    .lean();

  const normalizedDivision = normalizeDivision(distributor.division);
  const normalizedWard = normalizeWardNo(
    distributor.wardNo || distributor.ward,
  );

  return baseConsumers.filter((consumer) => {
    const byOwner =
      String(consumer.createdByDistributor || "") === String(distributor._id);
    const byWard = isSameWard(normalizedWard, consumer.ward || "");
    if (!byOwner && !byWard) return false;

    if (!normalizedDivision) return true;
    return isSameDivision(normalizedDivision, consumer.division);
  }).length;
}

async function buildPayload(sessionId) {
  const session = await DistributionSession.findById(sessionId).lean();
  if (!session) return null;

  const [tokens, stockInRows, stockOutRows, eligiblePeople, recentLogs] =
    await Promise.all([
      Token.find({ sessionId: session._id }).select("_id status").lean(),
      StockLedger.find({
        distributorId: session.distributorId,
        dateKey: session.dateKey,
        type: "IN",
      })
        .select("qtyKg item")
        .lean(),
      StockLedger.find({
        distributorId: session.distributorId,
        dateKey: session.dateKey,
        type: "OUT",
      })
        .select("qtyKg item")
        .lean(),
      countEligibleConsumers(session.distributorId),
      AuditLog.find({
        entityId: String(session._id),
        entityType: "DistributionSession",
      })
        .sort({ createdAt: -1 })
        .limit(8)
        .select("action severity createdAt")
        .lean(),
    ]);

  const tokenIds = tokens.map((t) => t._id);
  const detailedTokens = await Token.find({ _id: { $in: tokenIds } })
    .select("_id rationItem rationQtyKg status consumerId")
    .lean();
  const tokenById = new Map(detailedTokens.map((t) => [String(t._id), t]));

  const records = tokenIds.length
    ? await DistributionRecord.find({
        tokenId: { $in: tokenIds },
      })
        .select(
          "tokenId mismatch item expectedKg actualKg expectedByItem actualByItem",
        )
        .lean()
    : [];

  const byItem = emptyItemTotals();

  for (const record of records) {
    const token = tokenById.get(String(record.tokenId));
    if (!token) continue;

    const hydrated = hydrateRecordItemFields({
      item: record.item || token.rationItem,
      expectedKg: record.expectedKg || token.rationQtyKg,
      actualKg: record.actualKg,
      expectedByItem: record.expectedByItem,
      actualByItem: record.actualByItem,
    });

    for (const item of STOCK_ITEMS) {
      if (!byItem[item]) continue;
      byItem[item].expectedKg += Number(hydrated.expectedByItem[item] || 0);
      byItem[item].actualKg += Number(hydrated.actualByItem[item] || 0);
    }
  }

  for (const row of stockInRows) {
    const item = normalizeStockItem(row.item);
    if (!item || !byItem[item]) continue;
    byItem[item].stockInKg += Number(row.qtyKg || 0);
  }

  for (const row of stockOutRows) {
    const item = normalizeStockItem(row.item);
    if (!item || !byItem[item]) continue;
    byItem[item].stockOutKg += Number(row.qtyKg || 0);
  }

  for (const item of STOCK_ITEMS) {
    byItem[item].expectedKg = roundKg(byItem[item].expectedKg);
    byItem[item].actualKg = roundKg(byItem[item].actualKg);
    byItem[item].stockInKg = roundKg(byItem[item].stockInKg);
    byItem[item].stockOutKg = roundKg(byItem[item].stockOutKg);
  }

  const tokenIdsSet = new Set(tokens.map((t) => String(t._id)));
  const mismatchCount = records.filter(
    (r) => tokenIdsSet.has(String(r.tokenId)) && r.mismatch,
  ).length;

  const stockIn = stockInRows.reduce((s, x) => s + Number(x.qtyKg || 0), 0);
  const stockOut = stockOutRows.reduce((s, x) => s + Number(x.qtyKg || 0), 0);
  const servedPeople = new Set(
    detailedTokens
      .filter((t) => t.status === "Used")
      .map((t) => String(t.consumerId || ""))
      .filter(Boolean),
  ).size;
  const remainingPeople = Math.max(
    0,
    Number(eligiblePeople || 0) - servedPeople,
  );

  return {
    sessionId: String(session._id),
    status: session.status,
    tokensIssued: tokens.length,
    tokensUsed: tokens.filter((t) => t.status === "Used").length,
    mismatchCount,
    stockIn: Number(stockIn.toFixed(3)),
    stockOut: Number(stockOut.toFixed(3)),
    remainingStock: Number((stockIn - stockOut).toFixed(3)),
    servedPeople,
    eligiblePeople: Number(eligiblePeople || 0),
    remainingPeople,
    byItem,
    recentActivity: recentLogs.map((log) => ({
      action: log.action,
      severity: log.severity,
      createdAt: log.createdAt,
    })),
    lastUpdated: new Date().toISOString(),
  };
}

async function streamLiveHealth(req, res) {
  try {
    await assertSessionAccess(req.user, req.params.sessionId);
    const payload = await buildPayload(req.params.sessionId);
    if (!payload) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
        code: "NOT_FOUND",
      });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const send = async () => {
      const data = await buildPayload(req.params.sessionId);
      if (!data) return;
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    await send();
    const timer = setInterval(() => {
      void send();
    }, 5000);

    let closed = false;
    const closeStream = () => {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      try {
        res.end();
      } catch {
        // ignore
      }
    };

    req.on("close", closeStream);
    req.on("error", closeStream);
    res.on("close", closeStream);
  } catch (error) {
    if (error?.status) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message, code: error.code });
    }
    console.error("streamLiveHealth error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function downloadReconciliationReport(req, res) {
  try {
    await assertSessionAccess(req.user, req.params.sessionId);
    const filePath = await generateReconciliationReport(req.params.sessionId);
    res.setHeader("Content-Type", "application/pdf");
    return fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    if (error?.status) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message, code: error.code });
    }
    console.error("downloadReconciliationReport error:", error);
    if (error.code === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Session not found",
        code: "NOT_FOUND",
      });
    }
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function generateReportManually(req, res) {
  try {
    await assertSessionAccess(req.user, req.params.sessionId);
    const filePath = await generateReconciliationReport(req.params.sessionId);
    return res.json({ success: true, data: { filePath } });
  } catch (error) {
    if (error?.status) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message, code: error.code });
    }
    console.error("generateReportManually error:", error);
    if (error.code === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Session not found",
        code: "NOT_FOUND",
      });
    }
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

module.exports = {
  streamLiveHealth,
  downloadReconciliationReport,
  generateReportManually,
};
