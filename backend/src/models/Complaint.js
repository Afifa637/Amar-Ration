"use strict";

const mongoose = require("mongoose");
const { STOCK_ITEMS } = require("../utils/stock-items.utils");

const qtyByItemSchema = STOCK_ITEMS.reduce((acc, item) => {
  acc[item] = { type: Number, default: 0 };
  return acc;
}, {});

const ComplaintSchema = new mongoose.Schema(
  {
    complaintId: { type: String, required: true, unique: true, index: true },
    consumerId: { type: mongoose.Schema.Types.ObjectId, ref: "Consumer" },
    consumerCode: { type: String, index: true },
    consumerName: { type: String },
    consumerPhone: { type: String, required: true },
    distributorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    distributorName: { type: String },
    distributorCode: { type: String },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DistributionSession",
    },
    sessionCode: { type: String, index: true },
    sessionDate: { type: String },
    sessionStatus: {
      type: String,
      enum: ["Planned", "Open", "Paused", "Closed"],
    },
    division: { type: String, index: true },
    ward: { type: String, index: true },
    tokenCode: { type: String },
    item: { type: String, enum: STOCK_ITEMS },
    expectedByItem: { type: qtyByItemSchema, default: () => ({}) },
    actualByItem: { type: qtyByItemSchema, default: () => ({}) },
    mismatchDetails: {
      type: [
        {
          item: { type: String, enum: STOCK_ITEMS },
          expectedKg: { type: Number, default: 0 },
          actualKg: { type: Number, default: 0 },
          diffKg: { type: Number, default: 0 },
          reason: { type: String, default: "" },
        },
      ],
      default: [],
    },
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

ComplaintSchema.index({ status: 1, category: 1, createdAt: -1 });
ComplaintSchema.index({ division: 1, ward: 1, createdAt: -1 });
ComplaintSchema.index({ consumerCode: 1, consumerPhone: 1 });
ComplaintSchema.index({ sessionCode: 1, tokenCode: 1, createdAt: -1 });

module.exports = mongoose.model("Complaint", ComplaintSchema);
