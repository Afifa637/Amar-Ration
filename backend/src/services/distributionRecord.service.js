"use strict";

const {
  STOCK_ITEMS,
  normalizeStockItem,
} = require("../utils/stock-items.utils");

function zeroQtyByItem() {
  return STOCK_ITEMS.reduce((acc, item) => {
    acc[item] = 0;
    return acc;
  }, {});
}

function roundKg(value) {
  return Number(Number(value || 0).toFixed(3));
}

function normalizeQtyByItem(input) {
  const out = zeroQtyByItem();
  if (!input || typeof input !== "object") return out;

  for (const item of STOCK_ITEMS) {
    out[item] = roundKg(input[item]);
  }

  return out;
}

function mapSingleItemQty(item, qtyKg) {
  const out = zeroQtyByItem();
  const normalizedItem = normalizeStockItem(item);
  if (!normalizedItem) return out;
  out[normalizedItem] = roundKg(qtyKg);
  return out;
}

function buildMismatchDetails(expectedByItem, actualByItem) {
  const expected = normalizeQtyByItem(expectedByItem);
  const actual = normalizeQtyByItem(actualByItem);
  const details = [];

  for (const item of STOCK_ITEMS) {
    const diff = roundKg(actual[item] - expected[item]);
    if (Math.abs(diff) <= 0.001) continue;

    details.push({
      item,
      expectedKg: expected[item],
      actualKg: actual[item],
      diffKg: diff,
      reason:
        diff < 0
          ? `${item} short by ${Math.abs(diff)}kg`
          : `${item} excess by ${diff}kg`,
    });
  }

  return details;
}

function hydrateRecordItemFields({
  item,
  expectedKg,
  actualKg,
  expectedByItem,
  actualByItem,
}) {
  const normalizedItem = normalizeStockItem(item);

  const normalizedExpectedByItem = expectedByItem
    ? normalizeQtyByItem(expectedByItem)
    : mapSingleItemQty(normalizedItem, expectedKg);

  const normalizedActualByItem = actualByItem
    ? normalizeQtyByItem(actualByItem)
    : mapSingleItemQty(normalizedItem, actualKg);

  return {
    item: normalizedItem || "চাল",
    expectedByItem: normalizedExpectedByItem,
    actualByItem: normalizedActualByItem,
    mismatchDetails: buildMismatchDetails(
      normalizedExpectedByItem,
      normalizedActualByItem,
    ),
  };
}

module.exports = {
  zeroQtyByItem,
  roundKg,
  normalizeQtyByItem,
  mapSingleItemQty,
  buildMismatchDetails,
  hydrateRecordItemFields,
};
