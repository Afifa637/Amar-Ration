const DIVISION_CANONICAL = {
  dhaka: "ঢাকা",
  chattogram: "চট্টগ্রাম",
  rajshahi: "রাজশাহী",
  khulna: "খুলনা",
  barishal: "বরিশাল",
  sylhet: "সিলেট",
  rangpur: "রংপুর",
  mymensingh: "ময়মনসিংহ",
};

const DIVISION_KEY_MAP = {
  // Dhaka
  dhaka: "dhaka",
  ঢাকা: "dhaka",

  // Chattogram
  chattogram: "chattogram",
  chittagong: "chattogram",
  chottogram: "chattogram",
  chattagram: "chattogram",
  চট্টগ্রাম: "chattogram",

  // Rajshahi
  rajshahi: "rajshahi",
  রাজশাহী: "rajshahi",

  // Khulna
  khulna: "khulna",
  খুলনা: "khulna",

  // Barishal
  barishal: "barishal",
  বরিশাল: "barishal",

  // Sylhet
  sylhet: "sylhet",
  সিলেট: "sylhet",

  // Rangpur
  rangpur: "rangpur",
  রংপুর: "rangpur",

  // Mymensingh
  mymensingh: "mymensingh",
  ময়মনসিংহ: "mymensingh",
  ময়মনসিংহ: "mymensingh",
};

const DIVISION_ALIASES = {
  ঢাকা: ["ঢাকা", "Dhaka", "dhaka"],
  চট্টগ্রাম: ["চট্টগ্রাম", "Chattogram", "Chittagong", "chattogram"],
  রাজশাহী: ["রাজশাহী", "Rajshahi", "rajshahi"],
  খুলনা: ["খুলনা", "Khulna", "khulna"],
  বরিশাল: ["বরিশাল", "Barishal", "barishal"],
  সিলেট: ["সিলেট", "Sylhet", "sylhet"],
  রংপুর: ["রংপুর", "Rangpur", "rangpur"],
  ময়মনসিংহ: ["ময়মনসিংহ", "Mymensingh", "mymensingh"],
};

function cleanDivision(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]+/g, "")
    .normalize("NFKC");
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeDivision(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const key = DIVISION_KEY_MAP[raw] || DIVISION_KEY_MAP[cleanDivision(raw)];
  if (key && DIVISION_CANONICAL[key]) {
    return DIVISION_CANONICAL[key];
  }

  return raw;
}

function getDivisionAliases(value) {
  const normalized = normalizeDivision(value);
  if (!normalized) return [];

  const aliases = DIVISION_ALIASES[normalized] || [normalized];
  return Array.from(new Set([normalized, ...aliases].filter(Boolean)));
}

function buildDivisionMatchQuery(value) {
  const aliases = getDivisionAliases(value);
  if (!aliases.length) return null;

  return {
    $in: aliases.map((entry) => new RegExp(`^${escapeRegex(entry)}$`, "i")),
  };
}

function isSameDivision(a, b) {
  const left = normalizeDivision(a);
  if (!left) return true;
  const right = normalizeDivision(b);
  return !!right && left === right;
}

module.exports = {
  normalizeDivision,
  getDivisionAliases,
  buildDivisionMatchQuery,
  isSameDivision,
};
