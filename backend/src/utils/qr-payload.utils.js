"use strict";

const crypto = require("crypto");

const AR_QR_PREFIX = "ARC";
const AR_QR_DELIMITER = ":";

function getQrHmacKey() {
  const key = process.env.QR_HMAC_SECRET;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: QR_HMAC_SECRET is not set");
    }
    return "dev-fallback-qr-hmac-key-not-for-production";
  }
  return key;
}

function formatExpiryYYYYMMDD(expiryDate) {
  const date = expiryDate instanceof Date ? expiryDate : new Date(expiryDate);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeArWard(ward) {
  const digits = String(ward || "")
    .replace(/\D/g, "")
    .slice(-2);
  if (!digits) return "";
  return digits.padStart(2, "0");
}

function normalizeArCategory(category) {
  return String(category || "")
    .trim()
    .toUpperCase();
}

function makeArCanonicalData({ consumerCode, ward, category, expiryYYYYMMDD }) {
  return [
    String(consumerCode || "").trim(),
    normalizeArWard(ward),
    normalizeArCategory(category),
    String(expiryYYYYMMDD || "").trim(),
  ].join(AR_QR_DELIMITER);
}

function signArCanonicalData(canonicalData) {
  return crypto
    .createHmac("sha256", getQrHmacKey())
    .update(String(canonicalData || ""))
    .digest("hex")
    .slice(0, 8);
}

function buildArQrPayload({ consumerCode, ward, category, expiryDate }) {
  const expiryYYYYMMDD = formatExpiryYYYYMMDD(expiryDate);
  const canonicalData = makeArCanonicalData({
    consumerCode,
    ward,
    category,
    expiryYYYYMMDD,
  });
  const hmac = signArCanonicalData(canonicalData);

  return `${AR_QR_PREFIX}${AR_QR_DELIMITER}${canonicalData}${AR_QR_DELIMITER}${hmac}`;
}

function parseArQrPayload(rawPayload) {
  const raw = String(rawPayload || "").trim();
  if (!raw) return null;

  const parts = raw.split(AR_QR_DELIMITER);
  if (parts.length !== 6) return null;

  const [prefix, consumerCode, ward, category, expiryYYYYMMDD, providedHmac] =
    parts;
  if (prefix !== AR_QR_PREFIX) return null;

  const normalizedWard = normalizeArWard(ward);
  const normalizedCategory = normalizeArCategory(category);
  const normalizedConsumerCode = String(consumerCode || "").trim();

  if (!normalizedConsumerCode) return null;
  if (!/^\d{2}$/.test(normalizedWard)) return null;
  if (!/^[ABC]$/.test(normalizedCategory)) return null;
  if (!/^\d{8}$/.test(String(expiryYYYYMMDD || ""))) return null;
  if (!/^[a-f0-9]{8}$/i.test(String(providedHmac || ""))) return null;

  const canonicalData = makeArCanonicalData({
    consumerCode: normalizedConsumerCode,
    ward: normalizedWard,
    category: normalizedCategory,
    expiryYYYYMMDD,
  });
  const expectedHmac = signArCanonicalData(canonicalData);
  if (
    String(providedHmac || "").toLowerCase() !==
    String(expectedHmac || "").toLowerCase()
  ) {
    return null;
  }

  const year = parseInt(expiryYYYYMMDD.slice(0, 4), 10);
  const month = parseInt(expiryYYYYMMDD.slice(4, 6), 10);
  const day = parseInt(expiryYYYYMMDD.slice(6, 8), 10);

  const expiryDate = new Date(year, month - 1, day, 23, 59, 59, 999);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    Number.isNaN(expiryDate.getTime()) ||
    expiryDate.getFullYear() !== year ||
    expiryDate.getMonth() !== month - 1 ||
    expiryDate.getDate() !== day
  ) {
    return null;
  }

  const expired = Date.now() > expiryDate.getTime();

  return {
    expired,
    consumerCode: normalizedConsumerCode,
    ward: normalizedWard,
    category: normalizedCategory,
    expiryYYYYMMDD,
    canonicalData,
    signature: String(providedHmac).toLowerCase(),
    prefix: AR_QR_PREFIX,
    delimiter: AR_QR_DELIMITER,
  };
}

function buildOmsQrPayload(input) {
  return buildArQrPayload(input);
}

function parseOmsQrPayload(rawPayload) {
  return parseArQrPayload(rawPayload);
}

function verifyArQrPayload(rawPayload, { allowExpired = false } = {}) {
  const parsed = parseArQrPayload(rawPayload);
  if (!parsed) {
    return { valid: false, reason: "INVALID_AR_QR", parsed: null };
  }
  if (!allowExpired && parsed.expired) {
    return { valid: false, reason: "AR_QR_EXPIRED", parsed };
  }
  return { valid: true, reason: null, parsed };
}

function isArQrPayload(rawPayload) {
  const raw = String(rawPayload || "").trim();
  return raw.startsWith(`${AR_QR_PREFIX}${AR_QR_DELIMITER}`);
}

module.exports = {
  AR_QR_PREFIX,
  AR_QR_DELIMITER,
  normalizeArWard,
  normalizeArCategory,
  formatExpiryYYYYMMDD,
  makeArCanonicalData,
  signArCanonicalData,
  buildArQrPayload,
  parseArQrPayload,
  verifyArQrPayload,
  isArQrPayload,
  // Backward-compatible aliases
  buildOmsQrPayload,
  parseOmsQrPayload,
};
