const mongoose = require("mongoose");

const DistributionRecordSchema = new mongoose.Schema(
  {
    tokenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Token",
      unique: true,
      required: true,
    },
    distributorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Distributor",
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DistributionSession",
      index: true,
    },
    item: { type: String },
    expectedKg: { type: Number, required: true },
    actualKg: { type: Number, required: true },
    expectedByItem: { type: mongoose.Schema.Types.Mixed },
    actualByItem: { type: mongoose.Schema.Types.Mixed },
    mismatchDetails: { type: [mongoose.Schema.Types.Mixed], default: [] },
    mismatch: { type: Boolean, default: false },
  },
  { timestamps: true },
);

DistributionRecordSchema.index({ distributorId: 1, createdAt: -1 });
DistributionRecordSchema.index({ sessionId: 1, createdAt: -1 });

module.exports = mongoose.model("DistributionRecord", DistributionRecordSchema);
