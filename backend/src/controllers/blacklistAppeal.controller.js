"use strict";

const fs = require("fs");
const path = require("path");
const BlacklistAppeal = require("../models/BlacklistAppeal");
const BlacklistEntry = require("../models/BlacklistEntry");
const Consumer = require("../models/Consumer");
const Distributor = require("../models/Distributor");
const { writeAudit } = require("../services/audit.service");
const { sendAppealResultSms } = require("../services/sms.service");
const { normalizeDivision } = require("../utils/division.utils");
const { normalizeWardNo } = require("../utils/ward.utils");

function makeAppealId() {
  return `APL-${Date.now()}`;
}

function getAppealUploadsDir() {
  return path.resolve(
    process.cwd(),
    process.env.APPEAL_UPLOADS_DIR || "./uploads/appeals",
  );
}

async function createAppeal(req, res) {
  try {
    const { consumerId, consumerCode, consumerPhone, reason, supportingInfo } =
      req.body || {};

    if ((!consumerId && !consumerCode) || !reason) {
      return res.status(400).json({
        success: false,
        message: "consumerId/consumerCode and reason are required",
        code: "VALIDATION_ERROR",
      });
    }

    const distributor = await Distributor.findOne({ userId: req.user.userId })
      .select("_id division wardNo ward")
      .lean();

    if (!distributor) {
      return res.status(403).json({
        success: false,
        message: "ডিস্ট্রিবিউটর প্রোফাইল পাওয়া যায়নি",
        code: "FORBIDDEN",
      });
    }

    const consumer = consumerId
      ? await Consumer.findById(consumerId).lean()
      : await Consumer.findOne({
          consumerCode: String(consumerCode).trim(),
        }).lean();

    if (!consumer) {
      return res.status(404).json({
        success: false,
        message: "Consumer not found",
        code: "NOT_FOUND",
      });
    }

    const distributorDivision = normalizeDivision(distributor.division || "");
    const distributorWard =
      normalizeWardNo(distributor.wardNo || distributor.ward || "") || "";
    const consumerDivision = normalizeDivision(consumer.division || "");
    const consumerWard = normalizeWardNo(consumer.ward || "") || "";

    if (
      distributorDivision &&
      consumerDivision &&
      distributorDivision !== consumerDivision
    ) {
      return res.status(403).json({
        success: false,
        message: "এই ভোক্তা আপনার ডিভিশনের বাইরে",
        code: "OUT_OF_SCOPE",
      });
    }

    if (distributorWard && consumerWard && distributorWard !== consumerWard) {
      return res.status(403).json({
        success: false,
        message: "এই ভোক্তা আপনার ওয়ার্ডের বাইরে",
        code: "OUT_OF_SCOPE",
      });
    }

    const activeEntry = await BlacklistEntry.findOne({
      targetType: "Consumer",
      targetRefId: String(consumer._id),
      active: true,
    }).lean();

    if (!activeEntry) {
      return res.status(400).json({
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

    const files = Array.isArray(req.files) ? req.files : [];
    const attachments = files.map((file) => ({
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      relativePath: path
        .join("uploads", "appeals", file.filename)
        .replace(/\\/g, "/"),
    }));

    const normalizedPhone = String(
      consumerPhone || consumer.guardianPhone || "",
    ).trim();

    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: "consumerPhone is required",
        code: "VALIDATION_ERROR",
      });
    }

    const appeal = await BlacklistAppeal.create({
      appealId: makeAppealId(),
      consumerId: consumer._id,
      consumerPhone: normalizedPhone,
      blacklistEntryId: activeEntry._id,
      distributorUserId: req.user.userId,
      distributorRefId: distributor._id,
      division: consumerDivision || distributorDivision || "",
      ward: consumerWard || distributorWard || "",
      reason,
      supportingInfo,
      attachments,
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
    if (req.query.division) {
      query.division = normalizeDivision(String(req.query.division));
    }
    if (req.query.ward) {
      query.ward =
        normalizeWardNo(String(req.query.ward)) || String(req.query.ward);
    }
    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      if (req.query.startDate)
        query.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) query.createdAt.$lte = new Date(req.query.endDate);
    }

    const [total, items] = await Promise.all([
      BlacklistAppeal.countDocuments(query),
      BlacklistAppeal.find(query)
        .populate("consumerId", "consumerCode name division ward")
        .populate("distributorUserId", "name phone")
        .populate("blacklistEntryId", "reason blockType")
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

async function downloadAppealFile(req, res) {
  try {
    const { appealId, fileId } = req.params;

    const appeal = await BlacklistAppeal.findOne({ appealId })
      .select("appealId distributorUserId attachments")
      .lean();

    if (!appeal) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Appeal not found",
          code: "NOT_FOUND",
        });
    }

    if (
      req.user.userType === "Distributor" &&
      String(appeal.distributorUserId) !== String(req.user.userId)
    ) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const fileMeta = (appeal.attachments || []).find(
      (item) => String(item._id) === String(fileId),
    );

    if (!fileMeta) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Attachment not found",
          code: "NOT_FOUND",
        });
    }

    const baseDir = getAppealUploadsDir();
    const absolutePath = path.resolve(process.cwd(), fileMeta.relativePath);

    if (!absolutePath.startsWith(baseDir) || !fs.existsSync(absolutePath)) {
      return res
        .status(404)
        .json({ success: false, message: "File not found", code: "NOT_FOUND" });
    }

    return res.download(absolutePath, fileMeta.originalName);
  } catch (error) {
    console.error("downloadAppealFile error:", error);
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
      return res.status(404).json({
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
  downloadAppealFile,
  reviewAppeal,
};
