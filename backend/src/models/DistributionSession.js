const mongoose = require("mongoose");
const { STOCK_ITEMS } = require("../utils/stock-items.utils");

const qtyByItemSchema = STOCK_ITEMS.reduce((acc, item) => {
  acc[item] = { type: Number, default: 0 };
  return acc;
}, {});

const DistributionSessionSchema = new mongoose.Schema(
  {
    distributorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Distributor",
      required: true,
    },
    dateKey: { type: String, required: true }, // YYYY-MM-DD
    rationItem: { type: String, enum: STOCK_ITEMS, default: "চাল" },
    plannedAllocationByItem: { type: qtyByItemSchema, default: () => ({}) },
    distributedByItem: { type: qtyByItemSchema, default: () => ({}) },
    status: {
      type: String,
      enum: ["Planned", "Open", "Paused", "Closed"],
      default: "Planned",
    },
    scheduledStartAt: { type: Date },
    openedAt: { type: Date },
    closedAt: { type: Date },
    expectedLatitude: { type: Number },
    expectedLongitude: { type: Number },
    actualLatitude: { type: Number },
    actualLongitude: { type: Number },
    locationVerified: { type: Boolean, default: false },
    locationAnomalyFlagged: { type: Boolean, default: false },
    autoPauseOnMismatch: { type: Boolean, default: true },
  },
  { timestamps: true },
);

DistributionSessionSchema.index(
  { distributorId: 1, dateKey: 1 },
  { unique: true },
);

module.exports = mongoose.model(
  "DistributionSession",
  DistributionSessionSchema,
);
