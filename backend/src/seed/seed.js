/* eslint-disable no-await-in-loop */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { connectDB } = require("../config/db");

// ── Models ─────────────────────────────────────────────────────────────────
const User = require("../models/User");
const Distributor = require("../models/Distributor");
const Family = require("../models/Family");
const Consumer = require("../models/Consumer");
const QRCode = require("../models/QRCode");
const OMSCard = require("../models/OMSCard");
const Token = require("../models/Token");
const DistributionSession = require("../models/DistributionSession");
const DistributionRecord = require("../models/DistributionRecord");
const StockLedger = require("../models/StockLedger");
const SystemSetting = require("../models/SystemSetting");
const AuditLog = require("../models/AuditLog");
const BlacklistEntry = require("../models/BlacklistEntry");
const OfflineQueue = require("../models/OfflineQueue");
const Complaint = require("../models/Complaint");
const BlacklistAppeal = require("../models/BlacklistAppeal");
const QueueEntry = require("../models/QueueEntry.model");
const Notification = require("../models/Notification");
const SmsOutbox = require("../models/SmsOutbox");
const AuditReportRequest = require("../models/AuditReportRequest");
const RefreshToken = require("../models/RefreshToken");

// ── Utils ──────────────────────────────────────────────────────────────────
const { normalizeWardNo } = require("../utils/ward.utils");
const { normalizeDivision } = require("../utils/division.utils");
const { STOCK_ITEMS } = require("../utils/stock-items.utils");

