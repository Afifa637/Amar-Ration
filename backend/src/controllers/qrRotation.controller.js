"use strict";

const {
  rotateAllQRCodes,
  forceRegenerateAllQRCodes,
  regenerateSingleQR,
  flagInactiveConsumers,
} = require("../services/qrRotation.service");
const Consumer = require("../models/Consumer");
const Token = require("../models/Token");
const { writeAudit } = require("../services/audit.service");
const { sendSms } = require("../services/sms.service");
const { normalizeDivision } = require("../utils/division.utils");
const { normalizeWardNo } = require("../utils/ward.utils");

async function triggerRotation(req, res) {
  try {
    const result = await rotateAllQRCodes();
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("triggerRotation error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function regenerateOne(req, res) {
  try {
    const result = await regenerateSingleQR(req.params.consumerId);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("regenerateOne error:", error);
    if (error.code === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Consumer not found",
        code: "NOT_FOUND",
      });
    }
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function forceResetAll(req, res) {
  try {
    const result = await forceRegenerateAllQRCodes();

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Central Admin",
      action: "QR_FORCE_RESET_ALL",
      entityType: "QRCode",
      severity: result.failed > 0 ? "Warning" : "Info",
      meta: {
        total: result.total,
        updated: result.updated,
        failed: result.failed,
      },
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("forceResetAll error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function listInactive(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const division = normalizeDivision(req.query.division);
    const ward = normalizeWardNo(req.query.ward || req.query.wardNo);

    if (ward && !division) {
      return res.status(400).json({
        success: false,
        message: "ওয়ার্ড ফিল্টার ব্যবহার করতে বিভাগ একসাথে দিতে হবে",
        code: "VALIDATION_ERROR",
      });
    }

    const query = { status: "inactive_review" };
    if (division) query.division = division;
    if (ward) query.ward = ward;
    const [total, rows] = await Promise.all([
      Consumer.countDocuments(query),
      Consumer.find(query)
        .select("name consumerCode division ward flaggedInactiveAt")
        .sort({ flaggedInactiveAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const enriched = await Promise.all(
      rows.map(async (row) => {
        const lastUsed = await Token.findOne({
          consumerId: row._id,
          status: "Used",
        })
          .select("usedAt")
          .sort({ usedAt: -1 })
          .lean();
        return {
          ...row,
          lastCollectionDate: lastUsed?.usedAt || null,
        };
      }),
    );

    return res.json({
      success: true,
      data: {
        items: enriched,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
    });
  } catch (error) {
    console.error("listInactive error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function reactivate(req, res) {
  try {
    const consumer = await Consumer.findByIdAndUpdate(
      req.params.consumerId,
      { $set: { status: "Active", flaggedInactiveAt: null } },
      { new: true },
    );
    if (!consumer) {
      return res.status(404).json({
        success: false,
        message: "Consumer not found",
        code: "NOT_FOUND",
      });
    }

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Central Admin",
      action: "eligibility_reactivated",
      entityType: "Consumer",
      entityId: String(consumer._id),
      severity: "Info",
    });

    if (consumer.guardianPhone) {
      void sendSms(
        consumer.guardianPhone,
        "আপনার Amar Ration অ্যাকাউন্ট পুনরায় সক্রিয় করা হয়েছে। পরবর্তী সেশনে কার্ড নিয়ে উপস্থিত থাকুন।",
        "ELIGIBILITY_REACTIVATED",
        consumer._id,
      );
    }

    return res.json({
      success: true,
      data: { consumerId: String(consumer._id) },
    });
  } catch (error) {
    console.error("reactivate error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function deactivate(req, res) {
  try {
    const consumer = await Consumer.findByIdAndUpdate(
      req.params.consumerId,
      { $set: { status: "inactive_review", flaggedInactiveAt: new Date() } },
      { new: true },
    );
    if (!consumer) {
      return res.status(404).json({
        success: false,
        message: "Consumer not found",
        code: "NOT_FOUND",
      });
    }

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Central Admin",
      action: "eligibility_deactivated",
      entityType: "Consumer",
      entityId: String(consumer._id),
      severity: "Warning",
    });

    if (consumer.guardianPhone) {
      void sendSms(
        consumer.guardianPhone,
        "আপনার Amar Ration অ্যাকাউন্ট সাময়িকভাবে নিষ্ক্রিয় হয়েছে। স্ট্যাটাস আপডেটের জন্য স্থানীয় অফিসে যোগাযোগ করুন।",
        "ELIGIBILITY_DEACTIVATED",
        consumer._id,
      );
    }

    return res.json({
      success: true,
      data: { consumerId: String(consumer._id) },
    });
  } catch (error) {
    console.error("deactivate error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function eligibilityStats(req, res) {
  try {
    const division = normalizeDivision(req.query.division);
    const ward = normalizeWardNo(req.query.ward || req.query.wardNo);

    if (ward && !division) {
      return res.status(400).json({
        success: false,
        message: "ওয়ার্ড ফিল্টার ব্যবহার করতে বিভাগ একসাথে দিতে হবে",
        code: "VALIDATION_ERROR",
      });
    }

    const base = {};
    if (division) base.division = division;
    if (ward) base.ward = ward;

    const [active, inactive_review, suspended, blacklisted] = await Promise.all(
      [
        Consumer.countDocuments({ ...base, status: "Active" }),
        Consumer.countDocuments({ ...base, status: "inactive_review" }),
        Consumer.countDocuments({ ...base, status: "suspended" }),
        Consumer.countDocuments({
          ...base,
          $or: [
            { status: "blacklisted" },
            { blacklistStatus: { $in: ["Temp", "Permanent"] } },
          ],
        }),
      ],
    );

    return res.json({
      success: true,
      data: { active, inactive_review, suspended, blacklisted },
    });
  } catch (error) {
    console.error("eligibilityStats error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function runEligibilityFlag(req, res) {
  try {
    const months = Math.max(1, Number(req.query.months) || 2);
    const result = await flagInactiveConsumers(months);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("runEligibilityFlag error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

module.exports = {
  triggerRotation,
  regenerateOne,
  forceResetAll,
  listInactive,
  reactivate,
  deactivate,
  eligibilityStats,
  runEligibilityFlag,
};
