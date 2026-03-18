const mongoose = require("mongoose");

const AuditReportRequestSchema = new mongoose.Schema(
  {
    distributorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requestedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    auditLogId: { type: mongoose.Schema.Types.ObjectId, ref: "AuditLog" },
    note: { type: String },
    reportText: { type: String },
    dueAt: { type: Date },
    overdueNotified: { type: Boolean, default: false },
    decision: {
      type: String,
      enum: ["Approved", "Rejected", "Suspended"],
    },
    reviewedAt: { type: Date },
    status: {
      type: String,
      enum: ["Requested", "Submitted", "Reviewed", "Closed"],
      default: "Requested",
    },
    submittedAt: { type: Date },
  },
  { timestamps: true },
);

AuditReportRequestSchema.index({ distributorUserId: 1, status: 1 });

module.exports = mongoose.model("AuditReportRequest", AuditReportRequestSchema);
