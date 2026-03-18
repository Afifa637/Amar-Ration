const mongoose = require("mongoose");

const SmsOutboxSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    phone: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["Queued", "Sent", "Failed"],
      default: "Queued",
    },
    error: { type: String },
  },
  { timestamps: true },
);

SmsOutboxSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("SmsOutbox", SmsOutboxSchema);
