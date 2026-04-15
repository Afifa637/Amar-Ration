const AuditReportRequest = require("../models/AuditReportRequest");
const User = require("../models/User");
const Distributor = require("../models/Distributor");
const path = require("path");
const fs = require("fs");
const { writeAudit } = require("../services/audit.service");
const {
  notifyAdmins,
  notifyUser,
} = require("../services/notification.service");

function getAuditUploadsDir() {
  return path.resolve(
    process.cwd(),
    process.env.AUDIT_REPORT_UPLOADS_DIR || "./uploads/audit-reports",
  );
}

async function applyOverdueSuspension(request) {
  if (!request?.dueAt) return false;
  if (!["Requested", "Submitted"].includes(request.status)) return false;
  if (request.overdueNotified) return false;
  if (new Date(request.dueAt) >= new Date()) return false;

  await AuditReportRequest.findByIdAndUpdate(request._id, {
    $set: { overdueNotified: true },
  });

  await User.findByIdAndUpdate(request.distributorUserId, {
    $set: { authorityStatus: "Suspended" },
  });

  await Distributor.findOneAndUpdate(
    { userId: request.distributorUserId },
    { $set: { authorityStatus: "Suspended" } },
  );

  await writeAudit({
    actorUserId: request.distributorUserId,
    actorType: "Distributor",
    action: "AUDIT_REPORT_OVERDUE",
    entityType: "AuditReportRequest",
    entityId: String(request._id),
    severity: "Critical",
  });

  await notifyUser(request.distributorUserId, {
    title: "Account suspended",
    message:
      "Audit report overdue. Your account is suspended until admin approval.",
    meta: { requestId: String(request._id) },
  });

  await notifyAdmins({
    title: "Distributor suspended (audit overdue)",
    message: "Distributor failed to submit audit report within 7 days.",
    meta: { requestId: String(request._id) },
  });

  return true;
}

