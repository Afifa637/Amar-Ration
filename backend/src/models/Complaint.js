"use strict";

const mongoose = require("mongoose");

const ComplaintSchema = new mongoose.Schema(
  {
    complaintId: { type: String, required: true, unique: true, index: true },
    consumerId: { type: mongoose.Schema.Types.ObjectId, ref: "Consumer" },
    consumerPhone: { type: String, required: true },
    distributorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DistributionSession",
    },
    tokenCode: { type: String },
    category: {
      type: String,
      enum: [
        "weight_mismatch",
        "missing_ration",
        "wrong_amount",
        "distributor_behavior",
        "registration_issue",
        "other",
      ],
      required: true,
    },
    description: { type: String, required: true, maxlength: 500 },
    status: {
      type: String,
      enum: ["open", "under_review", "resolved", "rejected"],
      default: "open",
    },
    adminNote: { type: String },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Complaint", ComplaintSchema);
