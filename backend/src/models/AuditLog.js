const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorType: { type: String, enum: ["Admin", "Distributor", "System"], required: true },
    action: { type: String, required: true },

    entityType: { type: String }, // "Token", "Consumer" etc.
    entityId: { type: String },   // store string to support polymorphic

    severity: { type: String, enum: ["Info", "Warning", "Critical"], default: "Info" },
    meta: { type: Object, default: {} }
  },
  { timestamps: true }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ severity: 1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);
