"use strict";

const Consumer = require("../models/Consumer");

function normalizeText(value) {
  return String(value || "").trim();
}

function validateNID(nid) {
  const cleaned = String(nid || "")
    .replace(/[\s\-.]/g, "")
    .trim();
  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, cleaned, reason: "NID must be digits only" };
  }

  if (cleaned.length === 10) {
    if (/^[1-9]\d{9}$/.test(cleaned)) return { valid: true, cleaned };
    return { valid: false, cleaned, reason: "10-digit NID must start 1-9" };
  }

  if (cleaned.length === 13) {
    if (/^[1-9]\d{12}$/.test(cleaned)) return { valid: true, cleaned };
    return { valid: false, cleaned, reason: "13-digit NID must start 1-9" };
  }

  if (cleaned.length === 17) {
    const year = Number(cleaned.slice(0, 4));
    if (year >= 1900 && year <= 2010) return { valid: true, cleaned };
    return {
      valid: false,
      cleaned,
      reason: "17-digit NID first 4 digits must be year 1900-2010",
    };
  }

  return {
    valid: false,
    cleaned,
    reason: "NID must be 10, 13, or 17 digits",
  };
}

function validatePhone(phone) {
  let cleaned = String(phone || "")
    .replace(/[\s\-]/g, "")
    .trim();
  cleaned = cleaned.replace(/^\+88/, "");
  if (!cleaned.startsWith("0") && /^1\d{10}$/.test(cleaned)) {
    cleaned = `0${cleaned}`;
  }
  if (!/^01\d{9}$/.test(cleaned)) {
    return { valid: false, cleaned, reason: "Phone must be 11 digits" };
  }
  if (!/^01[3-9]\d{8}$/.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      reason: "Phone prefix must be 013/014/015/016/017/018/019",
    };
  }
  return { valid: true, cleaned };
}

function validateCategory(cat) {
  const normalized = String(cat || "")
    .trim()
    .toUpperCase();
  if (!["A", "B", "C"].includes(normalized)) {
    return {
      valid: false,
      normalized,
      reason: "category must be A, B, or C",
    };
  }
  return { valid: true, normalized };
}

function validateWard(ward) {
  const n = Number.parseInt(String(ward || "").trim(), 10);
  if (!Number.isInteger(n) || n < 1 || n > 20) {
    return { valid: false, reason: "ward must be an integer between 1 and 20" };
  }
  return { valid: true, cleaned: String(n).padStart(2, "0") };
}

function validateMemberCount(count) {
  const n = Number.parseInt(String(count || "").trim(), 10);
  if (!Number.isInteger(n) || n < 1 || n > 10) {
    return { valid: false, reason: "memberCount must be integer between 1-10" };
  }
  return { valid: true, cleaned: n };
}

function validateConsumerPayload(data) {
  const errors = [];
  const name = normalizeText(data?.name);
  const nid = validateNID(data?.nidNumber || data?.nidFull);
  const fatherNid = validateNID(data?.fatherNidNumber || data?.fatherNidFull);
  const motherNid = validateNID(data?.motherNidNumber || data?.motherNidFull);
  const phone = validatePhone(data?.phone || data?.guardianPhone);
  const category = validateCategory(data?.category);
  const ward = validateWard(data?.wardNumber || data?.ward);
  const memberCount = validateMemberCount(data?.memberCount || 1);

  if (!name) errors.push("name is required");
  if (!nid.valid) errors.push(nid.reason || "Invalid NID");
  if (!fatherNid.valid) {
    errors.push(`Father NID: ${fatherNid.reason || "Invalid"}`);
  }
  if (!motherNid.valid) {
    errors.push(`Mother NID: ${motherNid.reason || "Invalid"}`);
  }
  if (!phone.valid) errors.push(phone.reason || "Invalid phone");
  if (!category.valid) errors.push(category.reason || "Invalid category");
  if (!ward.valid) errors.push(ward.reason || "Invalid ward");
  if (!memberCount.valid)
    errors.push(memberCount.reason || "Invalid memberCount");

  return {
    valid: errors.length === 0,
    errors,
    cleaned: {
      name,
      nidFull: nid.cleaned,
      fatherNidFull: fatherNid.cleaned,
      motherNidFull: motherNid.cleaned,
      phone: phone.cleaned,
      category: category.normalized,
      ward: ward.cleaned,
      memberCount: memberCount.cleaned,
      unionName: normalizeText(data?.unionName),
      upazila: normalizeText(data?.upazila),
      district: normalizeText(data?.district),
      division: normalizeText(data?.division),
      guardianName: normalizeText(data?.guardianName),
    },
  };
}

async function detectNIDDuplicate(nidHash) {
  if (!nidHash) return { isDuplicate: false };
  const existing = await Consumer.findOne({ nidHash })
    .select("consumerCode")
    .lean();
  if (!existing) return { isDuplicate: false };
  return {
    isDuplicate: true,
    existingConsumerCode: existing.consumerCode,
  };
}

module.exports = {
  validateNID,
  validatePhone,
  validateCategory,
  validateWard,
  validateMemberCount,
  validateConsumerPayload,
  detectNIDDuplicate,
};
