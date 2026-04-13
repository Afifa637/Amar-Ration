"use strict";

const Token = require("../models/Token");
const DistributionSession = require("../models/DistributionSession");
const DistributionRecord = require("../models/DistributionRecord");
const Distributor = require("../models/Distributor");
const User = require("../models/User");

const MONTHS_BN = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];

function riskFromScore(score) {
  if (score >= 76) return "CRITICAL";
  if (score >= 51) return "HIGH";
  if (score >= 26) return "MEDIUM";
  return "LOW";
}

function recommendationOf(level) {
  if (level === "CRITICAL") return "অবিলম্বে স্থগিত করুন";
  if (level === "HIGH") return "তদন্ত শুরু করুন";
  if (level === "MEDIUM") return "নিয়মিত পর্যবেক্ষণ করুন";
  return "স্বাভাবিক কার্যক্রম";
}

async function getDistributorName(distributorId) {
  const distributor = await Distributor.findById(distributorId)
    .select("userId")
    .lean();
  if (!distributor?.userId) return "N/A";
  const user = await User.findById(distributor.userId).select("name").lean();
  return user?.name || "N/A";
}

async function calculateDistributorFraudScore(distributorId, days = 30) {
  const periodDays = Math.max(1, Number(days) || 30);
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const [tokens, sessions] = await Promise.all([
    Token.find({ distributorId, createdAt: { $gte: since } }).lean(),
    DistributionSession.find({
      distributorId,
      createdAt: { $gte: since },
    }).lean(),
  ]);

  const tokenIds = tokens.map((t) => t._id);
  const records = tokenIds.length
    ? await DistributionRecord.find({ tokenId: { $in: tokenIds } }).lean()
    : [];
  const recordMap = new Map(records.map((r) => [String(r.tokenId), r]));

  const totalTokens = tokens.length;
  const mismatchCount = tokens.filter(
    (t) => recordMap.get(String(t._id))?.mismatch === true,
  ).length;
  const mismatchRate = totalTokens ? mismatchCount / totalTokens : 0;
  const signal1 = Math.round(mismatchRate * 40);

  const manualCount = tokens.filter((t) => {
    const rec = recordMap.get(String(t._id));
    return t.iotVerified === false && rec && Number(rec.actualKg) > 0;
  }).length;
  const manualRate = totalTokens ? manualCount / totalTokens : 0;
  const signal2 = Math.round(manualRate * 25);

  const shortfalls = [];
  for (const token of tokens) {
    const rec = recordMap.get(String(token._id));
    if (!rec) continue;
    if (
      Number(rec.actualKg) > 0 &&
      Number(rec.actualKg) < Number(token.rationQtyKg || 0)
    ) {
      shortfalls.push(
        Number(token.rationQtyKg || 0) - Number(rec.actualKg || 0),
      );
    }
  }

  let signal3 = 0;
  if (shortfalls.length) {
    const avgShortfall =
      shortfalls.reduce((s, v) => s + v, 0) / shortfalls.length;
    if (avgShortfall > 1.0) signal3 = 20;
    else if (avgShortfall > 0.5) signal3 = 10;
  }

  let totalHours = 0;
  for (const session of sessions) {
    const start = new Date(session.openedAt || session.createdAt).getTime();
    const end = new Date(session.closedAt || Date.now()).getTime();
    if (end > start) totalHours += (end - start) / (1000 * 60 * 60);
  }
  const avgPerHour = totalHours > 0 ? totalTokens / totalHours : 0;
  let signal4 = 0;
  if (avgPerHour > 30) signal4 = 15;
  else if (avgPerHour > 20) signal4 = 7;

  const score = Math.min(100, signal1 + signal2 + signal3 + signal4);
  const riskLevel = riskFromScore(score);
  const recommendation = recommendationOf(riskLevel);

  return {
    distributorId,
    distributorName: await getDistributorName(distributorId),
    totalTokens,
    score,
    riskLevel,
    breakdown: { signal1, signal2, signal3, signal4 },
    recommendation,
    calculatedAt: new Date().toISOString(),
  };
}

async function getSystemFraudReport(days = 30) {
  const distributors = await Distributor.find({ authorityStatus: "Active" })
    .select("_id")
    .lean();

  const rows = [];
  for (const distributor of distributors) {
    rows.push(await calculateDistributorFraudScore(distributor._id, days));
  }

  rows.sort((a, b) => b.score - a.score);

  const summary = {
    total: rows.length,
    critical: rows.filter((r) => r.riskLevel === "CRITICAL").length,
    high: rows.filter((r) => r.riskLevel === "HIGH").length,
    medium: rows.filter((r) => r.riskLevel === "MEDIUM").length,
    low: rows.filter((r) => r.riskLevel === "LOW").length,
  };

  return {
    generatedAt: new Date().toISOString(),
    period: Number(days) || 30,
    distributors: rows,
    summary,
  };
}

