const DistributionRecord = require("../models/DistributionRecord");
const Token = require("../models/Token");
const Distributor = require("../models/Distributor");
const User = require("../models/User");
const BlacklistEntry = require("../models/BlacklistEntry");
const SystemSetting = require("../models/SystemSetting");
const { writeAudit } = require("./audit.service");
const { notifyAdmins, notifyUser } = require("./notification.service");

function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
}

function toPositiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function getFraudConfig() {
  const setting = await SystemSetting.findOne({
    key: "distributor:global:settings",
  })
    .select("value")
    .lean();

  const threshold = toPositiveNumber(
    setting?.value?.fraud?.autoBlacklistMismatchCount,
    3,
  );
  const temporaryBlockDays = toPositiveNumber(
    setting?.value?.fraud?.temporaryBlockDays,
    7,
  );

  return { threshold, temporaryBlockDays };
}

async function getDistributorMismatchCount(distributorId) {
  const tokens = await Token.find({ distributorId }).select("_id").lean();
  const tokenIds = tokens.map((t) => t._id);
  if (tokenIds.length === 0) return 0;

  return DistributionRecord.countDocuments({
    tokenId: { $in: tokenIds },
    mismatch: true,
    createdAt: { $gte: thirtyDaysAgo() },
  });
}

async function flagDistributorForFraud(
  distributorId,
  mismatchCount,
  threshold,
) {
  const distributor = await Distributor.findById(distributorId).lean();
  if (!distributor) return { flagged: false, reason: "DISTRIBUTOR_NOT_FOUND" };

  const alreadyActive = await BlacklistEntry.findOne({
    targetType: "Distributor",
    targetRefId: String(distributorId),
    active: true,
  }).lean();

  if (alreadyActive) {
    return { flagged: false, reason: "ALREADY_BLACKLISTED" };
  }

  const { temporaryBlockDays } = await getFraudConfig();
  const expiresAt = new Date(Date.now() + temporaryBlockDays * 86400000);

  const entry = await BlacklistEntry.create({
    distributorId: distributor._id,
    createdByUserId: distributor.userId,
    targetType: "Distributor",
    targetRefId: String(distributor._id),
    blockType: "Temporary",
    reason: `Auto-flagged: ${mismatchCount} mismatches in last 30 days (threshold ${threshold})`,
    active: true,
    expiresAt,
  });

  await Distributor.findByIdAndUpdate(distributor._id, {
    $set: { authorityStatus: "Suspended" },
  });
  await User.findByIdAndUpdate(distributor.userId, {
    $set: { authorityStatus: "Suspended", status: "Suspended" },
  });

  await writeAudit({
    actorUserId: distributor.userId,
    actorType: "System",
    action: "AUTO_FRAUD_FLAG",
    entityType: "Distributor",
    entityId: String(distributor._id),
    severity: "Critical",
    meta: {
      mismatchCount,
      threshold,
      blacklistEntryId: String(entry._id),
      expiresAt,
    },
  });

  await notifyUser(distributor.userId, {
    title: "অ্যাকাউন্ট স্থগিত",
    message:
      "ওজন অমিলের সংখ্যা সীমা অতিক্রম করায় আপনার অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে স্থগিত করা হয়েছে।",
    meta: {
      distributorId: String(distributor._id),
      mismatchCount,
      threshold,
      expiresAt,
    },
  });

  const distributorUser = await User.findById(distributor.userId)
    .select("name wardNo")
    .lean();
  const distributorWardNo = distributorUser?.wardNo || "N/A";
  const distributorName = distributorUser?.name || "ডিস্ট্রিবিউটর";

  await notifyAdmins({
    title: `🚨 জালিয়াতি সতর্কতা — ওয়ার্ড ${distributorWardNo}`,
    message: `${distributorName} এর অ্যাকাউন্ট ${mismatchCount} বার ওজন অমিলের কারণে স্বয়ংক্রিয়ভাবে স্থগিত।`,
    meta: {
      distributorId: String(distributor._id),
      userId: String(distributor.userId),
      distributorWardNo,
      distributorName,
      mismatchCount,
      threshold,
      expiresAt,
    },
  });

  return { flagged: true, entryId: String(entry._id), expiresAt };
}

async function checkDistributorMismatchCount(distributorId) {
  if (!distributorId)
    return { flagged: false, reason: "MISSING_DISTRIBUTOR_ID" };

  const { threshold } = await getFraudConfig();
  const mismatchCount = await getDistributorMismatchCount(distributorId);

  if (mismatchCount < threshold) {
    return {
      flagged: false,
      mismatchCount,
      threshold,
      reason: "BELOW_THRESHOLD",
    };
  }

  const result = await flagDistributorForFraud(
    distributorId,
    mismatchCount,
    threshold,
  );
  return {
    ...result,
    mismatchCount,
    threshold,
  };
}

module.exports = {
  checkDistributorMismatchCount,
  flagDistributorForFraud,
};
