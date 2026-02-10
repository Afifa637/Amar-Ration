const StockLedger = require("../models/StockLedger");

/**
 * Immutable OUT entry. Works with transaction session.
 */
async function stockOut({ distributorId, dateKey, qtyKg, ref, item = "Rice" }, session) {
  const doc = { distributorId, dateKey, type: "OUT", item, qtyKg, ref };
  const opts = session ? { session } : undefined;
  await StockLedger.create([doc], opts);
}

module.exports = { stockOut };
