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

  const distributorUser = await User.findById(distributor.userId)
    .select(
      "_id name wardNo status authorityStatus pendingSuspend pendingSuspendAt",
    )
    .lean();
  if (!distributorUser) return { flagged: false, reason: "USER_NOT_FOUND" };

  if (
    ["Suspended", "Revoked"].includes(distributorUser.authorityStatus) ||
    distributorUser.status === "Suspended"
  ) {
    return { flagged: false, reason: "ALREADY_SUSPENDED" };
  }

  if (distributorUser.pendingSuspend) {
    return {
      flagged: false,
      pendingReview: true,
      reviewDeadline: distributorUser.pendingSuspendAt || null,
      reason: "PENDING_REVIEW",
    };
  }

  const alreadyActive = await BlacklistEntry.findOne({
    targetType: "Distributor",
    targetRefId: String(distributor._id),
    active: true,
  }).lean();

  if (alreadyActive) {
    return { flagged: false, reason: "ALREADY_BLACKLISTED" };
  }

  const { temporaryBlockDays } = await getFraudConfig();
  const expiresAt = new Date(Date.now() + temporaryBlockDays * 86400000);
  const reviewDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const entry = await BlacklistEntry.create({
    distributorId: distributor._id,
    createdByUserId: distributor.userId,
    targetType: "Distributor",
    targetRefId: String(distributor._id),
    blockType: "Temporary",
    reason: `Mismatch count ${mismatchCount} reached threshold ${threshold}`,
    active: true,
    expiresAt,
  });

  const suspendedUser = await User.findByIdAndUpdate(
    distributor.userId,
    {
      $set: {
        pendingSuspend: true,
        pendingSuspendAt: reviewDeadline,
        pendingSuspendReason: `Mismatch count ${mismatchCount} reached threshold ${threshold}`,
      },
      $inc: { tokenVersion: 1 },
    },
    { new: true },
  ).lean();

  await writeAudit({
    actorUserId: distributor.userId,
    actorType: "System",
    action: "AUTO_FRAUD_FLAG",
    entityType: "Distributor",
    entityId: String(distributor._id),
    severity: "Critical",
    meta: {
      action: "AUTO_FRAUD_REVIEW_PENDING",
      mismatchCount,
      threshold,
      blacklistEntryId: String(entry._id),
      reviewDeadline,
      expiresAt,
    },
  });

  await notifyUser(distributor.userId, {
    title: "অ্যাকাউন্ট রিভিউতে আছে",
    message:
      "ওজন অমিলের সংখ্যা সীমা অতিক্রম করেছে। ২৪ ঘণ্টার মধ্যে অ্যাডমিন রিভিউ হবে।",
    meta: {
      distributorId: String(distributor._id),
      mismatchCount,
      threshold,
      reviewDeadline,
      expiresAt,
    },
  });

  const distributorWardNo = distributorUser?.wardNo || "N/A";
  const distributorName = distributorUser?.name || "ডিস্ট্রিবিউটর";
  await notifyAdmins({
    title: "Fraud review pending",
    message: `${distributorName} (${distributorWardNo}) এর অ্যাকাউন্ট ${mismatchCount} বার ওজন অমিলের কারণে রিভিউ কিউতে আছে (২৪ ঘণ্টা)।`,
    meta: {
      distributorId: String(distributor._id),
      userId: String(distributor.userId),
      distributorWardNo,
      mismatchCount,
      threshold,
      reviewDeadline,
      expiresAt,
      tokenVersion: suspendedUser?.tokenVersion,
    },
  });

  return {
    flagged: true,
    pendingReview: true,
    reviewDeadline,
    expiresAt,
    blacklistEntryId: String(entry._id),
  };
}

async function checkDistributorMismatchCount(distributorId) {
  if (!distributorId) {
    return { flagged: false, reason: "DISTRIBUTOR_NOT_FOUND" };
  }

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