async function listAuditReportRequests(req, res) {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    const items = await AuditReportRequest.find(query)
      .sort({ createdAt: -1 })
      .populate("distributorUserId", "name phone email ward")
      .populate("auditLogId")
      .lean();

    const distributorUserIds = Array.from(
      new Set(
        items
          .map((item) =>
            String(item.distributorUserId?._id || item.distributorUserId || ""),
          )
          .filter(Boolean),
      ),
    );
    const distributorProfiles = distributorUserIds.length
      ? await Distributor.find({ userId: { $in: distributorUserIds } })
          .select("_id userId division wardNo ward")
          .lean()
      : [];
    const profileMap = new Map(
      distributorProfiles.map((profile) => [String(profile.userId), profile]),
    );

    const enrichedItems = items.map((item) => {
      const userId = String(
        item.distributorUserId?._id || item.distributorUserId || "",
      );
      const profile = profileMap.get(userId);
      const log =
        item.auditLogId && typeof item.auditLogId === "object"
          ? item.auditLogId
          : null;
      return {
        ...item,
        distributor: {
          id: userId,
          name:
            (item.distributorUserId &&
            typeof item.distributorUserId === "object"
              ? item.distributorUserId.name
              : "") || "",
          phone:
            (item.distributorUserId &&
            typeof item.distributorUserId === "object"
              ? item.distributorUserId.phone
              : "") || "",
          email:
            (item.distributorUserId &&
            typeof item.distributorUserId === "object"
              ? item.distributorUserId.email
              : "") || "",
          division: profile?.division || "",
          ward: profile?.wardNo || profile?.ward || "",
          distributorId: profile?._id ? String(profile._id) : "",
          distributorCode: profile?._id
            ? `DST-${String(profile._id).slice(-6).toUpperCase()}`
            : "",
        },
        linkedAudit: log
          ? {
              id: String(log._id),
              action: log.action || "",
              severity: log.severity || "",
              entityType: log.entityType || "",
              entityId: log.entityId || "",
              sessionId: String(log.meta?.sessionId || ""),
              sessionCode: String(log.meta?.sessionCode || ""),
              consumerCode: String(log.meta?.consumerCode || ""),
              consumerName: String(log.meta?.consumerName || ""),
              tokenCode: String(log.meta?.tokenCode || ""),
              createdAt: log.createdAt,
            }
          : null,
      };
    });

    const overdueItems = items.filter(
      (item) =>
        ["Requested", "Submitted"].includes(item.status) &&
        item.dueAt &&
        new Date(item.dueAt) < new Date() &&
        !item.overdueNotified,
    );

    if (overdueItems.length > 0) {
      await Promise.all(
        overdueItems.map((item) => applyOverdueSuspension(item)),
      );
    }

    res.json({ success: true, data: { items: enrichedItems } });
  } catch (error) {
    console.error("listAuditReportRequests error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function requestAuditReport(req, res) {
  try {
    const { distributorUserId, auditLogId, note } = req.body || {};
    if (!distributorUserId) {
      return res.status(400).json({
        success: false,
        message: "distributorUserId is required",
      });
    }

    const user = await User.findById(distributorUserId).lean();
    if (!user || user.userType !== "Distributor") {
      return res.status(404).json({
        success: false,
        message: "Distributor user not found",
      });
    }

    const request = await AuditReportRequest.create({
      distributorUserId,
      requestedByAdminId: req.user.userId,
      auditLogId: auditLogId || undefined,
      note: note || "",
      dueAt: new Date(Date.now() + 7 * 86400000),
      status: "Requested",
    });

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Central Admin",
      action: "AUDIT_REPORT_REQUESTED",
      entityType: "AuditReportRequest",
      entityId: String(request._id),
      severity: "Warning",
      meta: { distributorUserId, auditLogId },
    });

    await notifyUser(distributorUserId, {
      title: "Audit report requested",
      message:
        "Admin requested an audit report. Submit within 7 days to avoid suspension.",
      meta: {
        auditLogId,
        requestId: String(request._id),
        dueAt: request.dueAt,
      },
    });

    res.status(201).json({
      success: true,
      message: "Audit report requested",
      data: { request },
    });
  } catch (error) {
    console.error("requestAuditReport error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function listMyAuditReportRequests(req, res) {
  try {
    const { status } = req.query;
    const query = { distributorUserId: req.user.userId };
    if (status) query.status = status;

    const items = await AuditReportRequest.find(query)
      .sort({ createdAt: -1 })
      .populate("auditLogId")
      .lean();

    const distributorProfile = await Distributor.findOne({
      userId: req.user.userId,
    })
      .select("_id division wardNo ward")
      .lean();

    const enrichedItems = items.map((item) => {
      const log =
        item.auditLogId && typeof item.auditLogId === "object"
          ? item.auditLogId
          : null;
      return {
        ...item,
        distributor: {
          id: String(req.user.userId),
          division: distributorProfile?.division || "",
          ward: distributorProfile?.wardNo || distributorProfile?.ward || "",
          distributorId: distributorProfile?._id
            ? String(distributorProfile._id)
            : "",
          distributorCode: distributorProfile?._id
            ? `DST-${String(distributorProfile._id).slice(-6).toUpperCase()}`
            : "",
        },
        linkedAudit: log
          ? {
              id: String(log._id),
              action: log.action || "",
              severity: log.severity || "",
              sessionId: String(log.meta?.sessionId || ""),
              sessionCode: String(log.meta?.sessionCode || ""),
              consumerCode: String(log.meta?.consumerCode || ""),
              consumerName: String(log.meta?.consumerName || ""),
              tokenCode: String(log.meta?.tokenCode || ""),
              createdAt: log.createdAt,
            }
          : null,
      };
    });
    const overdue = items.find(
      (item) =>
        ["Requested", "Submitted"].includes(item.status) &&
        item.dueAt &&
        new Date(item.dueAt) < new Date() &&
        !item.overdueNotified,
    );

    if (overdue) {
      await applyOverdueSuspension(overdue);
    }

    res.json({ success: true, data: { items: enrichedItems } });
  } catch (error) {
    console.error("listMyAuditReportRequests error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function submitAuditReport(req, res) {
  try {
    const reportText = String(req.body?.reportText || "").trim();
    const uploadedFiles = Array.isArray(req.files) ? req.files : [];

    if (!reportText && uploadedFiles.length < 1) {
      return res.status(400).json({
        success: false,
        message: "reportText or at least one file is required",
      });
    }

    const request = await AuditReportRequest.findOne({
      _id: req.params.id,
      distributorUserId: req.user.userId,
    });

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Audit request not found" });
    }

    request.reportText = reportText || request.reportText || "";
    if (uploadedFiles.length > 0) {
      const attachments = uploadedFiles
        .filter((file) => file?.path)
        .map((file) => ({
          originalName: file.originalname,
          storedName: file.filename,
          mimeType: file.mimetype,
          size: Number(file.size || 0),
          relativePath: path.relative(process.cwd(), file.path),
          uploadedAt: new Date(),
        }));

      request.attachments = [...(request.attachments || []), ...attachments];
    }

    request.status = "Submitted";
    request.submittedAt = new Date();
    await request.save();

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Distributor",
      action: "AUDIT_REPORT_SUBMITTED",
      entityType: "AuditReportRequest",
      entityId: String(request._id),
      severity: "Info",
      meta: { auditLogId: request.auditLogId },
    });

    await notifyAdmins({
      title: "Audit report submitted",
      message:
        "Distributor submitted an audit report. Admin approval required to reactivate if suspended.",
      meta: { requestId: String(request._id) },
    });

    res.json({
      success: true,
      message: "Audit report submitted",
      data: { request },
    });
  } catch (error) {
    console.error("submitAuditReport error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function downloadAuditReportFile(req, res) {
  try {
    const { id, fileId } = req.params;
    const request = await AuditReportRequest.findById(id).lean();

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Audit request not found" });
    }

    if (
      req.user.userType === "Distributor" &&
      String(request.distributorUserId) !== String(req.user.userId)
    ) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const fileMeta = (request.attachments || []).find(
      (item) => String(item._id) === String(fileId),
    );

    if (!fileMeta) {
      return res
        .status(404)
        .json({ success: false, message: "Attachment not found" });
    }

    const baseDir = getAuditUploadsDir();
    const absolutePath = path.resolve(process.cwd(), fileMeta.relativePath);

    if (!absolutePath.startsWith(baseDir) || !fs.existsSync(absolutePath)) {
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    }

    return res.download(absolutePath, fileMeta.originalName);
  } catch (error) {
    console.error("downloadAuditReportFile error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

async function reviewAuditReportRequest(req, res) {
  try {
    const { decision, note } = req.body || {};
    if (
      !decision ||
      !["Approved", "Rejected", "Suspended", "ReRequested"].includes(decision)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "decision must be Approved, Rejected, Suspended, or ReRequested",
      });
    }

    const request = await AuditReportRequest.findById(req.params.id);
    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Audit request not found" });
    }

    if (decision === "ReRequested") {
      request.status = "Requested";
      request.decision = "ReRequested";
      request.reviewedAt = new Date();
      request.dueAt = new Date(Date.now() + 7 * 86400000);
      request.overdueNotified = false;
      if (String(note || "").trim()) {
        request.note = String(note).trim();
      }
      await request.save();
    } else {
      request.status = decision === "Approved" ? "Closed" : "Reviewed";
      request.decision = decision;
      request.reviewedAt = new Date();
      if (String(note || "").trim()) {
        request.note = String(note).trim();
      }
      await request.save();

      const nextStatus = decision === "Approved" ? "Active" : "Suspended";
      await User.findByIdAndUpdate(request.distributorUserId, {
        $set: { authorityStatus: nextStatus },
      });
      await Distributor.findOneAndUpdate(
        { userId: request.distributorUserId },
        { $set: { authorityStatus: nextStatus } },
      );
    }

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Central Admin",
      action: "AUDIT_REPORT_REVIEWED",
      entityType: "AuditReportRequest",
      entityId: String(request._id),
      severity:
        decision === "Approved"
          ? "Info"
          : decision === "ReRequested"
            ? "Warning"
            : "Warning",
      meta: { decision },
    });

    await notifyUser(request.distributorUserId, {
      title: "Audit report reviewed",
      message:
        decision === "Approved"
          ? "Audit report approved. Your account is active."
          : decision === "ReRequested"
            ? "Admin requested another audit report. Please submit updated report with files/message before due date."
            : "Audit report not approved. Your account remains suspended.",
      meta: {
        decision,
        requestId: String(request._id),
        dueAt: request.dueAt,
        note: String(request.note || ""),
      },
    });

    res.json({
      success: true,
      message: "Audit report reviewed",
      data: { request },
    });
  } catch (error) {
    console.error("reviewAuditReportRequest error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = {
  listAuditReportRequests,
  requestAuditReport,
  listMyAuditReportRequests,
  submitAuditReport,
  reviewAuditReportRequest,
  downloadAuditReportFile,
};
