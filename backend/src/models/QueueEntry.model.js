"use strict";

const mongoose = require("mongoose");

const QueueEntrySchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DistributionSession",
      required: true,
      index: true,
    },
    consumerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Consumer",
      required: true,
    },
    consumerName: { type: String },
    consumerCode: { type: String },
    category: { type: String },
    queueNumber: { type: Number, required: true },
    status: {
      type: String,
      enum: ["waiting", "serving", "done", "skipped"],
      default: "waiting",
    },
    issuedAt: { type: Date, default: Date.now },
    calledAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

QueueEntrySchema.index({ sessionId: 1, consumerId: 1 }, { unique: true });
QueueEntrySchema.index({ sessionId: 1, queueNumber: 1 });

module.exports = mongoose.model("QueueEntry", QueueEntrySchema);
