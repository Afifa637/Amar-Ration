"use strict";

const crypto = require("crypto");

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

function buildOmsQrPayload({ consumerCode, ward, category, expiryDate }) {
  const expiryYYYYMMDD = expiryDate
    ? `${expiryDate.getFullYear()}${String(expiryDate.getMonth() + 1).padStart(2, "0")}${String(expiryDate.getDate()).padStart(2, "0")}`
    : "";

  const data = `${String(consumerCode || "").trim()}:${String(ward || "").trim()}:${String(category || "").trim()}:${expiryYYYYMMDD}`;
  const hmac = crypto
    .createHmac("sha256", getQrHmacKey())
    .update(data)
    .digest("hex")
    .slice(0, 8);

  return `ARC:${data}:${hmac}`;
}

function parseOmsQrPayload(rawPayload) {
  const raw = String(rawPayload || "").trim();
  if (!raw || !raw.startsWith("ARC:")) {
    return null;
  }

  const parts = raw.split(":");
  if (parts.length < 6) return null;

  const [, consumerCode, ward, category, expiryYYYYMMDD, providedHmac] = parts;

  const data = `${consumerCode}:${ward}:${category}:${expiryYYYYMMDD}`;
  const expectedHmac = crypto
    .createHmac("sha256", getQrHmacKey())
    .update(data)
    .digest("hex")
    .slice(0, 8);

  if (providedHmac !== expectedHmac) {
    return null;
  }

  if (expiryYYYYMMDD) {
    if (!/^\d{8}$/.test(expiryYYYYMMDD)) {
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

    if (Date.now() > expiryDate.getTime()) {
      return { expired: true, consumerCode, ward, category, expiryYYYYMMDD };
    }
  }

  return { expired: false, consumerCode, ward, category, expiryYYYYMMDD };
}

module.exports = {
  buildOmsQrPayload,
  parseOmsQrPayload,
};