function getMonthRange(year, month) {
  const y = Number(year) || new Date().getFullYear();
  const m = Number(month) || new Date().getMonth() + 1;
  const monthSafe = Math.min(12, Math.max(1, m));
  const start = new Date(y, monthSafe - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, monthSafe, 0, 23, 59, 59, 999);
  return { year: y, month: monthSafe, start, end };
}

function performanceBadgeByRating(rating) {
  if (rating === 5) return "অনুকরণীয়";
  if (rating === 4) return "ভালো";
  if (rating === 3) return "গ্রহণযোগ্য";
  if (rating === 2) return "সতর্কতা প্রয়োজন";
  return "জরুরি পর্যালোচনা";
}

async function getDistributorMonthlyPerformance(distributorId, year, month) {
  const range = getMonthRange(year, month);

  const [distributorName, sessions, fraudScore] = await Promise.all([
    getDistributorName(distributorId),
    DistributionSession.find({
      distributorId,
      createdAt: { $gte: range.start, $lte: range.end },
    })
      .select("_id")
      .lean(),
    calculateDistributorFraudScore(distributorId, 30),
  ]);

  const sessionIds = sessions.map((s) => s._id);
  const totalSessions = sessions.length;

  if (!sessionIds.length) {
    return {
      distributorId: String(distributorId),
      distributorName,
      year: range.year,
      month: range.month,
      monthName: MONTHS_BN[range.month - 1] || "",
      totalSessions,
      totalDistributions: 0,
      mismatchCount: 0,
      mismatchRate: 0,
      iotVerifiedCount: 0,
      iotRate: 0,
      fraudScore: Number(fraudScore?.score || 0),
      riskLevel: fraudScore?.riskLevel || "LOW",
      rating: 1,
      badge: performanceBadgeByRating(1),
      generatedAt: new Date().toISOString(),
    };
  }

  const usedTokens = await Token.find({
    distributorId,
    sessionId: { $in: sessionIds },
    status: "Used",
  })
    .select("_id iotVerified")
    .lean();

  const tokenIds = usedTokens.map((t) => t._id);
  const totalDistributions = usedTokens.length;
  const iotVerifiedCount = usedTokens.filter(
    (t) => t.iotVerified === true,
  ).length;

  const mismatchCount = tokenIds.length
    ? await DistributionRecord.countDocuments({
        tokenId: { $in: tokenIds },
        mismatch: true,
      })
    : 0;

  const mismatchRate = totalDistributions
    ? mismatchCount / totalDistributions
    : 0;
  const iotRate = totalDistributions
    ? iotVerifiedCount / totalDistributions
    : 0;

  let base = 5;
  if (mismatchRate > 0.1) base -= 2;
  else if (mismatchRate > 0.05) base -= 1;
  if (iotRate < 0.5) base -= 1;
  if (Number(fraudScore?.score || 0) > 50) base -= 1;
  const rating = Math.max(1, base);

  return {
    distributorId: String(distributorId),
    distributorName,
    year: range.year,
    month: range.month,
    monthName: MONTHS_BN[range.month - 1] || "",
    totalSessions,
    totalDistributions,
    mismatchCount,
    mismatchRate: Number(mismatchRate.toFixed(4)),
    iotVerifiedCount,
    iotRate: Number(iotRate.toFixed(4)),
    fraudScore: Number(fraudScore?.score || 0),
    riskLevel: fraudScore?.riskLevel || "LOW",
    rating,
    badge: performanceBadgeByRating(rating),
    generatedAt: new Date().toISOString(),
  };
}

async function getAllDistributorMonthlyPerformance(year, month) {
  const activeDistributors = await Distributor.find({
    authorityStatus: "Active",
  })
    .select("_id")
    .lean();

  const rows = [];
  for (const distributor of activeDistributors) {
    rows.push(
      await getDistributorMonthlyPerformance(distributor._id, year, month),
    );
  }

  rows.sort((a, b) => {
    if (a.rating !== b.rating) return a.rating - b.rating;
    return Number(b.fraudScore || 0) - Number(a.fraudScore || 0);
  });

  const totalDistributors = rows.length;
  const avgRating = totalDistributors
    ? Number(
        (
          rows.reduce((sum, row) => sum + Number(row.rating || 0), 0) /
          totalDistributors
        ).toFixed(2),
      )
    : 0;

  return {
    year: Number(year) || new Date().getFullYear(),
    month: Number(month) || new Date().getMonth() + 1,
    distributors: rows,
    summary: {
      totalDistributors,
      avgRating,
      topPerformer: rows.length ? rows[rows.length - 1] : null,
      worstPerformer: rows.length ? rows[0] : null,
    },
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  calculateDistributorFraudScore,
  getSystemFraudReport,
  getDistributorMonthlyPerformance,
  getAllDistributorMonthlyPerformance,
};
