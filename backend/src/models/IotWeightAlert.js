const mongoose = require("mongoose");

const IotWeightAlertSchema = new mongoose.Schema(
  {
    product: { type: String, required: true, enum: ["P1", "P2", "P3"] },
    productName: { type: String, default: "" },
    expectedKg: { type: Number, required: true },
    measuredKg: { type: Number, required: true },
    diffG: { type: Number, required: true },
    deviceId: { type: String, default: "esp32" },
    acknowledged: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("IotWeightAlert", IotWeightAlertSchema);
