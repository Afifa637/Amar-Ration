const mongoose = require("mongoose");
const { STOCK_ITEMS } = require("../utils/stock-items.utils");

const StockLedgerSchema = new mongoose.Schema(
  {
    distributorId: { type: mongoose.Schema.Types.ObjectId, ref: "Distributor" },
    dateKey: { type: String, required: true }, // YYYY-MM-DD
    type: { type: String, enum: ["IN", "OUT", "ADJUST"], required: true },
    item: { type: String, enum: STOCK_ITEMS, default: "চাল", required: true },
    qtyKg: { type: Number, required: true },
    ref: { type: String }, // tokenCode or batch ref etc.
  },
  { timestamps: true },
);

StockLedgerSchema.index({ distributorId: 1, dateKey: 1 });

module.exports = mongoose.model("StockLedger", StockLedgerSchema);
