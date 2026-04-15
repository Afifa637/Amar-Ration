"use strict";

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildContainsRegex(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  return new RegExp(escapeRegex(text), "i");
}

module.exports = {
  escapeRegex,
  buildContainsRegex,
};
