const mongoose = require("mongoose");

const SmsOutboxSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    phone: { type: String, required: true },
    message: { type: String, required: true },
    trigger: { type: String },
    consumerId: { type: mongoose.Schema.Types.ObjectId, ref: "Consumer" },
    status: {
      type: String,
      enum: ["Queued", "Sent", "Failed", "sent", "failed"],
      default: "Queued",
    },
    meta: { type: Object },
    retryCount: { type: Number, default: 0 },
    attemptCount: { type: Number, default: 0 },
    sentAt: { type: Date },
    lastAttemptAt: { type: Date },
    error: { type: String },
  },
  { timestamps: true },
);

SmsOutboxSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("SmsOutbox", SmsOutboxSchema);
