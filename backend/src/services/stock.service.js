const StockLedger = require("../models/StockLedger");
const { normalizeStockItem } = require("../utils/stock-items.utils");

/**
 * Immutable OUT entry. Works with transaction session.
 */
async function stockOut(
  { distributorId, dateKey, qtyKg, ref, item = "চাল" },
  session,
) {
  const normalizedItem = normalizeStockItem(item);
  if (!normalizedItem) {
    const error = new Error("Invalid stock item");
    error.code = "INVALID_STOCK_ITEM";
    throw error;
  }
  const doc = {
    distributorId,
    dateKey,
    type: "OUT",
    item: normalizedItem,
    qtyKg,
    ref,
  };
  const opts = session ? { session } : undefined;
  await StockLedger.create([doc], opts);
}

module.exports = { stockOut };
