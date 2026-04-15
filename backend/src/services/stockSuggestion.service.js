"use strict";

const DistributionSession = require("../models/DistributionSession");
const DistributionRecord = require("../models/DistributionRecord");
const StockLedger = require("../models/StockLedger");
const Token = require("../models/Token");
const Distributor = require("../models/Distributor");
const { normalizeWardNo } = require("../utils/ward.utils");
const { normalizeDivision } = require("../utils/division.utils");
const {
  STOCK_ITEMS,
  normalizeStockItem,
} = require("../utils/stock-items.utils");

function trendLabel(valuesAscendingByTime) {
  if (valuesAscendingByTime.length < 3) return "stable";
  const [session1, session2, session3] = valuesAscendingByTime;
  if (session3 > session2 && session2 > session1) return "increasing";
  if (session3 < session2 && session2 < session1) return "decreasing";
  return "stable";
}

function trendBangla(trend) {
  if (trend === "increasing") return "চাহিদা বাড়ছে";
  if (trend === "decreasing") return "চাহিদা কমছে";
  return "স্থিতিশীল";
}

function toFixed2(value) {
  return Number(Number(value || 0).toFixed(2));
}

function calcSuggestedStock(distributedAverage, insertedAverage) {
  const distributedTarget = Number(distributedAverage || 0) * 1.1;
  const insertedBaseline = Number(insertedAverage || 0) * 0.95;
  return Math.ceil(Math.max(distributedTarget, insertedBaseline, 0));
}

function calcAccuracyPercent(inserted, distributed) {
  const inVal = Number(inserted || 0);
  const outVal = Number(distributed || 0);
  if (inVal <= 0) return 0;
  return toFixed2(Math.min(100, (outVal / inVal) * 100));
}

async function distributedByItemFromRecords(sessionId) {
  const usedTokens = await Token.find({ sessionId, status: "Used" })
    .select("_id rationItem")
    .lean();
  if (!usedTokens.length) {
    return {
      totalDistributedKg: 0,
      consumerCount: 0,
      byItem: STOCK_ITEMS.reduce((acc, item) => {
        acc[item] = { distributedKg: 0, consumerCount: 0 };
        return acc;
      }, {}),
    };
  }

  const tokenIds = usedTokens.map((t) => t._id);
  const records = await DistributionRecord.find({ tokenId: { $in: tokenIds } })
    .select("tokenId actualKg")
    .lean();

  const tokenItemMap = new Map(
    usedTokens.map((t) => [String(t._id), normalizeStockItem(t.rationItem)]),
  );

  const byItem = STOCK_ITEMS.reduce((acc, item) => {
    acc[item] = { distributedKg: 0, consumerCount: 0 };
    return acc;
  }, {});

  for (const token of usedTokens) {
    const item = tokenItemMap.get(String(token._id));
    if (!item || !byItem[item]) continue;
    if (byItem[item]) byItem[item].consumerCount += 1;
  }

  for (const record of records) {
    const item = tokenItemMap.get(String(record.tokenId));
    if (!item || !byItem[item]) continue;
    byItem[item].distributedKg += Number(record.actualKg || 0);
  }

  for (const item of STOCK_ITEMS) {
    byItem[item].distributedKg = toFixed2(byItem[item].distributedKg);
  }

  const totalDistributedKg = toFixed2(
    Object.values(byItem).reduce(
      (sum, row) => sum + Number(row.distributedKg || 0),
      0,
    ),
  );

  return {
    totalDistributedKg,
    consumerCount: usedTokens.length,
    byItem,
  };
}

