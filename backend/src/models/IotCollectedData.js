const mongoose = require("mongoose");

const IotCollectedDataSchema = new mongoose.Schema(
  {
    distributorId: { type: String, default: "" },
    deviceId:      { type: String, default: "esp32" },
    consumerCode:  { type: String, default: "" },
    product:       { type: String, enum: ["P1", "P2", "P3"], required: true },
    productName:   { type: String, default: "" },
    targetKg:      { type: Number, required: true },
    actualKg:      { type: Number, required: true },
    diffG:         { type: Number, default: 0 },
    status:        { type: String, enum: ["ok", "mismatch"], default: "ok" },
    collectedAt:   { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Recommended indexes (matches DBMS suggestions in the admin UI)
IotCollectedDataSchema.index({ distributorId: 1, createdAt: -1 });
IotCollectedDataSchema.index({ product: 1, status: 1 });
IotCollectedDataSchema.index({ createdAt: -1 });

module.exports = mongoose.model("IotCollectedData", IotCollectedDataSchema);
