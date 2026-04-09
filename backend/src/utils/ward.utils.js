const BN_DIGITS = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
};

const EN_TO_BN_DIGITS = {
  0: "০",
  1: "১",
  2: "২",
  3: "৩",
  4: "৪",
  5: "৫",
  6: "৬",
  7: "৭",
  8: "৮",
  9: "৯",
};

function normalizeWardNo(input) {
  if (!input) return "";

  const english = String(input)
    .split("")
    .map((ch) => BN_DIGITS[ch] || ch)
    .join("");

  const digits = english.replace(/\D/g, "");
  if (!digits) return "";

  return digits.padStart(2, "0").slice(0, 2);
}

function toBanglaDigits(input) {
  return String(input || "")
    .split("")
    .map((ch) => (EN_TO_BN_DIGITS[ch] ? EN_TO_BN_DIGITS[ch] : ch))
    .join("");
}

function wardCorePattern(wardNo) {
  const normalized = normalizeWardNo(wardNo);
  if (!normalized) return "";

  const numeric = String(parseInt(normalized, 10));
  const bnNumeric = toBanglaDigits(numeric);

  if (numeric.length === 1) {
    return `(?:[0০])?(?:${numeric}|${bnNumeric})`;
  }

  const bnNormalized = toBanglaDigits(normalized);
  return `(?:${normalized}|${bnNormalized})`;
}

function mergeOrConditions(...conditions) {
  const items = conditions.filter(Boolean);
  if (!items.length) return null;
  if (items.length === 1) return items[0];
  return { $or: items.flatMap((item) => item.$or || [item]) };
}

function buildWardMatchQuery(input, fields = ["ward", "wardNo"]) {
  const normalized = normalizeWardNo(input);
  if (!normalized) return null;

  const pattern = wardCorePattern(normalized);
  if (!pattern) return null;

  const exactRegex = new RegExp(`^${pattern}$`, "i");
  const labeledRegex = new RegExp(
    `^(?:ও[য়া]র্ড|ward)?[-\\s:]*${pattern}$`,
    "i",
  );

  const or = [];

  if (fields.includes("wardNo")) {
    or.push({ wardNo: exactRegex });
  }

  if (fields.includes("ward")) {
    or.push({ ward: exactRegex });
    or.push({ ward: labeledRegex });
  }

  return { $or: or };
}

function isSameWard(a, b) {
  const left = normalizeWardNo(a);
  if (!left) return true;
  const right = normalizeWardNo(b);
  return !!right && left === right;
}

function isValidWardNo(input) {
  const n = normalizeWardNo(input);
  return /^[0-9]{2}$/.test(n) && parseInt(n, 10) >= 1;
}

module.exports = {
  normalizeWardNo,
  isValidWardNo,
  buildWardMatchQuery,
  isSameWard,
  mergeOrConditions,
};
