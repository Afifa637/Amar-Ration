const crypto = require("crypto");
const QRCode = require("../models/QRCode");

function hashPayload(payload) {
  return crypto.createHash("sha256").update(payload).digest("hex");
}

async function isQRCodeValidByHash(payloadHash) {
  const qr = await QRCode.findOne({ payloadHash }).lean();
  if (!qr) return { ok: false, reason: "NOT_FOUND" };

  const now = new Date();
  if (qr.status !== "Valid") return { ok: false, reason: "STATUS" };
  if (now < new Date(qr.validFrom) || now > new Date(qr.validTo)) return { ok: false, reason: "EXPIRED" };

  return { ok: true, qr };
}

module.exports = { hashPayload, isQRCodeValidByHash };
