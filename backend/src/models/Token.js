const mongoose = require("mongoose");

const TokenSchema = new mongoose.Schema(
  {
    tokenCode: { type: String, unique: true, required: true },
    qrPayload: { type: String },
    qrPayloadHash: { type: String, index: true },
    sessionDateKey: { type: String },
    omsQrPayload: { type: String },
    consumerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Consumer",
      required: true,
    },
    distributorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Distributor",
      required: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DistributionSession",
    },
    rationQtyKg: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Issued", "Used", "Cancelled", "Expired"],
      default: "Issued",
    },
    issuedAt: { type: Date, default: Date.now },
    usedAt: { type: Date },
  },
  { timestamps: true },
);

// One token/day rule (per session)
TokenSchema.index({ consumerId: 1, sessionId: 1 }, { unique: true });

module.exports = mongoose.model("Token", TokenSchema);
