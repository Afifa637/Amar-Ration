const mongoose = require("mongoose");

const OfflineQueueSchema = new mongoose.Schema(
  {
    distributorId: { type: mongoose.Schema.Types.ObjectId, ref: "Distributor", required: true },
    payload: { type: Object, required: true },
    status: { type: String, enum: ["Pending", "Synced", "Failed"], default: "Pending" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("OfflineQueue", OfflineQueueSchema);
