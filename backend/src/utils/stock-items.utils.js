"use strict";

const STOCK_ITEMS = ["চাল", "ডাল", "পেঁয়াজ"];

function normalizeStockItem(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const map = {
    Rice: "চাল",
    rice: "চাল",
    lentil: "ডাল",
    Lentil: "ডাল",
    onion: "পেঁয়াজ",
    Onion: "পেঁয়াজ",
    চাল: "চাল",
    ডাল: "ডাল",
    পেঁয়াজ: "পেঁয়াজ",
  };

  return map[raw] || null;
}

function isStockItem(value) {
  return STOCK_ITEMS.includes(String(value || ""));
}

module.exports = {
  STOCK_ITEMS,
  normalizeStockItem,
  isStockItem,
};
