const mongoose = require("mongoose");

const BlacklistEntrySchema = new mongoose.Schema(
  {
    distributorId: { type: mongoose.Schema.Types.ObjectId, ref: "Distributor" },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    targetType: {
      type: String,
      enum: ["Consumer", "Distributor"],
      required: true,
    },
    targetRefId: { type: String, required: true }, // consumerId/distributorId as string
    blockType: {
      type: String,
      enum: ["Temporary", "Permanent"],
      required: true,
    },
    reason: { type: String, required: true },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

BlacklistEntrySchema.index({ active: 1 });
BlacklistEntrySchema.index({ distributorId: 1, active: 1, createdAt: -1 });

module.exports = mongoose.model("BlacklistEntry", BlacklistEntrySchema);
