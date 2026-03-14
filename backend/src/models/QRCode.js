const mongoose = require("mongoose");

const QRCodeSchema = new mongoose.Schema(
  {
    payload: { type: String, required: true },
    payloadHash: { type: String, required: true, unique: true },
    validFrom: { type: Date, default: Date.now },
    validTo: { type: Date },
    status: {
      type: String,
      enum: ["Valid", "Revoked", "Expired", "Invalid"],
      default: "Valid",
    },
  },
  { timestamps: true },
);

QRCodeSchema.index({ payloadHash: 1 });
QRCodeSchema.index({ status: 1, validTo: 1 });

module.exports = mongoose.model("QRCode", QRCodeSchema);