// ── Safety Guards ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  console.error(
    "❌ FATAL: Seed cannot run in production. Set NODE_ENV=development.",
  );
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────────────────
function sha256(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}
function mkToken(prefix) {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}
function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
function hrsAgo(hrs) {
  return new Date(Date.now() - hrs * 3600_000);
}
function randomId(prefix = "ID") {
  return `${prefix}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

// ── Locations ──────────────────────────────────────────────────────────────
const LOC_DHAKA = {
  division: "Dhaka",
  district: "Dhaka",
  upazila: "Savar",
  unionName: "Tetuljhora",
};
const LOC_KHULNA = {
  division: "Khulna",
  district: "Khulna",
  upazila: "Khalishpur",
  unionName: "Khalishpur Union",
};
const LOC_CTGM = {
  division: "Chattogram",
  district: "Chattogram",
  upazila: "Sitakunda",
  unionName: "Baro Kumira",
};

// ── Allocation per category (kg) ───────────────────────────────────────────
const ALLOC = { A: 5, B: 4, C: 3 };
const ITEM_BY_CATEGORY = { A: "চাল", B: "ডাল", C: "পেঁয়াজ" };

// ── Consumer seed (30 consumers across 3 wards/locations) ─────────────────
const CONSUMER_SEED = [
  // ─── Ward 01 (Dhaka / Tetuljhora) ────────────────────────────────────────
  {
    code: "C0001",
    name: "রহিম উদ্দিন",
    nid: "1234567890123",
    fatherNid: "1234567890001",
    motherNid: "1234567890002",
    phone: "01711000001",
    cat: "A",
    ward: "01",
    loc: LOC_DHAKA,
  },
  {
    code: "C0002",
    name: "করিমা বেগম",
    nid: "1234567890124",
    fatherNid: "1234567890003",
    motherNid: "1234567890004",
    phone: "01711000002",
    cat: "A",
    ward: "01",
    loc: LOC_DHAKA,
  },
  {
    code: "C0003",
    name: "সালমা আক্তার",
    nid: "1234567890125",
    fatherNid: "1234567890005",
    motherNid: "1234567890006",
    phone: "01711000003",
    cat: "B",
    ward: "01",
    loc: LOC_DHAKA,
  },
  {
    code: "C0004",
    name: "জাহিদ হাসান",
    nid: "1234567890126",
    fatherNid: "1234567890007",
    motherNid: "1234567890008",
    phone: "01711000004",
    cat: "B",
    ward: "01",
    loc: LOC_DHAKA,
  },
  {
    code: "C0005",
    name: "মোসা. আসমা",
    nid: "1234567890127",
    fatherNid: "1234567890009",
    motherNid: "1234567890010",
    phone: "01711000005",
    cat: "C",
    ward: "01",
    loc: LOC_DHAKA,
  },
  {
    code: "C0006",
    name: "হাসিনা খাতুন",
    nid: "1234567890128",
    fatherNid: "1234567890011",
    motherNid: "1234567890012",
    phone: "01711000006",
    cat: "A",
    ward: "01",
    loc: LOC_DHAKA,
    status: "Inactive",
  },
  {
    code: "C0007",
    name: "নাসির উদ্দিন",
    nid: "1234567890129",
    fatherNid: "1234567890013",
    motherNid: "1234567890014",
    phone: "01711000007",
    cat: "C",
    ward: "01",
    loc: LOC_DHAKA,
    status: "Revoked",
  },
  {
    code: "C0008",
    name: "ফারজানা বেগম",
    nid: "1234567890130",
    fatherNid: "1234567890015",
    motherNid: "1234567890016",
    phone: "01711000008",
    cat: "B",
    ward: "01",
    loc: LOC_DHAKA,
  },
  {
    code: "C0009",
    name: "আলী আকবর",
    nid: "1234567890131",
    fatherNid: "1234567890017",
    motherNid: "1234567890018",
    phone: "01711000009",
    cat: "A",
    ward: "01",
    loc: LOC_DHAKA,
  },
  {
    code: "C0010",
    name: "মমতাজ বেগম",
    nid: "1234567890132",
    fatherNid: "1234567890019",
    motherNid: "1234567890020",
    phone: "01711000010",
    cat: "C",
    ward: "01",
    loc: LOC_DHAKA,
  },
  // ─── Ward 02 (Khulna / Khalishpur) ───────────────────────────────────────
  {
    code: "C0011",
    name: "আবুল কালাম",
    nid: "9876543210001",
    fatherNid: "9876543210101",
    motherNid: "9876543210201",
    phone: "01812000011",
    cat: "A",
    ward: "02",
    loc: LOC_KHULNA,
  },
  {
    code: "C0012",
    name: "মোছা. রহিমা",
    nid: "9876543210002",
    fatherNid: "9876543210102",
    motherNid: "9876543210202",
    phone: "01812000012",
    cat: "B",
    ward: "02",
    loc: LOC_KHULNA,
  },
  {
    code: "C0013",
    name: "শাহজাহান মিয়া",
    nid: "9876543210003",
    fatherNid: "9876543210103",
    motherNid: "9876543210203",
    phone: "01812000013",
    cat: "C",
    ward: "02",
    loc: LOC_KHULNA,
  },
  {
    code: "C0014",
    name: "জোছনা বেগম",
    nid: "9876543210004",
    fatherNid: "9876543210104",
    motherNid: "9876543210204",
    phone: "01812000014",
    cat: "A",
    ward: "02",
    loc: LOC_KHULNA,
  },
  {
    code: "C0015",
    name: "রফিকুল ইসলাম",
    nid: "9876543210005",
    fatherNid: "9876543210105",
    motherNid: "9876543210205",
    phone: "01812000015",
    cat: "B",
    ward: "02",
    loc: LOC_KHULNA,
  },
  {
    code: "C0016",
    name: "কুলসুম বেগম",
    nid: "9876543210006",
    fatherNid: "9876543210106",
    motherNid: "9876543210206",
    phone: "01812000016",
    cat: "C",
    ward: "02",
    loc: LOC_KHULNA,
  },
  {
    code: "C0017",
    name: "মো. শহিদুল",
    nid: "9876543210007",
    fatherNid: "9876543210107",
    motherNid: "9876543210207",
    phone: "01812000017",
    cat: "A",
    ward: "02",
    loc: LOC_KHULNA,
    status: "Inactive",
  },
  {
    code: "C0018",
    name: "নুরজাহান বেগম",
    nid: "9876543210008",
    fatherNid: "9876543210108",
    motherNid: "9876543210208",
    phone: "01812000018",
    cat: "B",
    ward: "02",
    loc: LOC_KHULNA,
  },
  {
    code: "C0019",
    name: "ইব্রাহিম খলিল",
    nid: "9876543210009",
    fatherNid: "9876543210109",
    motherNid: "9876543210209",
    phone: "01812000019",
    cat: "C",
    ward: "02",
    loc: LOC_KHULNA,
  },
  {
    code: "C0020",
    name: "পারভীন আক্তার",
    nid: "9876543210010",
    fatherNid: "9876543210110",
    motherNid: "9876543210210",
    phone: "01812000020",
    cat: "A",
    ward: "02",
    loc: LOC_KHULNA,
  },
  // ─── Ward 03 (Chattogram / Baro Kumira) ──────────────────────────────────
  {
    code: "C0021",
    name: "আমিনুল হক",
    nid: "5555555550001",
    fatherNid: "5555555550101",
    motherNid: "5555555550201",
    phone: "01913000021",
    cat: "A",
    ward: "03",
    loc: LOC_CTGM,
  },
  {
    code: "C0022",
    name: "শিরিন আক্তার",
    nid: "5555555550002",
    fatherNid: "5555555550102",
    motherNid: "5555555550202",
    phone: "01913000022",
    cat: "B",
    ward: "03",
    loc: LOC_CTGM,
  },
  {
    code: "C0023",
    name: "মতিউর রহমান",
    nid: "5555555550003",
    fatherNid: "5555555550103",
    motherNid: "5555555550203",
    phone: "01913000023",
    cat: "C",
    ward: "03",
    loc: LOC_CTGM,
  },
  {
    code: "C0024",
    name: "ডালিয়া বেগম",
    nid: "5555555550004",
    fatherNid: "5555555550104",
    motherNid: "5555555550204",
    phone: "01913000024",
    cat: "A",
    ward: "03",
    loc: LOC_CTGM,
  },
  {
    code: "C0025",
    name: "কামরুল হাসান",
    nid: "5555555550005",
    fatherNid: "5555555550105",
    motherNid: "5555555550205",
    phone: "01913000025",
    cat: "B",
    ward: "03",
    loc: LOC_CTGM,
  },
  {
    code: "C0026",
    name: "মাহফুজা খানম",
    nid: "5555555550006",
    fatherNid: "5555555550106",
    motherNid: "5555555550206",
    phone: "01913000026",
    cat: "C",
    ward: "03",
    loc: LOC_CTGM,
  },
  {
    code: "C0027",
    name: "বেলাল হোসেন",
    nid: "5555555550007",
    fatherNid: "5555555550107",
    motherNid: "5555555550207",
    phone: "01913000027",
    cat: "A",
    ward: "03",
    loc: LOC_CTGM,
    status: "Inactive",
  },
  {
    code: "C0028",
    name: "রুকাইয়া সুলতানা",
    nid: "5555555550008",
    fatherNid: "5555555550108",
    motherNid: "5555555550208",
    phone: "01913000028",
    cat: "B",
    ward: "03",
    loc: LOC_CTGM,
  },
  {
    code: "C0029",
    name: "মিজানুর রহমান",
    nid: "5555555550009",
    fatherNid: "5555555550109",
    motherNid: "5555555550209",
    phone: "01913000029",
    cat: "C",
    ward: "03",
    loc: LOC_CTGM,
  },
  // ─── C0030: duplicate NID family test case ───────────────────────────────
  {
    code: "C0030",
    name: "সিদ্দিকুর রহমান",
    nid: "1234567890123",
    fatherNid: "1234567890001",
    motherNid: "1234567890002",
    phone: "01711000030",
    cat: "A",
    ward: "01",
    loc: LOC_DHAKA,
    familyDup: true,
  },
];

// ══════════════════════════════════════════════════════════════════════════
(async () => {
  const mongoUri = process.env.MONGO_URI || "";
  if (!mongoUri.includes("localhost") && !mongoUri.includes("127.0.0.1")) {
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    await new Promise((resolve) => {
      rl.question(
        `⚠️  WARNING: Remote DB: ${mongoUri.slice(0, 35)}...\nAll data will be DELETED. Type "yes" to continue: `,
        (answer) => {
          rl.close();
          if (answer.trim().toLowerCase() !== "yes") {
            console.log("Seed cancelled.");
            process.exit(0);
          }
          resolve();
        },
      );
    });
  }

  try {
    await connectDB();
    console.log("➡️  Seed শুরু হচ্ছে...");

    // ── Wipe all collections ──────────────────────────────────────────────
    await Promise.all([
      DistributionRecord.deleteMany({}),
      QueueEntry.deleteMany({}),
      Token.deleteMany({}),
      DistributionSession.deleteMany({}),
      OMSCard.deleteMany({}),
      QRCode.deleteMany({}),
      Consumer.deleteMany({}),
      Family.deleteMany({}),
      Distributor.deleteMany({}),
      User.deleteMany({}),
      StockLedger.deleteMany({}),
      SystemSetting.deleteMany({}),
      AuditLog.deleteMany({}),
      BlacklistEntry.deleteMany({}),
      OfflineQueue.deleteMany({}),
      Complaint.deleteMany({}),
      BlacklistAppeal.deleteMany({}),
      Notification.deleteMany({}),
      SmsOutbox.deleteMany({}),
      AuditReportRequest.deleteMany({}),
      RefreshToken.deleteMany({}),
    ]);
    console.log("   ✓ Collections wiped");

    // ── Password hashes ───────────────────────────────────────────────────
    const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD || "admin123";
    const seedDistributorPassword =
      process.env.SEED_DISTRIBUTOR_PASSWORD || "dist123";
    const seedFieldPassword = process.env.SEED_FIELD_PASSWORD || "field123";

    const [adminPass, distPass, fieldPass] = await Promise.all([
      bcrypt.hash(seedAdminPassword, 10),
      bcrypt.hash(seedDistributorPassword, 10),
      bcrypt.hash(seedFieldPassword, 10),
    ]);

    // ── Admin ─────────────────────────────────────────────────────────────
    const admin = await User.create({
      userType: "Admin",
      name: "কেন্দ্রীয় প্রশাসক",
      phone: "01700000000",
      email: "admin@amar-ration.local",
      passwordHash: adminPass,
      status: "Active",
      tokenVersion: 0,
      mustChangePassword: false,
    });

    // ── Distributor 1: Dhaka Ward 01 ──────────────────────────────────────
    const distUser1 = await User.create({
      userType: "Distributor",
      name: "ডিস্ট্রিবিউটর ঢাকা-০১",
      phone: "01800000001",
      email: "distributor.dhaka.ward01@amar-ration.local",
      contactEmail: "dist.dhaka.w01@gmail.com",
      passwordHash: distPass,
      status: "Active",
      tokenVersion: 0,
      mustChangePassword: false,
      wardNo: "01",
      officeAddress: "তেঁতুলঝোড়া বাজার, সাভার, ঢাকা",
      ...LOC_DHAKA,
      ward: "01",
      authorityStatus: "Active",
      authorityFrom: new Date("2025-01-01"),
      authorityTo: new Date("2027-12-31"),
    });

    // ── Distributor 2: Khulna Ward 02 ─────────────────────────────────────
    const distUser2 = await User.create({
      userType: "Distributor",
      name: "ডিস্ট্রিবিউটর খুলনা-০২",
      phone: "01800000002",
      email: "distributor.khulna.ward02@amar-ration.local",
      contactEmail: "dist.khulna.w02@gmail.com",
      passwordHash: distPass,
      status: "Active",
      tokenVersion: 0,
      mustChangePassword: false,
      wardNo: "02",
      officeAddress: "খালিশপুর বাজার, খুলনা",
      ...LOC_KHULNA,
      ward: "02",
      authorityStatus: "Active",
      authorityFrom: new Date("2025-01-01"),
      authorityTo: new Date("2027-12-31"),
    });

    // ── Distributor 3: Chattogram Ward 03 ────────────────────────────────
    const distUser3 = await User.create({
      userType: "Distributor",
      name: "ডিস্ট্রিবিউটর চট্টগ্রাম-০৩",
      phone: "01800000003",
      email: "distributor.ctg.ward03@amar-ration.local",
      contactEmail: "dist.ctg.w03@gmail.com",
      passwordHash: distPass,
      status: "Active",
      tokenVersion: 0,
      mustChangePassword: false,
      wardNo: "03",
      officeAddress: "বড় কুমিরা বাজার, সীতাকুণ্ড, চট্টগ্রাম",
      ...LOC_CTGM,
      ward: "03",
      authorityStatus: "Pending", // ← pending approval demo
      authorityFrom: new Date("2025-06-01"),
      authorityTo: new Date("2026-12-31"),
    });

    // ── Distributor 4: Suspended (for fraud demo) ─────────────────────────
    const distUser4 = await User.create({
      userType: "Distributor",
      name: "স্থগিত ডিস্ট্রিবিউটর রাজশাহী-০৪",
      phone: "01800000004",
      email: "distributor.raj.ward04@amar-ration.local",
      contactEmail: "dist.raj.w04@gmail.com",
      passwordHash: distPass,
      status: "Suspended",
      tokenVersion: 2,
      mustChangePassword: true,
      wardNo: "04",
      officeAddress: "বোয়ালিয়া, রাজশাহী",
      division: "Rajshahi",
      district: "Rajshahi",
      upazila: "Boalia",
      unionName: "Boalia Union",
      ward: "04",
      authorityStatus: "Suspended",
      authorityFrom: new Date("2025-01-01"),
      authorityTo: new Date("2027-12-31"),
    });

    // ── Field Users ───────────────────────────────────────────────────────
    await User.create({
      userType: "FieldUser",
      name: "ফিল্ড অপারেটর ঢাকা-০১",
      phone: "01900000001",
      email: "field.dhaka.w01@amar-ration.local",
      passwordHash: fieldPass,
      status: "Active",
      tokenVersion: 0,
      mustChangePassword: false,
      wardNo: "01",
      ...LOC_DHAKA,
      ward: "01",
      authorityStatus: "Active",
      authorityFrom: new Date("2025-01-01"),
    });
    await User.create({
      userType: "FieldUser",
      name: "ফিল্ড অপারেটর খুলনা-০২",
      phone: "01900000002",
      email: "field.khulna.w02@amar-ration.local",
      passwordHash: fieldPass,
      status: "Active",
      tokenVersion: 0,
      mustChangePassword: false,
      wardNo: "02",
      ...LOC_KHULNA,
      ward: "02",
      authorityStatus: "Active",
      authorityFrom: new Date("2025-01-01"),
    });

    // ── Distributor profiles ──────────────────────────────────────────────
    const dist1 = await Distributor.create({
      userId: distUser1._id,
      ...LOC_DHAKA,
      wardNo: "01",
      ward: "01",
      authorityStatus: "Active",
      authorityFrom: new Date("2025-01-01"),
      authorityTo: new Date("2027-12-31"),
    });
    const dist2 = await Distributor.create({
      userId: distUser2._id,
      ...LOC_KHULNA,
      wardNo: "02",
      ward: "02",
      authorityStatus: "Active",
      authorityFrom: new Date("2025-01-01"),
      authorityTo: new Date("2027-12-31"),
    });
    const dist3 = await Distributor.create({
      userId: distUser3._id,
      ...LOC_CTGM,
      wardNo: "03",
      ward: "03",
      authorityStatus: "Pending",
      authorityFrom: new Date("2025-06-01"),
      authorityTo: new Date("2026-12-31"),
    });
    const dist4 = await Distributor.create({
      userId: distUser4._id,
      division: "Rajshahi",
      district: "Rajshahi",
      upazila: "Boalia",
      unionName: "Boalia Union",
      wardNo: "04",
      ward: "04",
      authorityStatus: "Suspended",
      authorityFrom: new Date("2025-01-01"),
      authorityTo: new Date("2027-12-31"),
    });
    console.log(
      "   ✓ Users & Distributors (4 distributors, 2 field users, 1 admin)",
    );

    // ── Time helpers ──────────────────────────────────────────────────────
    const now = new Date();
    const today = dateKey(now);
    const yday = dateKey(hrsAgo(24));
    const day2 = dateKey(hrsAgo(48));
    const day3 = dateKey(hrsAgo(72));

    // ── Distribution Sessions: dist1 (3 closed + 1 open) ─────────────────
    const [
      ses1Today,
      ses1Yday,
      ses1Day2,
      ses1Day3,
      ses2Today,
      ses2Yday,
      ses2Day2,
      ses3Yday,
      ses4Yday,
    ] = await DistributionSession.create([
      // dist1 (Dhaka Ward 01)
      {
        distributorId: dist1._id,
        dateKey: today,
        status: "Open",
        openedAt: hrsAgo(5),
      },
      {
        distributorId: dist1._id,
        dateKey: yday,
        status: "Closed",
        openedAt: hrsAgo(29),
        closedAt: hrsAgo(24),
      },
      {
        distributorId: dist1._id,
        dateKey: day2,
        status: "Closed",
        openedAt: hrsAgo(53),
        closedAt: hrsAgo(48),
      },
      {
        distributorId: dist1._id,
        dateKey: day3,
        status: "Closed",
        openedAt: hrsAgo(77),
        closedAt: hrsAgo(72),
      },
      // dist2 (Khulna Ward 02)
      {
        distributorId: dist2._id,
        dateKey: today,
        status: "Open",
        openedAt: hrsAgo(4),
      },
      {
        distributorId: dist2._id,
        dateKey: yday,
        status: "Closed",
        openedAt: hrsAgo(28),
        closedAt: hrsAgo(23),
      },
      {
        distributorId: dist2._id,
        dateKey: day2,
        status: "Closed",
        openedAt: hrsAgo(52),
        closedAt: hrsAgo(47),
      },
      // dist3 (CTG Ward 03) — only yesterday, pending approval
      {
        distributorId: dist3._id,
        dateKey: yday,
        status: "Closed",
        openedAt: hrsAgo(27),
        closedAt: hrsAgo(22),
      },
      // dist4 (Suspended) — old closed session
      {
        distributorId: dist4._id,
        dateKey: day3,
        status: "Closed",
        openedAt: hrsAgo(76),
        closedAt: hrsAgo(73),
      },
    ]);
    console.log("   ✓ Distribution sessions (9 sessions)");

    // ── Consumers, Families, QR, OMS ─────────────────────────────────────
    const distForWard = { "01": dist1, "02": dist2, "03": dist3 };
    const consumers = [];

    for (let i = 0; i < CONSUMER_SEED.length; i++) {
      const row = CONSUMER_SEED[i];
      const qrToken = mkToken(row.code);
      const distForThisWard = distForWard[row.ward] || dist1;

      const family = await Family.create({
        familyKey: sha256(`FAMILY-${row.code}-${row.nid}`),
        fatherNidLast4: row.fatherNid.slice(-4),
        motherNidLast4: row.motherNid.slice(-4),
        flaggedDuplicate: row.familyDup === true,
      });

      // NIDs are passed as raw — Consumer model pre-validate hook encrypts them
      const consumer = await Consumer.create({
        consumerCode: row.code,
        qrToken,
        name: row.name,
        nidLast4: row.nid.slice(-4),
        nidFull: row.nid,
        fatherNidFull: row.fatherNid,
        motherNidFull: row.motherNid,
        status: row.status || "Active",
        category: row.cat,
        guardianPhone: row.phone,
        familyId: family._id,
        createdByDistributor: distForThisWard._id,
        division: normalizeDivision(row.loc.division),
        district: row.loc.district,
        upazila: row.loc.upazila,
        unionName: row.loc.unionName,
        ward: normalizeWardNo(row.ward),
        blacklistStatus: "None",
      });

      const qrStatus = consumer.status === "Active" ? "Valid" : "Revoked";
      const qr = await QRCode.create({
        payload: qrToken,
        payloadHash: sha256(qrToken),
        validFrom: now,
        validTo: new Date(Date.now() + 30 * 86_400_000),
        status: qrStatus,
      });
      await OMSCard.create({
        consumerId: consumer._id,
        cardStatus: consumer.status === "Active" ? "Active" : "Inactive",
        qrCodeId: qr._id,
      });
      consumers.push(consumer);
    }
    console.log(`   ✓ Consumers (${CONSUMER_SEED.length}) + QR + OMS cards`);

    // ── Tokens helper ─────────────────────────────────────────────────────
    const mkTkn = (code, c, dist, ses, status, agoHrs, usedAgo) =>
      Token.create({
        tokenCode: code,
        consumerId: c._id,
        distributorId: dist._id,
        sessionId: ses._id,
        rationItem: ITEM_BY_CATEGORY[c.category] || STOCK_ITEMS[0],
        rationQtyKg: ALLOC[c.category],
        status,
        issuedAt: hrsAgo(agoHrs),
        iotVerified: status === "Used" ? Math.random() > 0.4 : false,
        ...(usedAgo !== undefined ? { usedAt: hrsAgo(usedAgo) } : {}),
      });

    // Dist1 today (ses1Today): some Used, some Issued, one Cancelled
    const [t01, t02, t03, t04, t05] = await Promise.all([
      mkTkn("TKN-2026-D1-001", consumers[0], dist1, ses1Today, "Used", 4.5, 3), // C0001 A ok
      mkTkn(
        "TKN-2026-D1-002",
        consumers[1],
        dist1,
        ses1Today,
        "Used",
        4.2,
        3.2,
      ), // C0002 A mismatch
      mkTkn("TKN-2026-D1-003", consumers[2], dist1, ses1Today, "Issued", 1), // C0003 B pending
      mkTkn("TKN-2026-D1-004", consumers[3], dist1, ses1Today, "Cancelled", 3), // C0004 cancelled
      mkTkn(
        "TKN-2026-D1-005",
        consumers[7],
        dist1,
        ses1Today,
        "Used",
        3.8,
        2.5,
      ), // C0008 B ok
    ]);
    // Dist1 yesterday
    const [t06, t07, t08] = await Promise.all([
      mkTkn("TKN-2026-D1-006", consumers[4], dist1, ses1Yday, "Used", 27, 26), // C0005 C ok
      mkTkn("TKN-2026-D1-007", consumers[8], dist1, ses1Yday, "Used", 26, 25.5), // C0009 A ok
      mkTkn("TKN-2026-D1-008", consumers[9], dist1, ses1Yday, "Used", 25, 24), // C0010 C mismatch
    ]);
    // Dist1 day2
    const [t09, t10] = await Promise.all([
      mkTkn("TKN-2026-D1-009", consumers[0], dist1, ses1Day2, "Used", 51, 50),
      mkTkn("TKN-2026-D1-010", consumers[1], dist1, ses1Day2, "Used", 50, 49),
    ]);
    // Dist1 day3
    const [t11, t12] = await Promise.all([
      mkTkn("TKN-2026-D1-011", consumers[2], dist1, ses1Day3, "Used", 75, 74),
      mkTkn("TKN-2026-D1-012", consumers[3], dist1, ses1Day3, "Used", 74, 73),
    ]);
    // Dist2 today
    const [t13, t14, t15] = await Promise.all([
      mkTkn("TKN-2026-D2-001", consumers[10], dist2, ses2Today, "Used", 4, 3),
      mkTkn(
        "TKN-2026-D2-002",
        consumers[11],
        dist2,
        ses2Today,
        "Used",
        3.8,
        2.8,
      ), // mismatch
      mkTkn("TKN-2026-D2-003", consumers[12], dist2, ses2Today, "Issued", 1),
    ]);
    // Dist2 yesterday
    const [t16, t17] = await Promise.all([
      mkTkn("TKN-2026-D2-004", consumers[13], dist2, ses2Yday, "Used", 26, 25),
      mkTkn("TKN-2026-D2-005", consumers[14], dist2, ses2Yday, "Used", 25, 24),
    ]);
    // Dist2 day2
    const [t18] = await Promise.all([
      mkTkn("TKN-2026-D2-006", consumers[15], dist2, ses2Day2, "Used", 50, 49),
    ]);
    // Dist3 yesterday
    const [t19, t20] = await Promise.all([
      mkTkn("TKN-2026-D3-001", consumers[20], dist3, ses3Yday, "Used", 26, 25),
      mkTkn("TKN-2026-D3-002", consumers[21], dist3, ses3Yday, "Used", 25, 24),
    ]);
    // Dist4 (suspended) — old tokens for fraud score demo
    const [t21, t22, t23] = await Promise.all([
      mkTkn("TKN-2026-D4-001", consumers[0], dist4, ses4Yday, "Used", 74, 73),
      mkTkn("TKN-2026-D4-002", consumers[1], dist4, ses4Yday, "Used", 73, 72),
      mkTkn("TKN-2026-D4-003", consumers[2], dist4, ses4Yday, "Used", 72, 71),
    ]);
    console.log("   ✓ Tokens (23 tokens)");

    // ── Distribution Records ──────────────────────────────────────────────
    await DistributionRecord.insertMany([
      // dist1 today
      {
        tokenId: t01._id,
        expectedKg: ALLOC.A,
        actualKg: 5.0,
        mismatch: false,
        createdAt: hrsAgo(3),
      },
      {
        tokenId: t02._id,
        expectedKg: ALLOC.A,
        actualKg: 4.4,
        mismatch: true,
        createdAt: hrsAgo(3.2),
      },
      {
        tokenId: t05._id,
        expectedKg: ALLOC.B,
        actualKg: 4.0,
        mismatch: false,
        createdAt: hrsAgo(2.5),
      },
      // dist1 yesterday
      {
        tokenId: t06._id,
        expectedKg: ALLOC.C,
        actualKg: 3.0,
        mismatch: false,
        createdAt: hrsAgo(26),
      },
      {
        tokenId: t07._id,
        expectedKg: ALLOC.A,
        actualKg: 5.0,
        mismatch: false,
        createdAt: hrsAgo(25.5),
      },
      {
        tokenId: t08._id,
        expectedKg: ALLOC.C,
        actualKg: 2.5,
        mismatch: true,
        createdAt: hrsAgo(24),
      },
      // dist1 day2
      {
        tokenId: t09._id,
        expectedKg: ALLOC.A,
        actualKg: 5.0,
        mismatch: false,
        createdAt: hrsAgo(50),
      },
      {
        tokenId: t10._id,
        expectedKg: ALLOC.A,
        actualKg: 4.6,
        mismatch: true,
        createdAt: hrsAgo(49),
      },
      // dist1 day3
      {
        tokenId: t11._id,
        expectedKg: ALLOC.B,
        actualKg: 4.0,
        mismatch: false,
        createdAt: hrsAgo(74),
      },
      {
        tokenId: t12._id,
        expectedKg: ALLOC.B,
        actualKg: 3.9,
        mismatch: false,
        createdAt: hrsAgo(73),
      },
      // dist2 today
      {
        tokenId: t13._id,
        expectedKg: ALLOC.A,
        actualKg: 5.0,
        mismatch: false,
        createdAt: hrsAgo(3),
      },
      {
        tokenId: t14._id,
        expectedKg: ALLOC.B,
        actualKg: 3.4,
        mismatch: true,
        createdAt: hrsAgo(2.8),
      },
      // dist2 yesterday
      {
        tokenId: t16._id,
        expectedKg: ALLOC.A,
        actualKg: 5.0,
        mismatch: false,
        createdAt: hrsAgo(25),
      },
      {
        tokenId: t17._id,
        expectedKg: ALLOC.B,
        actualKg: 4.0,
        mismatch: false,
        createdAt: hrsAgo(24),
      },
      // dist2 day2
      {
        tokenId: t18._id,
        expectedKg: ALLOC.C,
        actualKg: 3.0,
        mismatch: false,
        createdAt: hrsAgo(49),
      },
      // dist3 yesterday
      {
        tokenId: t19._id,
        expectedKg: ALLOC.A,
        actualKg: 5.0,
        mismatch: false,
        createdAt: hrsAgo(25),
      },
      {
        tokenId: t20._id,
        expectedKg: ALLOC.B,
        actualKg: 4.0,
        mismatch: false,
        createdAt: hrsAgo(24),
      },
      // dist4 (fraud: 3/3 mismatch for demo)
      {
        tokenId: t21._id,
        expectedKg: ALLOC.A,
        actualKg: 3.8,
        mismatch: true,
        createdAt: hrsAgo(73),
      },
      {
        tokenId: t22._id,
        expectedKg: ALLOC.A,
        actualKg: 3.5,
        mismatch: true,
        createdAt: hrsAgo(72),
      },
      {
        tokenId: t23._id,
        expectedKg: ALLOC.B,
        actualKg: 2.9,
        mismatch: true,
        createdAt: hrsAgo(71),
      },
    ]);
    console.log("   ✓ Distribution records (19 records, 8 mismatches)");

    // ── Stock Ledger ──────────────────────────────────────────────────────
    const stockEntries = [];
    const addStockInEntries = (distributorId, dateRefPairs, qtyMap) => {
      for (const [dk, ref] of dateRefPairs) {
        for (const item of STOCK_ITEMS) {
          stockEntries.push({
            distributorId,
            dateKey: dk,
            type: "IN",
            item,
            qtyKg: qtyMap[item],
            ref: `${ref}-${item}`,
          });
        }
      }
    };

    addStockInEntries(
      dist1._id,
      [
        [today, "BATCH-D1-T"],
        [yday, "BATCH-D1-Y"],
        [day2, "BATCH-D1-2"],
        [day3, "BATCH-D1-3"],
      ],
      { চাল: 300, ডাল: 180, পেঁয়াজ: 120 },
    );

    addStockInEntries(
      dist2._id,
      [
        [today, "BATCH-D2-T"],
        [yday, "BATCH-D2-Y"],
        [day2, "BATCH-D2-2"],
      ],
      { চাল: 250, ডাল: 160, পেঁয়াজ: 100 },
    );

    addStockInEntries(dist3._id, [[yday, "BATCH-D3-Y"]], {
      চাল: 220,
      ডাল: 140,
      পেঁয়াজ: 90,
    });

    addStockInEntries(dist4._id, [[day3, "BATCH-D4-3"]], {
      চাল: 150,
      ডাল: 90,
      পেঁয়াজ: 60,
    });

    stockEntries.push(
      // dist1 today
      {
        distributorId: dist1._id,
        dateKey: today,
        type: "OUT",
        item: "চাল",
        qtyKg: 5.0,
        ref: "TKN-2026-D1-001",
      },
      {
        distributorId: dist1._id,
        dateKey: today,
        type: "OUT",
        item: "চাল",
        qtyKg: 4.4,
        ref: "TKN-2026-D1-002",
      },
      {
        distributorId: dist1._id,
        dateKey: today,
        type: "OUT",
        item: "ডাল",
        qtyKg: 4.0,
        ref: "TKN-2026-D1-005",
      },

      // dist1 yesterday
      {
        distributorId: dist1._id,
        dateKey: yday,
        type: "OUT",
        item: "পেঁয়াজ",
        qtyKg: 3.0,
        ref: "TKN-2026-D1-006",
      },
      {
        distributorId: dist1._id,
        dateKey: yday,
        type: "OUT",
        item: "চাল",
        qtyKg: 5.0,
        ref: "TKN-2026-D1-007",
      },
      {
        distributorId: dist1._id,
        dateKey: yday,
        type: "OUT",
        item: "পেঁয়াজ",
        qtyKg: 2.5,
        ref: "TKN-2026-D1-008",
      },

      // dist1 day2/day3
      {
        distributorId: dist1._id,
        dateKey: day2,
        type: "OUT",
        item: "চাল",
        qtyKg: 5.0,
        ref: "TKN-2026-D1-009",
      },
      {
        distributorId: dist1._id,
        dateKey: day2,
        type: "OUT",
        item: "চাল",
        qtyKg: 4.6,
        ref: "TKN-2026-D1-010",
      },
      {
        distributorId: dist1._id,
        dateKey: day3,
        type: "OUT",
        item: "ডাল",
        qtyKg: 4.0,
        ref: "TKN-2026-D1-011",
      },
      {
        distributorId: dist1._id,
        dateKey: day3,
        type: "OUT",
        item: "ডাল",
        qtyKg: 3.9,
        ref: "TKN-2026-D1-012",
      },

      // dist2 today/yesterday/day2
      {
        distributorId: dist2._id,
        dateKey: today,
        type: "OUT",
        item: "চাল",
        qtyKg: 5.0,
        ref: "TKN-2026-D2-001",
      },
      {
        distributorId: dist2._id,
        dateKey: today,
        type: "OUT",
        item: "ডাল",
        qtyKg: 3.4,
        ref: "TKN-2026-D2-002",
      },
      {
        distributorId: dist2._id,
        dateKey: yday,
        type: "OUT",
        item: "চাল",
        qtyKg: 5.0,
        ref: "TKN-2026-D2-004",
      },
      {
        distributorId: dist2._id,
        dateKey: yday,
        type: "OUT",
        item: "ডাল",
        qtyKg: 4.0,
        ref: "TKN-2026-D2-005",
      },
      {
        distributorId: dist2._id,
        dateKey: day2,
        type: "OUT",
        item: "পেঁয়াজ",
        qtyKg: 3.0,
        ref: "TKN-2026-D2-006",
      },

      // dist3 yesterday
      {
        distributorId: dist3._id,
        dateKey: yday,
        type: "OUT",
        item: "চাল",
        qtyKg: 5.0,
        ref: "TKN-2026-D3-001",
      },
      {
        distributorId: dist3._id,
        dateKey: yday,
        type: "OUT",
        item: "ডাল",
        qtyKg: 4.0,
        ref: "TKN-2026-D3-002",
      },

      // dist4 day3 (fraud demo)
      {
        distributorId: dist4._id,
        dateKey: day3,
        type: "OUT",
        item: "চাল",
        qtyKg: 3.8,
        ref: "TKN-2026-D4-001",
      },
      {
        distributorId: dist4._id,
        dateKey: day3,
        type: "OUT",
        item: "চাল",
        qtyKg: 3.5,
        ref: "TKN-2026-D4-002",
      },
      {
        distributorId: dist4._id,
        dateKey: day3,
        type: "OUT",
        item: "ডাল",
        qtyKg: 2.9,
        ref: "TKN-2026-D4-003",
      },
    );
    await StockLedger.insertMany(stockEntries);
    console.log(`   ✓ Stock ledger (${stockEntries.length} entries)`);

    // ── Blacklist Entries ─────────────────────────────────────────────────
    // C0007 (Revoked) gets a permanent blacklist
    const bl1 = await BlacklistEntry.create({
      distributorId: dist1._id,
      createdByUserId: admin._id,
      targetType: "Consumer",
      targetRefId: String(consumers[6]._id),
      blockType: "Permanent",
      reason: "ভুয়া NID নম্বর — অ্যাডমিন কর্তৃক বাতিল",
      active: true,
    });
    await Consumer.findByIdAndUpdate(consumers[6]._id, {
      blacklistStatus: "Permanent",
    });

    // C0017 (Inactive) gets a temporary blacklist
    const bl2 = await BlacklistEntry.create({
      distributorId: dist2._id,
      createdByUserId: admin._id,
      targetType: "Consumer",
      targetRefId: String(consumers[16]._id),
      blockType: "Temporary",
      reason: "৩ বার ওজন মিসম্যাচ — স্বয়ংক্রিয় ব্লক",
      active: true,
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    });
    await Consumer.findByIdAndUpdate(consumers[16]._id, {
      blacklistStatus: "Temp",
    });

    // Dist4 gets a distributor blacklist
    await BlacklistEntry.create({
      distributorId: dist4._id,
      createdByUserId: admin._id,
      targetType: "Distributor",
      targetRefId: String(distUser4._id),
      blockType: "Temporary",
      reason: "পুনরাবৃত্তি মিসম্যাচ — জালিয়াতি সন্দেহ",
      active: true,
      expiresAt: new Date(Date.now() + 14 * 86_400_000),
    });
    console.log("   ✓ Blacklist entries (3)");

    // ── Complaints (5 sample complaints) ─────────────────────────────────
    await Complaint.insertMany([
      {
        complaintId: randomId("CMP"),
        consumerPhone: "01711000001",
        category: "weight_mismatch",
        description:
          "আমি ৫ কেজি পাওয়ার কথা কিন্তু মাত্র ৪.২ কেজি পেয়েছি। ডিস্ট্রিবিউটর সঠিকভাবে পরিমাপ করেননি।",
        status: "open",
        tokenCode: "TKN-2026-D1-002",
        createdAt: hrsAgo(5),
      },
      {
        complaintId: randomId("CMP"),
        consumerPhone: "01812000012",
        category: "missing_ration",
        description:
          "আমার টোকেন আছে কিন্তু আজকের সেশনে রেশন পাইনি। আমাকে বলা হয়েছিল স্টক শেষ।",
        status: "under_review",
        createdAt: hrsAgo(10),
      },
      {
        complaintId: randomId("CMP"),
        consumerPhone: "01711000004",
        category: "distributor_behavior",
        description:
          "বিতরণকারী আমার সাথে অভদ্র আচরণ করেছেন এবং আমার কার্ড দেখতে অস্বীকার করেছেন।",
        status: "resolved",
        adminNote: "তদন্ত করা হয়েছে। বিতরণকারীকে সতর্ক করা হয়েছে।",
        resolvedBy: admin._id,
        resolvedAt: hrsAgo(2),
        createdAt: hrsAgo(20),
      },
      {
        complaintId: randomId("CMP"),
        consumerPhone: "01913000023",
        category: "wrong_amount",
        description:
          "আমার ক্যাটাগরি-C হওয়া উচিত ৩ কেজি, কিন্তু মাত্র ২.৫ কেজি দেওয়া হয়েছে।",
        status: "open",
        createdAt: hrsAgo(3),
      },
      {
        complaintId: randomId("CMP"),
        consumerPhone: "01812000015",
        category: "registration_issue",
        description:
          "আমার নাম সিস্টেমে ভুল আছে। সঠিক নাম 'রফিকুল ইসলাম' কিন্তু 'রফিক' লেখা আছে।",
        status: "rejected",
        adminNote: "নাম পরিবর্তনের জন্য সরাসরি ওয়ার্ড অফিসে যোগাযোগ করুন।",
        resolvedBy: admin._id,
        resolvedAt: hrsAgo(48),
        createdAt: hrsAgo(72),
      },
    ]);
    console.log("   ✓ Complaints (5)");

    // ── Blacklist Appeals (3 sample appeals) ─────────────────────────────
    await BlacklistAppeal.insertMany([
      {
        appealId: randomId("APL"),
        consumerId: consumers[6]._id,
        consumerPhone: "01711000007",
        blacklistEntryId: bl1._id,
        reason:
          "আমার NID সঠিক। আমি জাতীয় পরিচয়পত্র অধিদপ্তর থেকে যাচাই করেছি।",
        supportingInfo:
          "NID নম্বর: ১২৩৪৫৬৭৮৯০১২৯, নির্বাচন কমিশন কর্তৃক যাচাইকৃত।",
        status: "pending",
        createdAt: hrsAgo(12),
      },
      {
        appealId: randomId("APL"),
        consumerId: consumers[16]._id,
        consumerPhone: "01812000017",
        blacklistEntryId: bl2._id,
        reason: "মিসম্যাচ আমার কারণে নয়, স্কেলটি নষ্ট ছিল বলে পরে জানা গেছে।",
        supportingInfo:
          "সেশন ডেটা দেখলে বোঝা যাবে একই সেশনে অন্যদেরও মিসম্যাচ হয়েছে।",
        status: "under_review",
        createdAt: hrsAgo(48),
      },
      {
        appealId: randomId("APL"),
        consumerId: consumers[6]._id,
        consumerPhone: "01711000007",
        reason: "আগের আবেদনের ফলো-আপ। অনুগ্রহ করে পুনর্বিবেচনা করুন।",
        status: "rejected",
        adminNote: "তথ্য যাচাই সম্পন্ন। ব্ল্যাকলিস্ট বহাল থাকবে।",
        reviewedBy: admin._id,
        reviewedAt: hrsAgo(6),
        createdAt: hrsAgo(72),
      },
    ]);
    console.log("   ✓ Blacklist appeals (3)");

    // ── Queue Entries (for today's open session) ──────────────────────────
    const queueEntries = [];
    // sess1Today: 5 waiting, 1 serving, 2 done, 1 skipped
    const queueConsumers = [
      consumers[0],
      consumers[1],
      consumers[2],
      consumers[3],
      consumers[4],
      consumers[7],
      consumers[8],
      consumers[9],
    ];
    const qStatuses = [
      "done",
      "done",
      "serving",
      "waiting",
      "waiting",
      "waiting",
      "waiting",
      "skipped",
    ];
    for (let qi = 0; qi < queueConsumers.length; qi++) {
      queueEntries.push({
        sessionId: ses1Today._id,
        consumerId: queueConsumers[qi]._id,
        consumerName: queueConsumers[qi].name,
        consumerCode: queueConsumers[qi].consumerCode,
        category: queueConsumers[qi].category,
        queueNumber: qi + 1,
        status: qStatuses[qi],
        issuedAt: hrsAgo(5 - qi * 0.5),
        ...(qStatuses[qi] === "done"
          ? {
              calledAt: hrsAgo(4.5 - qi * 0.5),
              completedAt: hrsAgo(4 - qi * 0.5),
            }
          : {}),
        ...(qStatuses[qi] === "serving" ? { calledAt: hrsAgo(2) } : {}),
      });
    }
    // sess2Today: dist2 queue
    for (let qi = 0; qi < 4; qi++) {
      queueEntries.push({
        sessionId: ses2Today._id,
        consumerId: consumers[10 + qi]._id,
        consumerName: consumers[10 + qi].name,
        consumerCode: consumers[10 + qi].consumerCode,
        category: consumers[10 + qi].category,
        queueNumber: qi + 1,
        status: qi === 0 ? "done" : qi === 1 ? "serving" : "waiting",
        issuedAt: hrsAgo(4 - qi * 0.3),
        ...(qi === 0 ? { calledAt: hrsAgo(3.5), completedAt: hrsAgo(3) } : {}),
        ...(qi === 1 ? { calledAt: hrsAgo(2.5) } : {}),
      });
    }
    // Use insertMany with try/ignore on duplicate key for queue
    try {
      await QueueEntry.insertMany(queueEntries, { ordered: false });
    } catch (e) {
      if (!e.code || e.code !== 11000) throw e;
    }
    console.log(`   ✓ Queue entries (${queueEntries.length})`);

    // ── Offline Queue ─────────────────────────────────────────────────────
    await OfflineQueue.insertMany([
      {
        distributorId: dist1._id,
        payload: { action: "SCAN", consumerCode: consumers[4].consumerCode },
        status: "Pending",
      },
      {
        distributorId: dist1._id,
        payload: { action: "SCAN", consumerCode: consumers[5].consumerCode },
        status: "Pending",
      },
      {
        distributorId: dist1._id,
        payload: { action: "COMPLETE", tokenCode: "TKN-2026-D1-006" },
        status: "Synced",
      },
      {
        distributorId: dist2._id,
        payload: { action: "SCAN", consumerCode: consumers[15].consumerCode },
        status: "Failed",
        errorMessage: "Consumer blacklisted",
      },
    ]);
    console.log("   ✓ Offline queue (4 entries)");

    // ── System Settings ───────────────────────────────────────────────────
    await SystemSetting.insertMany([
      { key: "weightThresholdKg", value: { maxDiff: 0.3 } },
      { key: "qrCycleDays", value: { days: 30 } },
      { key: "tokenLimitPerDay", value: { limit: 1 } },
      { key: "system:maintenanceMode", value: { enabled: false } },
      {
        key: "distributor:global:settings",
        value: {
          policy: { authorityMonths: 12, adminApprovalRequired: true },
          distribution: {
            weightThresholdKg: 0.3,
            autoPauseOnMismatch: true,
            tokenPerConsumerPerDay: 1,
          },
          qr: {
            expiryCycleDays: 30,
            autoRotation: true,
            revokeBehavior: "StrictReject",
          },
          allocation: { A: 5, B: 4, C: 3 },
          fraud: { autoBlacklistMismatchCount: 3, temporaryBlockDays: 7 },
          offline: { enabled: true, conflictPolicy: "ServerWins" },
          notifications: { sms: true, app: true },
          audit: { retentionYears: 5, immutable: true },
        },
      },
    ]);
    console.log("   ✓ System settings");

    // ── Audit Logs ────────────────────────────────────────────────────────
    await AuditLog.insertMany([
      {
        actorUserId: distUser1._id,
        actorType: "Distributor",
        action: "TOKEN_ISSUED",
        entityType: "Token",
        entityId: String(t01._id),
        severity: "Info",
        meta: { token: "TKN-2026-D1-001", consumer: "C0001" },
      },
      {
        actorUserId: distUser1._id,
        actorType: "Distributor",
        action: "WEIGHT_MISMATCH",
        entityType: "Token",
        entityId: String(t02._id),
        severity: "Critical",
        meta: { token: "TKN-2026-D1-002", expected: 5, actual: 4.4 },
      },
      {
        actorUserId: distUser1._id,
        actorType: "Distributor",
        action: "TOKEN_CANCELLED",
        entityType: "Token",
        entityId: String(t04._id),
        severity: "Warning",
        meta: { token: "TKN-2026-D1-004", consumer: "C0004" },
      },
      {
        actorUserId: distUser2._id,
        actorType: "Distributor",
        action: "WEIGHT_MISMATCH",
        entityType: "Token",
        entityId: String(t14._id),
        severity: "Critical",
        meta: { token: "TKN-2026-D2-002", expected: 4, actual: 3.4 },
      },
      {
        actorUserId: distUser4._id,
        actorType: "Distributor",
        action: "WEIGHT_MISMATCH",
        entityType: "Token",
        entityId: String(t21._id),
        severity: "Critical",
        meta: { token: "TKN-2026-D4-001", expected: 5, actual: 3.8 },
      },
      {
        actorUserId: distUser4._id,
        actorType: "Distributor",
        action: "WEIGHT_MISMATCH",
        entityType: "Token",
        entityId: String(t22._id),
        severity: "Critical",
        meta: { token: "TKN-2026-D4-002", expected: 5, actual: 3.5 },
      },
      {
        actorUserId: distUser4._id,
        actorType: "Distributor",
        action: "WEIGHT_MISMATCH",
        entityType: "Token",
        entityId: String(t23._id),
        severity: "Critical",
        meta: { token: "TKN-2026-D4-003", expected: 4, actual: 2.9 },
      },
      {
        actorUserId: admin._id,
        actorType: "Central Admin",
        action: "BLACKLIST_CREATED",
        entityType: "BlacklistEntry",
        entityId: String(bl1._id),
        severity: "Warning",
        meta: { targetType: "Consumer", consumer: "C0007" },
      },
      {
        actorUserId: admin._id,
        actorType: "Central Admin",
        action: "BLACKLIST_CREATED",
        entityType: "BlacklistEntry",
        entityId: String(bl2._id),
        severity: "Warning",
        meta: { targetType: "Consumer", consumer: "C0017" },
      },
      {
        actorUserId: admin._id,
        actorType: "Central Admin",
        action: "DISTRIBUTOR_STATUS_UPDATED",
        entityType: "User",
        entityId: String(distUser4._id),
        severity: "Warning",
        meta: { status: "Suspended", reason: "Fraud flags" },
      },
      {
        actorUserId: distUser1._id,
        actorType: "Distributor",
        action: "SESSION_OPENED",
        entityType: "DistributionSession",
        entityId: String(ses1Today._id),
        severity: "Info",
        meta: { dateKey: today },
      },
      {
        actorUserId: distUser3._id,
        actorType: "Distributor",
        action: "REGISTRATION_ATTEMPT",
        entityType: "Distributor",
        entityId: String(dist3._id),
        severity: "Info",
        meta: { status: "Pending approval" },
      },
    ]);
    console.log("   ✓ Audit logs (12 entries)");

    // ── Final Summary ─────────────────────────────────────────────────────
    console.log("\n✅ Seed সম্পন্ন!");
    console.log("════════════════════════════════════════════════════");
    console.log("🔑 লগইন তথ্য:");
    console.log(
      "   Admin          : admin@amar-ration.local  / 01700000000  → admin123",
    );
    console.log(
      "   Dist Dhaka-01  : distributor.dhaka.ward01@amar-ration.local / 01800000001 → dist123",
    );
    console.log(
      "   Dist Khulna-02 : distributor.khulna.ward02@amar-ration.local / 01800000002 → dist123",
    );
    console.log(
      "   Dist CTG-03    : distributor.ctg.ward03@amar-ration.local / 01800000003 → dist123 [PENDING]",
    );
    console.log(
      "   Dist Raj-04    : distributor.raj.ward04@amar-ration.local / 01800000004 → dist123 [SUSPENDED]",
    );
    console.log(
      "   Field Dhaka    : field.dhaka.w01@amar-ration.local / 01900000001 → field123",
    );
    console.log("════════════════════════════════════════════════════");
    console.log(
      `📦 Consumers        : ${CONSUMER_SEED.length} (wards 01/02/03 + 1 family-dup)`,
    );
    console.log(`🎟️  Tokens           : 23 across 9 sessions`);
    console.log(
      `📊 Records          : 19 (8 mismatches, dist4 has 3/3 = CRITICAL fraud)`,
    );
    console.log(`🏭 Stock ledger     : ${stockEntries.length} entries`);
    console.log(
      `🔒 Blacklist entries: 3 (1 permanent, 1 temp consumer, 1 distributor)`,
    );
    console.log(
      `📣 Complaints       : 5 (2 open, 1 resolved, 1 rejected, 1 under_review)`,
    );
    console.log(
      `📨 Appeals          : 3 (1 pending, 1 under_review, 1 rejected)`,
    );
    console.log(
      `🔢 Queue entries    : ${queueEntries.length} (both open sessions)`,
    );
    console.log(`📝 Audit logs       : 12`);
    console.log(`🕐 Sample QR token  : ${consumers[0].qrToken}`);
    console.log("════════════════════════════════════════════════════");
    console.log("💡 Demo scenarios:");
    console.log(
      "   Fraud Dashboard  → dist4 (Rajshahi-04) has 3 mismatches → CRITICAL score",
    );
    console.log(
      "   Live Queue       → sess1Today has 5 entries (1 serving, 4 waiting)",
    );
    console.log(
      "   Stock Suggestion → 3+ closed sessions per distributor → MA calculated",
    );
    console.log("   Family Duplicate → C0030 shares NID with C0001 → flagged");
    console.log("   Pending Approval → dist3 (CTG-03) needs admin approval");
    process.exit(0);
  } catch (e) {
    console.error("❌ Seed error:", e);
    process.exit(1);
  }
})();
