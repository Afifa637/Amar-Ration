const mongoose = require("mongoose");

const DistributionSessionSchema = new mongoose.Schema(
  {
    distributorId: { type: mongoose.Schema.Types.ObjectId, ref: "Distributor", required: true },
    dateKey: { type: String, required: true }, // YYYY-MM-DD
    status: { type: String, enum: ["Open", "Paused", "Closed"], default: "Open" },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date }
  },
  { timestamps: true }
);

DistributionSessionSchema.index({ distributorId: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.model("DistributionSession", DistributionSessionSchema);