async function sessionItemMetrics(session) {
  const [usedTokenAgg, ledgerInAgg, ledgerOutAgg, recordFallback] =
    await Promise.all([
      Token.aggregate([
        { $match: { sessionId: session._id, status: "Used" } },
        {
          $group: {
            _id: "$rationItem",
            count: { $sum: 1 },
          },
        },
      ]),
      StockLedger.aggregate([
        {
          $match: {
            distributorId: session.distributorId,
            dateKey: session.dateKey,
            type: "IN",
          },
        },
        {
          $group: {
            _id: "$item",
            totalKg: { $sum: "$qtyKg" },
          },
        },
      ]),
      StockLedger.aggregate([
        {
          $match: {
            distributorId: session.distributorId,
            dateKey: session.dateKey,
            type: "OUT",
          },
        },
        {
          $group: {
            _id: "$item",
            totalKg: { $sum: "$qtyKg" },
          },
        },
      ]),
      distributedByItemFromRecords(session._id),
    ]);

  const byItem = STOCK_ITEMS.reduce((acc, item) => {
    acc[item] = { insertedKg: 0, distributedKg: 0, consumerCount: 0 };
    return acc;
  }, {});

  for (const row of usedTokenAgg) {
    const item = normalizeStockItem(row._id);
    if (!item || !byItem[item]) continue;
    const count = Number(row.count || 0);
    byItem[item].consumerCount += count;
  }

  for (const row of ledgerInAgg) {
    const item = normalizeStockItem(row._id);
    if (!item || !byItem[item]) continue;
    byItem[item].insertedKg += Number(row.totalKg || 0);
  }

  for (const row of ledgerOutAgg) {
    const item = normalizeStockItem(row._id);
    if (!item || !byItem[item]) continue;
    byItem[item].distributedKg += Number(row.totalKg || 0);
  }

  const ledgerOutTotal = Object.values(byItem).reduce(
    (sum, row) => sum + Number(row.distributedKg || 0),
    0,
  );

  if (ledgerOutTotal <= 0) {
    for (const item of STOCK_ITEMS) {
      byItem[item].distributedKg = Number(
        recordFallback.byItem[item]?.distributedKg || 0,
      );
      byItem[item].consumerCount = Math.max(
        byItem[item].consumerCount,
        Number(recordFallback.byItem[item]?.consumerCount || 0),
      );
    }
  }

  let totalInsertedKg = 0;
  let totalDistributedKg = 0;
  let consumerCount = 0;

  for (const item of STOCK_ITEMS) {
    byItem[item].insertedKg = toFixed2(byItem[item].insertedKg);
    byItem[item].distributedKg = toFixed2(byItem[item].distributedKg);
    totalInsertedKg += byItem[item].insertedKg;
    totalDistributedKg += byItem[item].distributedKg;
    consumerCount += Number(byItem[item].consumerCount || 0);
  }

  return {
    totalInsertedKg: toFixed2(totalInsertedKg),
    totalDistributedKg: toFixed2(totalDistributedKg),
    consumerCount,
    byItem,
  };
}

