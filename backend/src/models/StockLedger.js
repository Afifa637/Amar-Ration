const mongoose = require("mongoose");

const StockLedgerSchema = new mongoose.Schema(
  {
    distributorId: { type: mongoose.Schema.Types.ObjectId, ref: "Distributor" },
    dateKey: { type: String, required: true }, // YYYY-MM-DD
    type: { type: String, enum: ["IN", "OUT", "ADJUST"], required: true },
    item: { type: String, default: "Rice" },
    qtyKg: { type: Number, required: true },
    ref: { type: String } // tokenCode or batch ref etc.
  },
  { timestamps: true }
);

StockLedgerSchema.index({ distributorId: 1, dateKey: 1 });

module.exports = mongoose.model("StockLedger", StockLedgerSchema);
