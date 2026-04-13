"use strict";

const BlacklistAppeal = require("../models/BlacklistAppeal");
const BlacklistEntry = require("../models/BlacklistEntry");
const Consumer = require("../models/Consumer");
const { writeAudit } = require("../services/audit.service");
const { sendAppealResultSms } = require("../services/sms.service");

function makeAppealId() {
  return `APL-${Date.now()}`;
}

async function createAppeal(req, res) {
  try {
    const { consumerId, consumerCode, consumerPhone, reason, supportingInfo } =
      req.body || {};

    if ((!consumerId && !consumerCode) || !consumerPhone || !reason) {
      return res.status(400).json({
        success: false,
        message: "consumerId/consumerCode, consumerPhone, reason are required",
        code: "VALIDATION_ERROR",
      });
    }

    const consumer = consumerId
      ? await Consumer.findById(consumerId).lean()
      : await Consumer.findOne({
          consumerCode: String(consumerCode).trim(),
        }).lean();

    if (!consumer) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Consumer not found",
          code: "NOT_FOUND",
        });
    }

    const activeEntry = await BlacklistEntry.findOne({
      targetType: "Consumer",
      targetRefId: String(consumer._id),
      active: true,
    }).lean();

    if (!activeEntry) {
      return res
        .status(400)
        .json({
          success: false,
          message: "ভোক্তা কালো তালিকায় নেই",
          code: "VALIDATION_ERROR",
        });
    }

    const pending = await BlacklistAppeal.findOne({
      consumerId: consumer._id,
      status: { $in: ["pending", "under_review"] },
    }).lean();

    if (pending) {
      return res.status(409).json({
        success: false,
        message: "Pending appeal already exists",
        code: "DUPLICATE",
      });
    }

    const appeal = await BlacklistAppeal.create({
      appealId: makeAppealId(),
      consumerId: consumer._id,
      consumerPhone,
      blacklistEntryId: activeEntry._id,
      reason,
      supportingInfo,
    });

    return res.status(201).json({
      success: true,
      data: { appealId: appeal.appealId },
    });
  } catch (error) {
    console.error("createAppeal error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function listAppeals(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const query = {};
    if (req.query.status) query.status = String(req.query.status);
    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      if (req.query.startDate)
        query.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) query.createdAt.$lte = new Date(req.query.endDate);
    }

    const [total, items] = await Promise.all([
      BlacklistAppeal.countDocuments(query),
      BlacklistAppeal.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.json({
      success: true,
      data: {
        items,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
    });
  } catch (error) {
    console.error("listAppeals error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function reviewAppeal(req, res) {
  try {
    const { decision, adminNote } = req.body || {};
    if (!["approved", "rejected"].includes(String(decision))) {
      return res.status(400).json({
        success: false,
        message: "decision must be approved or rejected",
        code: "VALIDATION_ERROR",
      });
    }

    const appeal = await BlacklistAppeal.findOne({
      appealId: req.params.appealId,
    }).lean();
    if (!appeal) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Appeal not found",
          code: "NOT_FOUND",
        });
    }

    const update = {
      status: decision,
      adminNote: String(adminNote || ""),
      reviewedBy: req.user.userId,
      reviewedAt: new Date(),
    };

    const updated = await BlacklistAppeal.findOneAndUpdate(
      { appealId: req.params.appealId },
      { $set: update },
      { new: true },
    ).lean();

    if (decision === "approved") {
      await BlacklistEntry.findByIdAndUpdate(appeal.blacklistEntryId, {
        $set: { active: false },
      });
      await Consumer.findByIdAndUpdate(appeal.consumerId, {
        $set: { status: "Active", blacklistStatus: "None" },
      });
      await writeAudit({
        actorUserId: req.user.userId,
        actorType: "Central Admin",
        action: "blacklist_appeal_approved",
        entityType: "BlacklistAppeal",
        entityId: String(updated._id),
        severity: "Info",
      });
    } else {
      await writeAudit({
        actorUserId: req.user.userId,
        actorType: "Central Admin",
        action: "blacklist_appeal_rejected",
        entityType: "BlacklistAppeal",
        entityId: String(updated._id),
        severity: "Warning",
      });
    }

    void sendAppealResultSms(appeal.consumerPhone, decision === "approved");

    return res.json({
      success: true,
      data: { decision },
    });
  } catch (error) {
    console.error("reviewAppeal error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

module.exports = {
  createAppeal,
  listAppeals,
  reviewAppeal,
};
