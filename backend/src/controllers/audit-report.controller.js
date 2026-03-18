const AuditReportRequest = require("../models/AuditReportRequest");
const User = require("../models/User");
const Distributor = require("../models/Distributor");
const { writeAudit } = require("../services/audit.service");
const {
  notifyAdmins,
  notifyUser,
} = require("../services/notification.service");

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

    res.json({ success: true, data: { items } });
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

    res.json({ success: true, data: { items } });
  } catch (error) {
    console.error("listMyAuditReportRequests error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function submitAuditReport(req, res) {
  try {
    const { reportText } = req.body || {};
    if (!reportText || !String(reportText).trim()) {
      return res.status(400).json({
        success: false,
        message: "reportText is required",
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

    request.reportText = String(reportText).trim();
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

async function reviewAuditReportRequest(req, res) {
  try {
    const { decision } = req.body || {};
    if (
      !decision ||
      !["Approved", "Rejected", "Suspended"].includes(decision)
    ) {
      return res.status(400).json({
        success: false,
        message: "decision must be Approved, Rejected, or Suspended",
      });
    }

    const request = await AuditReportRequest.findById(req.params.id);
    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Audit request not found" });
    }

    request.status = decision === "Approved" ? "Closed" : "Reviewed";
    request.decision = decision;
    request.reviewedAt = new Date();
    await request.save();

    const nextStatus = decision === "Approved" ? "Active" : "Suspended";
    await User.findByIdAndUpdate(request.distributorUserId, {
      $set: { authorityStatus: nextStatus },
    });
    await Distributor.findOneAndUpdate(
      { userId: request.distributorUserId },
      { $set: { authorityStatus: nextStatus } },
    );

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Central Admin",
      action: "AUDIT_REPORT_REVIEWED",
      entityType: "AuditReportRequest",
      entityId: String(request._id),
      severity: decision === "Approved" ? "Info" : "Warning",
      meta: { decision },
    });

    await notifyUser(request.distributorUserId, {
      title: "Audit report reviewed",
      message:
        decision === "Approved"
          ? "Audit report approved. Your account is active."
          : "Audit report not approved. Your account remains suspended.",
      meta: { decision, requestId: String(request._id) },
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
};
