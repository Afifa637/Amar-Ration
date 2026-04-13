"use strict";

const DistributionSession = require("../models/DistributionSession");
const DistributionRecord = require("../models/DistributionRecord");
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

async function sumActualKgBySession(sessionId) {
  const usedTokens = await Token.find({ sessionId, status: "Used" })
    .select("_id rationItem")
    .lean();
  if (!usedTokens.length) {
    return {
      totalKg: 0,
      consumerCount: 0,
      byItem: STOCK_ITEMS.reduce((acc, item) => {
        acc[item] = { totalKg: 0, consumerCount: 0 };
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
    acc[item] = { totalKg: 0, consumerCount: 0 };
    return acc;
  }, {});

  for (const token of usedTokens) {
    const item = tokenItemMap.get(String(token._id));
    if (!item || !byItem[item]) continue;
    if (byItem[item]) byItem[item].consumerCount += 1;
  }

  for (const record of records) {
    const item = tokenItemMap.get(String(record.tokenId));
    if (!byItem[item]) continue;
    byItem[item].totalKg += Number(record.actualKg || 0);
  }

  for (const item of Object.keys(byItem)) {
    byItem[item].totalKg = Number(byItem[item].totalKg.toFixed(2));
  }

  const totalKg = Object.values(byItem).reduce(
    (sum, row) => sum + Number(row.totalKg || 0),
    0,
  );

  return {
    totalKg,
    consumerCount: usedTokens.length,
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
    .select("_id dateKey closedAt")
    .lean();

  const ordered = [...sessions].reverse();
  const rows = [];
  const itemBreakdown = STOCK_ITEMS.reduce((acc, item) => {
    acc[item] = {
      movingAverage: 0,
      suggestedStock: 0,
      totalKg: 0,
      sessionsConsidered: 0,
    };
    return acc;
  }, {});

  for (const session of ordered) {
    const { totalKg, consumerCount, byItem } = await sumActualKgBySession(
      session._id,
    );

    for (const item of STOCK_ITEMS) {
      const kg = Number(byItem[item]?.totalKg || 0);
      itemBreakdown[item].totalKg += kg;
      itemBreakdown[item].sessionsConsidered += 1;
    }

    const effectiveTotalKg = selectedItem
      ? Number(byItem[selectedItem]?.totalKg || 0)
      : totalKg;

    rows.push({
      sessionId: String(session._id),
      date:
        session.dateKey ||
        new Date(session.closedAt || Date.now()).toISOString().slice(0, 10),
      totalKg: Number(effectiveTotalKg.toFixed(2)),
      consumerCount,
    });
  }

  const values = rows.map((r) => Number(r.totalKg || 0));
  const movingAverage = values.length
    ? values.reduce((sum, v) => sum + v, 0) / values.length
    : 0;
  const suggestedStock = Math.ceil(movingAverage * 1.1);
  const trend = trendLabel(values);

  for (const item of STOCK_ITEMS) {
    const total = Number(itemBreakdown[item].totalKg || 0);
    const count = Number(itemBreakdown[item].sessionsConsidered || 0);
    const avg = count > 0 ? total / count : 0;
    itemBreakdown[item].movingAverage = Number(avg.toFixed(2));
    itemBreakdown[item].suggestedStock = Math.ceil(avg * 1.1);
    itemBreakdown[item].totalKg = Number(total.toFixed(2));
  }

  return {
    division: division || "all",
    ward: wardNumber || "all",
    union: unionName || "all",
    item: selectedItem || "all",
    last3Sessions: rows,
    movingAverage: Number(movingAverage.toFixed(2)),
    suggestedStock,
    itemBreakdown,
    trend,
    trendBangla: trendBangla(trend),
    note: selectedItem
      ? `গত ৩টি সেশনে ${selectedItem} আইটেমের গড় ভিত্তিতে হিসাব করা হয়েছে।`
      : "গত ৩টি সেশনের গড় ভিত্তিতে হিসাব করা হয়েছে।",
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

  return {
    wards,
    item: itemInput ? normalizeStockItem(itemInput) || "all" : "all",
    systemTotal: {
      movingAverage: Number(movingAverage.toFixed(2)),
      suggestedStock: Math.ceil(suggestedStock),
    },
    generatedAt: new Date().toISOString(),
  };
}

async function getSystemStockSuggestionSimple(itemInput) {
  const full = await getSystemWideStockSuggestion(itemInput);
  return {
    item: full.item,
    movingAverage: full.systemTotal.movingAverage,
    suggestedStock: full.systemTotal.suggestedStock,
    generatedAt: full.generatedAt,
  };
}

module.exports = {
  getStockSuggestion,
  getSystemWideStockSuggestion,
  getSystemStockSuggestionSimple,
};
