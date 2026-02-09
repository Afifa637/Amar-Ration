const mongoose = require("mongoose");

const QRCodeSchema = new mongoose.Schema(
  {
    payload: { type: String, required: true },
    payloadHash: { type: String, required: true, unique: true },
    validFrom: { type: Date, required: true },
    validTo: { type: Date, required: true },
    status: { type: String, enum: ["Valid", "Expired", "Revoked"], default: "Valid" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("QRCode", QRCodeSchema);
