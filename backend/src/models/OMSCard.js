const mongoose = require("mongoose");

const OMSCardSchema = new mongoose.Schema(
  {
    consumerId: { type: mongoose.Schema.Types.ObjectId, ref: "Consumer", required: true },
    cardStatus: { type: String, enum: ["Active", "Inactive", "Revoked"], default: "Inactive" },
    qrCodeId: { type: mongoose.Schema.Types.ObjectId, ref: "QRCode", unique: true }
  },
  { timestamps: true }
);

OMSCardSchema.index({ consumerId: 1 });

module.exports = mongoose.model("OMSCard", OMSCardSchema);
