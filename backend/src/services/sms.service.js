"use strict";

const SmsOutbox = require("../models/SmsOutbox");
const axios = require("axios");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SMS_STATUS = {
  QUEUED: "Queued",
  SENT: "Sent",
  FAILED: "Failed",
};

function normalizeBdPhone(phone) {
  const cleaned = String(phone || "").replace(/\D/g, "");
  if (cleaned.startsWith("880") && cleaned.length === 13) {
    return `0${cleaned.slice(3)}`;
  }
  if (cleaned.startsWith("0") && cleaned.length === 11) return cleaned;
  if (cleaned.length === 10) return `0${cleaned}`;
  return String(phone || "").trim();
}

async function sendSingleSms(phone, message) {
  const gatewayUrl = process.env.SMS_API_URL || process.env.SMS_GATEWAY_URL;
  const apiKey = process.env.SMS_API_KEY;
  const senderId = process.env.SMS_SENDER_ID || "AmarRation";

  if (!gatewayUrl || !apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[SMS-DEV] To: ${phone} | Message: ${message}`);
      return { success: true, mock: true };
    }
    throw new Error("SMS API is not configured");
  }

  const payload = {
    api_key: apiKey,
    senderid: senderId,
    number: normalizeBdPhone(phone).replace(/^0/, "880"),
    message: String(message || ""),
  };

  const resp = await axios.post(gatewayUrl, payload, {
    timeout: 10000,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
  });

  const body =
    typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data || {});
  const success =
    resp.status >= 200 &&
    resp.status < 300 &&
    (body.includes("1701") || /success|ok|accepted/i.test(body));

  if (!success) {
    throw new Error(`Gateway rejected: ${body.slice(0, 150)}`);
  }

  return { success: true, response: resp.data };
}

async function sendSms(phone, message, trigger = "GENERIC", consumerId = null) {
  const normalized = normalizeBdPhone(phone);
  const text = String(message || "").trim();

  if (!normalized || !text) {
    return {
      success: false,
      status: "failed",
      attemptCount: 0,
      message: "phone/message required",
    };
  }

  let attemptCount = 0;
  let lastError = null;

  try {
    for (let i = 0; i < 3; i += 1) {
      attemptCount += 1;
      try {
        const sent = await sendSingleSms(normalized, text);
        await SmsOutbox.create({
          phone: normalized,
          message: text,
          trigger,
          consumerId: consumerId || undefined,
          status: SMS_STATUS.SENT,
          attemptCount,
          sentAt: new Date(),
          meta: { direct: true, sent },
          retryCount: Math.max(0, attemptCount - 1),
          lastAttemptAt: new Date(),
        });
        return { success: true, status: SMS_STATUS.SENT, attemptCount };
      } catch (err) {
        lastError = err;
        if (i < 2) await sleep(1000);
      }
    }

    await SmsOutbox.create({
      phone: normalized,
      message: text,
      trigger,
      consumerId: consumerId || undefined,
      status: SMS_STATUS.FAILED,
      attemptCount,
      sentAt: new Date(),
      error: lastError?.message || "SMS send failed",
      retryCount: Math.max(0, attemptCount - 1),
      lastAttemptAt: new Date(),
      meta: { direct: true },
    });

    return {
      success: false,
      status: SMS_STATUS.FAILED,
      attemptCount,
      message: lastError?.message || "SMS send failed",
    };
  } catch (fatal) {
    console.error("sendSms fatal error:", fatal?.message || fatal);
    return {
      success: false,
      status: SMS_STATUS.FAILED,
      attemptCount,
      message: fatal?.message || "SMS service failure",
    };
  }
}

function todayDDMMYYYY() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

async function sendDistributionSms(consumer, tokenCode, actualKg, itemName) {
  try {
    const phone = consumer?.guardianPhone || consumer?.phone;
    const msg = `আমার রেশন: আপনি আজ ${actualKg} কেজি ${itemName || "পণ্য"} পেয়েছেন। টোকেন: ${tokenCode}। তারিখ: ${todayDDMMYYYY()}। সমস্যায়: 16XXX`;
    return await sendSms(phone, msg, "DISTRIBUTION", consumer?._id);
  } catch {
    return { success: false, status: "failed", attemptCount: 0 };
  }
}

async function sendMismatchSms(consumer, tokenCode, expectedKg, actualKg) {
  try {
    const phone = consumer?.guardianPhone || consumer?.phone;
    const msg = `সতর্কতা! আপনার ${expectedKg} কেজির বদলে ${actualKg} কেজি রেকর্ড হয়েছে। অভিযোগ করুন: 16XXX। টোকেন: ${tokenCode}`;
    return await sendSms(phone, msg, "MISMATCH", consumer?._id);
  } catch {
    return { success: false, status: "failed", attemptCount: 0 };
  }
}

async function sendQrRegeneratedSms(phone) {
  return sendSms(
    phone,
    "আপনার নতুন রেশন কার্ড তৈরি হয়েছে। নিকটস্থ বিতরণ কেন্দ্র থেকে সংগ্রহ করুন।",
    "QR_REGENERATED",
  );
}

async function sendBlacklistSms(phone) {
  return sendSms(
    phone,
    "আপনার রেশন কার্ড সাময়িকভাবে স্থগিত। অভিযোগ: 16XXX",
    "BLACKLISTED",
  );
}

async function sendComplaintAcknowledgeSms(phone, complaintId) {
  return sendSms(
    phone,
    `আপনার অভিযোগ ${complaintId} গ্রহণ করা হয়েছে। সমাধান হলে SMS পাবেন।`,
    "COMPLAINT_ACK",
  );
}

async function sendComplaintResolvedSms(phone, complaintId) {
  return sendSms(
    phone,
    `আপনার অভিযোগ ${complaintId} সমাধান করা হয়েছে। ধন্যবাদ।`,
    "COMPLAINT_RESOLVED",
  );
}

async function sendAppealResultSms(phone, approved) {
  const msg = approved
    ? "আপনার আবেদন গৃহীত হয়েছে। কার্ড পুনরায় সক্রিয়।"
    : "আপনার আবেদন প্রত্যাখ্যাত হয়েছে। বিস্তারিত: 16XXX";
  return sendSms(phone, msg, "APPEAL_RESULT");
}

async function processSmsQueue() {
  const pending = await SmsOutbox.find({
    status: { $in: [SMS_STATUS.QUEUED, "queued", "Queued"] },
    retryCount: { $lt: 3 },
  })
    .sort({ createdAt: 1 })
    .limit(10)
    .lean();

  if (!pending.length) return;

  for (const sms of pending) {
    try {
      await sendSingleSms(sms.phone, sms.message);
      await SmsOutbox.findByIdAndUpdate(sms._id, {
        $set: {
          status: "Sent",
          attemptCount: Number(sms.attemptCount || 0) + 1,
          lastAttemptAt: new Date(),
          error: null,
        },
      });
    } catch (err) {
      const retryCount = (sms.retryCount || 0) + 1;
      await SmsOutbox.findByIdAndUpdate(sms._id, {
        $set: {
          status: retryCount >= 3 ? SMS_STATUS.FAILED : SMS_STATUS.QUEUED,
          retryCount,
          attemptCount: Number(sms.attemptCount || 0) + 1,
          lastAttemptAt: new Date(),
          error: err?.message || "SMS send failed",
        },
      });
      console.error(
        `[SMS] Failed to send to ${sms.phone}: ${err?.message || "Unknown error"}`,
      );
    }
  }
}

module.exports = {
  sendSms,
  sendDistributionSms,
  sendMismatchSms,
  sendQrRegeneratedSms,
  sendBlacklistSms,
  sendComplaintAcknowledgeSms,
  sendComplaintResolvedSms,
  sendAppealResultSms,
  processSmsQueue,
  sendSingleSms,
};