async function getStockSuggestion(
  divisionInput,
  wardNumber,
  unionName,
  itemInput,
) {
  const selectedItem = itemInput ? normalizeStockItem(itemInput) : null;
  const division = normalizeDivision(divisionInput);

  const distQuery = {};
  if (division) {
    distQuery.division = division;
  }
  if (wardNumber) {
    distQuery.wardNo = normalizeWardNo(wardNumber) || String(wardNumber).trim();
  }
  if (unionName) {
    distQuery.unionName = String(unionName).trim();
  }

  let distributorIds = null;
  if (division || wardNumber || unionName) {
    const distributors = await Distributor.find(distQuery).select("_id").lean();
    distributorIds = distributors.map((d) => d._id);
  }

  const sessionQuery = { status: "Closed" };
  if (distributorIds) {
    sessionQuery.distributorId = { $in: distributorIds };
  }

  const sessions = await DistributionSession.find(sessionQuery)
    .sort({ closedAt: -1, updatedAt: -1 })
    .limit(3)
    .select("_id distributorId dateKey closedAt")
    .lean();

  const ordered = [...sessions].reverse();
  const rows = [];
  const itemBreakdown = STOCK_ITEMS.reduce((acc, item) => {
    acc[item] = {
      movingAverage: 0,
      suggestedStock: 0,
      totalKg: 0,
      sessionsConsidered: 0,
      insertedAverage: 0,
      distributedAverage: 0,
      averageGap: 0,
      averageAccuracyPercent: 0,
      insertedTotalKg: 0,
      distributedTotalKg: 0,
    };
    return acc;
  }, {});

  for (const session of ordered) {
    const { totalInsertedKg, totalDistributedKg, consumerCount, byItem } =
      await sessionItemMetrics(session);

    for (const item of STOCK_ITEMS) {
      const insertedKg = Number(byItem[item]?.insertedKg || 0);
      const distributedKg = Number(byItem[item]?.distributedKg || 0);
      itemBreakdown[item].insertedTotalKg += insertedKg;
      itemBreakdown[item].distributedTotalKg += distributedKg;
      itemBreakdown[item].totalKg += distributedKg;
      itemBreakdown[item].sessionsConsidered += 1;
    }

    const effectiveInsertedKg = selectedItem
      ? Number(byItem[selectedItem]?.insertedKg || 0)
      : Number(totalInsertedKg || 0);
    const effectiveDistributedKg = selectedItem
      ? Number(byItem[selectedItem]?.distributedKg || 0)
      : Number(totalDistributedKg || 0);

    rows.push({
      sessionId: String(session._id),
      date:
        session.dateKey ||
        new Date(session.closedAt || Date.now()).toISOString().slice(0, 10),
      totalKg: toFixed2(effectiveDistributedKg),
      distributedKg: toFixed2(effectiveDistributedKg),
      insertedKg: toFixed2(effectiveInsertedKg),
      accuracyPercent: calcAccuracyPercent(
        effectiveInsertedKg,
        effectiveDistributedKg,
      ),
      consumerCount,
    });
  }

  const distributedValues = rows.map((r) => Number(r.distributedKg || 0));
  const insertedValues = rows.map((r) => Number(r.insertedKg || 0));

  const distributedAverage = distributedValues.length
    ? distributedValues.reduce((sum, v) => sum + v, 0) /
      distributedValues.length
    : 0;
  const insertedAverage = insertedValues.length
    ? insertedValues.reduce((sum, v) => sum + v, 0) / insertedValues.length
    : 0;
  const averageGap = Math.max(0, insertedAverage - distributedAverage);
  const averageAccuracyPercent =
    rows.length > 0
      ? rows.reduce((sum, row) => sum + Number(row.accuracyPercent || 0), 0) /
        rows.length
      : 0;

  const movingAverage = distributedAverage;
  const suggestedStock = calcSuggestedStock(
    distributedAverage,
    insertedAverage,
  );
  const trend = trendLabel(distributedValues);

  for (const item of STOCK_ITEMS) {
    const insertedTotal = Number(itemBreakdown[item].insertedTotalKg || 0);
    const distributedTotal = Number(
      itemBreakdown[item].distributedTotalKg || 0,
    );
    const count = Number(itemBreakdown[item].sessionsConsidered || 0);

    const itemInsertedAvg = count > 0 ? insertedTotal / count : 0;
    const itemDistributedAvg = count > 0 ? distributedTotal / count : 0;
    const itemGap = Math.max(0, itemInsertedAvg - itemDistributedAvg);
    const itemAccuracy = calcAccuracyPercent(
      itemInsertedAvg,
      itemDistributedAvg,
    );

    itemBreakdown[item].insertedAverage = toFixed2(itemInsertedAvg);
    itemBreakdown[item].distributedAverage = toFixed2(itemDistributedAvg);
    itemBreakdown[item].movingAverage = toFixed2(itemDistributedAvg);
    itemBreakdown[item].averageGap = toFixed2(itemGap);
    itemBreakdown[item].averageAccuracyPercent = toFixed2(itemAccuracy);
    itemBreakdown[item].suggestedStock = calcSuggestedStock(
      itemDistributedAvg,
      itemInsertedAvg,
    );
    itemBreakdown[item].totalKg = toFixed2(distributedTotal);
    itemBreakdown[item].insertedTotalKg = toFixed2(insertedTotal);
    itemBreakdown[item].distributedTotalKg = toFixed2(distributedTotal);
  }

  return {
    division: division || "all",
    ward: wardNumber || "all",
    union: unionName || "all",
    item: selectedItem || "all",
    last3Sessions: rows,
    movingAverage: toFixed2(movingAverage),
    distributedAverage: toFixed2(distributedAverage),
    insertedAverage: toFixed2(insertedAverage),
    averageGap: toFixed2(averageGap),
    averageAccuracyPercent: toFixed2(averageAccuracyPercent),
    suggestedStock,
    itemBreakdown,
    trend,
    trendBangla: trendBangla(trend),
    note: selectedItem
      ? `গত ৩টি সেশনে ${selectedItem} আইটেমের ইনসার্টেড বনাম ডিস্ট্রিবিউটেড গড় থেকে পরামর্শ করা হয়েছে।`
      : "গত ৩টি সেশনের ইনসার্টেড বনাম ডিস্ট্রিবিউটেড গড় থেকে পরামর্শ করা হয়েছে।",
    generatedAt: new Date().toISOString(),
  };
}

