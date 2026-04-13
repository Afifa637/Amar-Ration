"use strict";

const crypto = require("crypto");
const cron = require("node-cron");

const QRCode = require("../models/QRCode");
const Consumer = require("../models/Consumer");
const OMSCard = require("../models/OMSCard");
const Token = require("../models/Token");
const AuditLog = require("../models/AuditLog");
const { sendQrRegeneratedSms } = require("./sms.service");
const { writeAudit } = require("./audit.service");
const { buildOmsQrPayload } = require("../utils/qr-payload.utils");
const { normalizeWardNo } = require("../utils/ward.utils");

function monthRange(date = new Date()) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const last = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return { first, last };
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildStandardQrPayload(consumer, expiryDate) {
  const payload = buildOmsQrPayload({
    consumerCode: consumer.consumerCode,
    ward: normalizeWardNo(consumer.ward || consumer.wardNo || "") || "00",
    category: String(consumer.category || "A")
      .trim()
      .toUpperCase(),
    expiryDate,
  });

  if (!payload) {
    const err = new Error("Failed to build ARC payload");
    err.code = "QR_PAYLOAD_BUILD_FAILED";
    throw err;
  }

  return payload;
}

async function upsertValidQr(payload, validFrom, validTo) {
  return QRCode.findOneAndUpdate(
    { payloadHash: sha256(payload) },
    {
      $set: {
        payload,
        payloadHash: sha256(payload),
        validFrom,
        validTo,
        status: "Valid",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
}

async function rotateAllQRCodes() {
  const today = new Date();
  const { first, last } = monthRange(today);

  const expired = await QRCode.find({
    validTo: { $lt: today },
    status: "Valid",
  }).lean();

  let rotated = 0;
  let failed = 0;
  const failedIds = [];

  for (const oldQr of expired) {
    try {
      await QRCode.findByIdAndUpdate(oldQr._id, {
        $set: { status: "Expired" },
      });

      let consumer = await Consumer.findOne({ qrToken: oldQr.payload })
        .select("_id consumerCode ward wardNo category guardianPhone qrToken")
        .lean();

      // Backward compatibility: legacy payload AR:<token>:<timestamp>
      if (!consumer && String(oldQr.payload || "").startsWith("AR:")) {
        const legacyToken = String(oldQr.payload || "").split(":")[1] || "";
        if (legacyToken) {
          consumer = await Consumer.findOne({ qrToken: legacyToken })
            .select(
              "_id consumerCode ward wardNo category guardianPhone qrToken",
            )
            .lean();
        }
      }

      if (!consumer?._id) {
        failed += 1;
        failedIds.push(String(oldQr._id));
        continue;
      }

      const payload = buildStandardQrPayload(consumer, last);

      const nextQr = await upsertValidQr(payload, first, last);

      await Promise.all([
        Consumer.findByIdAndUpdate(consumer._id, {
          $set: { qrToken: payload },
        }),
        OMSCard.findOneAndUpdate(
          { consumerId: consumer._id },
          { $set: { qrCodeId: nextQr?._id } },
        ),
      ]);

      rotated += 1;
      if (consumer.guardianPhone) {
        void sendQrRegeneratedSms(consumer.guardianPhone);
      }
    } catch (err) {
      failed += 1;
      failedIds.push(String(oldQr._id));
      console.error("rotateAllQRCodes item error:", err?.message || err);
    }
  }

  return { rotated, failed, failedIds };
}

async function regenerateSingleQR(consumerId) {
  const consumer = await Consumer.findById(consumerId).lean();
  if (!consumer) {
    const error = new Error("Consumer not found");
    error.code = "NOT_FOUND";
    throw error;
  }

  const { first, last } = monthRange();

  const qrPayloadQuery = [{ payload: consumer.qrToken, status: "Valid" }];
  if (consumer.qrToken) {
    qrPayloadQuery.push({
      payload: {
        $regex: `^AR:${escapeRegex(consumer.qrToken)}:`,
      },
      status: "Valid",
    });
  }
  const card = await OMSCard.findOne({ consumerId: consumer._id })
    .select("_id qrCodeId")
    .lean();

  const expireQuery = { $or: qrPayloadQuery };
  if (card?.qrCodeId) {
    expireQuery.$or.push({ _id: card.qrCodeId });
  }

  await QRCode.updateMany(expireQuery, { $set: { status: "Expired" } });

  const payload = buildStandardQrPayload(consumer, last);

  const nextQr = await upsertValidQr(payload, first, last);

  await Promise.all([
    Consumer.findByIdAndUpdate(consumer._id, {
      $set: { qrToken: payload },
    }),
    OMSCard.findOneAndUpdate(
      { consumerId: consumer._id },
      { $set: { qrCodeId: nextQr?._id } },
    ),
  ]);

  if (consumer.guardianPhone) {
    void sendQrRegeneratedSms(consumer.guardianPhone);
  }

  return { newQrPayload: payload, validTo: last };
}

async function forceRegenerateAllQRCodes() {
  const { first, last } = monthRange();

  const consumers = await Consumer.find({})
    .select("_id consumerCode ward wardNo category guardianPhone qrToken")
    .lean();

  let updated = 0;
  let failed = 0;
  const failedIds = [];

  for (const consumer of consumers) {
    try {
      const payload = buildStandardQrPayload(consumer, last);

      const card = await OMSCard.findOne({ consumerId: consumer._id })
        .select("_id qrCodeId")
        .lean();

      const expireOr = [
        { payload: consumer.qrToken },
        {
          payload: {
            $regex: `^AR:${escapeRegex(consumer.qrToken)}:`,
          },
        },
      ];
      if (card?.qrCodeId) {
        expireOr.push({ _id: card.qrCodeId });
      }

      await QRCode.updateMany(
        {
          status: "Valid",
          $or: expireOr,
        },
        { $set: { status: "Expired" } },
      );

      const nextQr = await upsertValidQr(payload, first, last);

      await Promise.all([
        Consumer.findByIdAndUpdate(consumer._id, {
          $set: { qrToken: payload },
        }),
        OMSCard.findOneAndUpdate(
          { consumerId: consumer._id },
          { $set: { qrCodeId: nextQr?._id } },
        ),
      ]);

      if (consumer.guardianPhone) {
        void sendQrRegeneratedSms(consumer.guardianPhone);
      }

      updated += 1;
    } catch (error) {
      failed += 1;
      failedIds.push(String(consumer._id));
      console.error(
        "forceRegenerateAllQRCodes item error:",
        error?.message || error,
      );
    }
  }

  return {
    total: consumers.length,
    updated,
    failed,
    failedIds,
  };
}

async function flagInactiveConsumers(inactiveMonths = 2) {
  const cutoffDate = new Date(
    Date.now() - inactiveMonths * 30 * 24 * 60 * 60 * 1000,
  );

  const activeConsumers = await Consumer.find({
    status: { $in: ["Active", "inactive_review"] },
  })
    .select("_id status")
    .lean();

  let flagged = 0;
  let alreadyFlagged = 0;

  for (const consumer of activeConsumers) {
    const usedToken = await Token.findOne({
      consumerId: consumer._id,
      status: "Used",
      usedAt: { $gte: cutoffDate },
    })
      .select("_id")
      .lean();

    if (usedToken) continue;

    if (consumer.status === "inactive_review") {
      alreadyFlagged += 1;
      continue;
    }

    await Consumer.findByIdAndUpdate(consumer._id, {
      $set: { status: "inactive_review", flaggedInactiveAt: new Date() },
    });

    await AuditLog.create({
      actorType: "System",
      action: "auto_flagged_inactive",
      entityType: "Consumer",
      entityId: String(consumer._id),
      severity: "Warning",
      meta: { cutoffDate },
    });

    flagged += 1;
  }

  return { flagged, alreadyFlagged };
}

function initQRRotationCron() {
  cron.schedule("0 0 1 * *", async () => {
    try {
      console.log(`[QR Rotation Cron] Running at ${new Date().toISOString()}`);
      await rotateAllQRCodes();
    } catch (err) {
      console.error("[QR Rotation Cron] error:", err?.message || err);
    }
  });
}

function initEligibilityCron() {
  cron.schedule("0 9 1 * *", async () => {
    try {
      console.log("[Eligibility Cron] Flagging inactive consumers...");
      await flagInactiveConsumers(2);
    } catch (err) {
      console.error("[Eligibility Cron] error:", err?.message || err);
    }
  });
}

module.exports = {
  rotateAllQRCodes,
  forceRegenerateAllQRCodes,
  regenerateSingleQR,
  flagInactiveConsumers,
  initQRRotationCron,
  initEligibilityCron,
};
