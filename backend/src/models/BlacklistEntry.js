const mongoose = require("mongoose");

const BlacklistEntrySchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ["Consumer", "Distributor"], required: true },
    targetRefId: { type: String, required: true },
    blockType: { type: String, enum: ["Temporary", "Permanent"], required: true },
    reason: { type: String, required: true },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date }
  },
  { timestamps: true }
);

BlacklistEntrySchema.index({ active: 1 });

module.exports = mongoose.model("BlacklistEntry", BlacklistEntrySchema);