async function getSystemWideStockSuggestion(itemInput) {
  const distributors = await Distributor.find({})
    .select("division wardNo unionName")
    .lean();

  const seen = new Set();
  const wardPairs = [];
  for (const d of distributors) {
    const division = normalizeDivision(d.division || "");
    const ward = d.wardNo || "";
    const union = d.unionName || "";
    if (!ward) continue;
    if (!division) continue;
    const key = `${division}::${ward}::${union}`;
    if (seen.has(key)) continue;
    seen.add(key);
    wardPairs.push({ division, ward, union });
  }

  const wards = [];
  for (const pair of wardPairs) {
    wards.push(
      await getStockSuggestion(
        pair.division,
        pair.ward,
        pair.union || undefined,
        itemInput,
      ),
    );
  }

  const movingAverage = wards.reduce(
    (sum, w) => sum + Number(w.movingAverage || 0),
    0,
  );
  const suggestedStock = wards.reduce(
    (sum, w) => sum + Number(w.suggestedStock || 0),
    0,
  );
  const distributedAverage = wards.reduce(
    (sum, w) => sum + Number(w.distributedAverage || 0),
    0,
  );
  const insertedAverage = wards.reduce(
    (sum, w) => sum + Number(w.insertedAverage || 0),
    0,
  );
  const averageAccuracyPercent = wards.length
    ? wards.reduce((sum, w) => sum + Number(w.averageAccuracyPercent || 0), 0) /
      wards.length
    : 0;

  return {
    wards,
    item: itemInput ? normalizeStockItem(itemInput) || "all" : "all",
    systemTotal: {
      movingAverage: toFixed2(movingAverage),
      suggestedStock: Math.ceil(suggestedStock),
      distributedAverage: toFixed2(distributedAverage),
      insertedAverage: toFixed2(insertedAverage),
      averageAccuracyPercent: toFixed2(averageAccuracyPercent),
    },
    generatedAt: new Date().toISOString(),
  };
}

async function getSystemStockSuggestionSimple(itemInput) {
  const full = await getSystemWideStockSuggestion(itemInput);
  const global = await getStockSuggestion(
    undefined,
    undefined,
    undefined,
    itemInput,
  );
  return {
    item: full.item,
    movingAverage: full.systemTotal.movingAverage,
    suggestedStock: full.systemTotal.suggestedStock,
    distributedAverage: full.systemTotal.distributedAverage,
    insertedAverage: full.systemTotal.insertedAverage,
    averageAccuracyPercent: full.systemTotal.averageAccuracyPercent,
    trend: global.trend,
    trendBangla: global.trendBangla,
    sampleSessions: global.last3Sessions.length,
    generatedAt: full.generatedAt,
  };
}

module.exports = {
  getStockSuggestion,
  getSystemWideStockSuggestion,
  getSystemStockSuggestionSimple,
};
