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
    distributorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    distributorRefId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Distributor",
      required: true,
    },
    division: { type: String, index: true },
    ward: { type: String, index: true },
    reason: { type: String, required: true, maxlength: 500 },
    supportingInfo: { type: String },
    attachments: [
      {
        originalName: { type: String, required: true },
        storedName: { type: String, required: true },
        mimeType: { type: String, required: true },
        size: { type: Number, required: true },
        relativePath: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
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
