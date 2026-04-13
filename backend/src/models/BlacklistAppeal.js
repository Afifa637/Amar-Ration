"use strict";

const mongoose = require("mongoose");

const BlacklistAppealSchema = new mongoose.Schema(
  {
    appealId: { type: String, required: true, unique: true, index: true },
    consumerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Consumer",
      required: true,
    },
    consumerPhone: { type: String, required: true },
    blacklistEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BlacklistEntry",
    },
    reason: { type: String, required: true, maxlength: 500 },
    supportingInfo: { type: String },
    status: {
      type: String,
      enum: ["pending", "under_review", "approved", "rejected"],
      default: "pending",
    },
    adminNote: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model("BlacklistAppeal", BlacklistAppealSchema);
