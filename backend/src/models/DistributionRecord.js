const mongoose = require("mongoose");

const DistributionRecordSchema = new mongoose.Schema(
  {
    tokenId: { type: mongoose.Schema.Types.ObjectId, ref: "Token", unique: true, required: true },
    expectedKg: { type: Number, required: true },
    actualKg: { type: Number, required: true },
    mismatch: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("DistributionRecord", DistributionRecordSchema);
