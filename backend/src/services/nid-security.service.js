const crypto = require("crypto");

const PREFIX = "enc:v1:";

function getKey() {
  const raw = process.env.NID_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "FATAL: NID_ENCRYPTION_KEY is not set in environment variables. Cannot start.",
    );
  }

  if (raw === process.env.JWT_SECRET) {
    throw new Error(
      "FATAL: NID_ENCRYPTION_KEY must be different from JWT_SECRET.",
    );
  }

  return crypto.createHash("sha256").update(String(raw)).digest();
}

function normalizeNid(value) {
  return String(value || "").replace(/\D/g, "");
}

function encryptNid(value) {
  const plain = String(value || "");
  if (!plain) return "";
  if (plain.startsWith(PREFIX)) return plain;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptNid(value) {
  const raw = String(value || "");
  if (!raw) return "";
  if (!raw.startsWith(PREFIX)) return raw;

  try {
    const payload = raw.slice(PREFIX.length);
    const [ivB64, tagB64, encryptedB64] = payload.split(":");
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const encrypted = Buffer.from(encryptedB64, "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    return raw;
  }
}

function hashNid(value) {
  const normalized = normalizeNid(value);
  if (!normalized) return "";

  return crypto.createHmac("sha256", getKey()).update(normalized).digest("hex");
}

module.exports = {
  normalizeNid,
  encryptNid,
  decryptNid,
  hashNid,
};
