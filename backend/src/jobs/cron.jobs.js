"use strict";

const cron = require("node-cron");
const BlacklistEntry = require("../models/BlacklistEntry");
const Consumer = require("../models/Consumer");
const Distributor = require("../models/Distributor");
const User = require("../models/User");
const SystemSetting = require("../models/SystemSetting");
const { writeAudit } = require("../services/audit.service");
const { notifyAdmins } = require("../services/notification.service");
const { processSmsQueue } = require("../services/sms.service");
const { rotateAllQRCodes } = require("../services/qrRotation.service");

async function expireBlacklists() {
  try {
    const expired = await BlacklistEntry.find({
      blockType: "Temporary",
      active: true,
      expiresAt: { $lte: new Date() },
    }).lean();

    if (!expired.length) return;

    console.log(
      `[Cron] Expiring ${expired.length} temporary blacklist entries`,
    );

    for (const entry of expired) {
      await BlacklistEntry.findByIdAndUpdate(entry._id, {
        $set: { active: false },
      });

      if (entry.targetType === "Consumer") {
        await Consumer.findByIdAndUpdate(entry.targetRefId, {
          $set: { blacklistStatus: "None" },
        });
        continue;
      }

      if (entry.targetType === "Distributor") {
        const distributor = await Distributor.findById(
          entry.targetRefId,
        ).lean();
        if (!distributor) continue;

        await User.findByIdAndUpdate(distributor.userId, {
          $set: { status: "Active", authorityStatus: "Active" },
          $inc: { tokenVersion: 1 },
        });

        await Distributor.findByIdAndUpdate(distributor._id, {
          $set: { authorityStatus: "Active" },
        });

        await notifyAdmins({
          title: "Distributor Auto-Unblocked",
          message: `Temporary blacklist expired. Distributor ID: ${entry.targetRefId}. Review if re-suspend is required.`,
          meta: {
            distributorId: String(entry.targetRefId),
            type: "BLACKLIST_EXPIRED",
          },
        });

        await writeAudit({
          actorUserId: null,
          actorType: "System",
          action: "BLACKLIST_EXPIRED",
          entityType: "Distributor",
          entityId: String(entry.targetRefId),
          severity: "Info",
          meta: { blacklistEntryId: String(entry._id) },
        });
      }
    }
  } catch (err) {
    console.error("[Cron] expireBlacklists error:", err.message);
  }
}

async function rotateExpiredQrCodes() {
  try {
    const result = await rotateAllQRCodes();
    if (!result.rotated && !result.failed) {
      console.log("[Cron] No expired AR QR codes to rotate");
      return;
    }

    console.log(
      `[Cron] AR QR rotation done. rotated=${result.rotated}, failed=${result.failed}`,
    );
  } catch (err) {
    console.error("[Cron] rotateExpiredQrCodes error:", err.message);
  }
}

async function flushSmsQueue() {
  try {
    await processSmsQueue();
  } catch (err) {
    console.error("[Cron] flushSmsQueue error:", err.message);
  }
}

async function processPendingFraudSuspensions() {
  try {
    const dueUsers = await User.find({
      userType: "Distributor",
      pendingSuspend: true,
      pendingSuspendAt: { $lte: new Date() },
    })
      .select("_id pendingSuspendAt pendingSuspendReason tokenVersion")
      .lean();

    if (!dueUsers.length) return;

    const globalSetting = await SystemSetting.findOne({
      key: "distributor:global:settings",
    })
      .select("value.fraud.temporaryBlockDays")
      .lean();
    const blockDays = Math.max(
      1,
      Number(globalSetting?.value?.fraud?.temporaryBlockDays || 7) || 7,
    );

    for (const user of dueUsers) {
      const distributor = await Distributor.findOne({
        userId: user._id,
      }).lean();

      await User.findByIdAndUpdate(user._id, {
        $set: {
          authorityStatus: "Suspended",
          status: "Suspended",
          pendingSuspend: false,
          pendingSuspendAt: null,
          pendingSuspendReason: null,
        },
        $inc: { tokenVersion: 1 },
      });

      if (distributor) {
        await Distributor.findByIdAndUpdate(distributor._id, {
          $set: { authorityStatus: "Suspended" },
        });

        const activeEntry = await BlacklistEntry.findOne({
          targetType: "Distributor",
          targetRefId: String(distributor._id),
          active: true,
        }).lean();

        if (!activeEntry) {
          const expiresAt = new Date(Date.now() + blockDays * 86400000);
          await BlacklistEntry.create({
            distributorId: distributor._id,
            createdByUserId: user._id,
            targetType: "Distributor",
            targetRefId: String(distributor._id),
            blockType: "Temporary",
            reason:
              user.pendingSuspendReason ||
              "Auto-suspended after 24h fraud review grace period",
            active: true,
            expiresAt,
          });
        }

        await writeAudit({
          actorUserId: user._id,
          actorType: "System",
          action: "AUTO_FRAUD_FLAG",
          entityType: "Distributor",
          entityId: String(distributor._id),
          severity: "Critical",
          meta: {
            reason: user.pendingSuspendReason || null,
            reviewDeadline: user.pendingSuspendAt || null,
          },
        });

        await notifyAdmins({
          title: "Distributor auto-suspended (post-review window)",
          message:
            "24-hour admin review window ended. Distributor has been auto-suspended.",
          meta: {
            distributorId: String(distributor._id),
            userId: String(user._id),
          },
        });
      }
    }
  } catch (err) {
    console.error("[Cron] processPendingFraudSuspensions error:", err.message);
  }
}

function startCronJobs() {
  cron.schedule("0 * * * *", expireBlacklists, { timezone: "Asia/Dhaka" });
  cron.schedule("0 2 * * *", rotateExpiredQrCodes, { timezone: "Asia/Dhaka" });
  cron.schedule("*/15 * * * *", processPendingFraudSuspensions, {
    timezone: "Asia/Dhaka",
  });
  cron.schedule("* * * * *", flushSmsQueue, { timezone: "Asia/Dhaka" });

  console.log(
    "✅ Cron jobs started: blacklist-expiry, qr-rotation, fraud-review-suspend, sms-flush",
  );
}

module.exports = {
  startCronJobs,
  expireBlacklists,
  rotateExpiredQrCodes,
  processPendingFraudSuspensions,
  flushSmsQueue,
};
