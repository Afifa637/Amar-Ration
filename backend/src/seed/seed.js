require("dotenv").config();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { connectDB } = require("../config/db");

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
const { normalizeWardNo } = require("../utils/ward.utils");
const { normalizeDivision } = require("../utils/division.utils");

if (process.env.NODE_ENV === "production") {
  console.error(
    "❌ FATAL: Seed cannot run in production. Set NODE_ENV=development.",
  );
  process.exit(1);
}

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function mkToken(prefix) {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// 24 consumers across 3 wards
const CONSUMER_SEED = [
  // Ward-01
  {
    code: "C0001",
    name: "রহিম উদ্দিন",
    nidLast4: "1101",
    nidFull: "12345678901101",
    fatherNidFull: "12345678901001",
    motherNidFull: "12345678901002",
    category: "A",
    ward: "01",
  },
  {
    code: "C0002",
    name: "করিমা বেগম",
    nidLast4: "1102",
    nidFull: "12345678901102",
    fatherNidFull: "12345678901003",
    motherNidFull: "12345678901004",
    category: "A",
    ward: "01",
  },
  {
    code: "C0003",
    name: "সালমা আক্তার",
    nidLast4: "1103",
    nidFull: "12345678901103",
    fatherNidFull: "12345678901005",
    motherNidFull: "12345678901006",
    category: "B",
    ward: "01",
  },
  {
    code: "C0004",
    name: "জাহিদ হাসান",
    nidLast4: "1104",
    nidFull: "12345678901104",
    fatherNidFull: "12345678901007",
    motherNidFull: "12345678901008",
    category: "B",
    ward: "01",
  },
  {
    code: "C0005",
    name: "মোসা. আসমা",
    nidLast4: "1105",
    nidFull: "12345678901105",
    fatherNidFull: "12345678901009",
    motherNidFull: "12345678901010",
    category: "C",
    ward: "01",
  },
  {
    code: "C0006",
    name: "হাসিনা খাতুন",
    nidLast4: "1106",
    nidFull: "12345678901106",
    fatherNidFull: "12345678901011",
    motherNidFull: "12345678901012",
    category: "A",
    ward: "01",
    status: "Inactive",
  },
  {
    code: "C0007",
    name: "নাসির উদ্দিন",
    nidLast4: "1107",
    nidFull: "12345678901107",
    fatherNidFull: "12345678901013",
    motherNidFull: "12345678901014",
    category: "C",
    ward: "01",
    status: "Revoked",
  },
  {
    code: "C0008",
    name: "ফারজানা বেগম",
    nidLast4: "1108",
    nidFull: "12345678901108",
    fatherNidFull: "12345678901015",
    motherNidFull: "12345678901016",
    category: "B",
    ward: "01",
  },
  // Ward-02
  {
    code: "C0009",
    name: "আবুল কালাম",
    nidLast4: "2201",
    nidFull: "12345678902201",
    fatherNidFull: "12345678902001",
    motherNidFull: "12345678902002",
    category: "A",
    ward: "02",
  },
  {
    code: "C0010",
    name: "মোছা. রহিমা",
    nidLast4: "2202",
    nidFull: "12345678902202",
    fatherNidFull: "12345678902003",
    motherNidFull: "12345678902004",
    category: "B",
    ward: "02",
  },
  {
    code: "C0011",
    name: "শাহজাহান মিয়া",
    nidLast4: "2203",
    nidFull: "12345678902203",
    fatherNidFull: "12345678902005",
    motherNidFull: "12345678902006",
    category: "C",
    ward: "02",
  },
  {
    code: "C0012",
    name: "জোছনা বেগম",
    nidLast4: "2204",
    nidFull: "12345678902204",
    fatherNidFull: "12345678902007",
    motherNidFull: "12345678902008",
    category: "A",
    ward: "02",
  },
  {
    code: "C0013",
    name: "রফিকুল ইসলাম",
    nidLast4: "2205",
    nidFull: "12345678902205",
    fatherNidFull: "12345678902009",
    motherNidFull: "12345678902010",
    category: "B",
    ward: "02",
  },
  {
    code: "C0014",
    name: "কুলসুম বেগম",
    nidLast4: "2206",
    nidFull: "12345678902206",
    fatherNidFull: "12345678902011",
    motherNidFull: "12345678902012",
    category: "C",
    ward: "02",
  },
  {
    code: "C0015",
    name: "মো. শহিদুল",
    nidLast4: "2207",
    nidFull: "12345678902207",
    fatherNidFull: "12345678902013",
    motherNidFull: "12345678902014",
    category: "A",
    ward: "02",
    status: "Inactive",
  },
  {
    code: "C0016",
    name: "নুরজাহান বেগম",
    nidLast4: "2208",
    nidFull: "12345678902208",
    fatherNidFull: "12345678902015",
    motherNidFull: "12345678902016",
    category: "B",
    ward: "02",
  },
  // Ward-03
  {
    code: "C0017",
    name: "আমিনুল হক",
    nidLast4: "3301",
    nidFull: "12345678903301",
    fatherNidFull: "12345678903001",
    motherNidFull: "12345678903002",
    category: "A",
    ward: "03",
  },
  {
    code: "C0018",
    name: "শিরিন আক্তার",
    nidLast4: "3302",
    nidFull: "12345678903302",
    fatherNidFull: "12345678903003",
    motherNidFull: "12345678903004",
    category: "B",
    ward: "03",
  },
  {
    code: "C0019",
    name: "মতিউর রহমান",
    nidLast4: "3303",
    nidFull: "12345678903303",
    fatherNidFull: "12345678903005",
    motherNidFull: "12345678903006",
    category: "C",
    ward: "03",
  },
  {
    code: "C0020",
    name: "ডালিয়া বেগম",
    nidLast4: "3304",
    nidFull: "12345678903304",
    fatherNidFull: "12345678903007",
    motherNidFull: "12345678903008",
    category: "A",
    ward: "03",
  },
  {
    code: "C0021",
    name: "কামরুল হাসান",
    nidLast4: "3305",
    nidFull: "12345678903305",
    fatherNidFull: "12345678903009",
    motherNidFull: "12345678903010",
    category: "B",
    ward: "03",
  },
  {
    code: "C0022",
    name: "মাহফুজা খানম",
    nidLast4: "3306",
    nidFull: "12345678903306",
    fatherNidFull: "12345678903011",
    motherNidFull: "12345678903012",
    category: "C",
    ward: "03",
  },
  {
    code: "C0023",
    name: "বেলাল হোসেন",
    nidLast4: "3307",
    nidFull: "12345678903307",
    fatherNidFull: "12345678903013",
    motherNidFull: "12345678903014",
    category: "A",
    ward: "03",
    status: "Inactive",
  },
  {
    code: "C0024",
    name: "রুকাইয়া সুলতানা",
    nidLast4: "3308",
    nidFull: "12345678903308",
    fatherNidFull: "12345678903015",
    motherNidFull: "12345678903016",
    category: "B",
    ward: "03",
  },
];

const LOCATION_DHAKA = {
  division: "Dhaka",
  district: "Dhaka",
  upazila: "Savar",
  unionName: "Tetuljhora",
};

const LOCATION_KHULNA = {
  division: "Khulna",
  district: "Khulna",
  upazila: "Khalishpur",
  unionName: "Khalishpur Union",
};

// kg allocation per category
const ALLOC = { A: 5, B: 4, C: 3 };

(async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "";
    if (!mongoUri.includes("localhost") && !mongoUri.includes("127.0.0.1")) {
      const readline = require("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      await new Promise((resolve) => {
        rl.question(
          `⚠️  WARNING: You are seeding a REMOTE database.\nURI: ${mongoUri.slice(0, 30)}...\nAll data will be DELETED. Type "yes" to continue: `,
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

    await connectDB();
    console.log("➡️  Seed শুরু...");

    // ── wipe existing data ──────────────────────────────────
    await Promise.all([
      DistributionRecord.deleteMany({}),
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
    ]);

    // ── Users ───────────────────────────────────────────────
    const [adminPass, distPass, fieldPass] = await Promise.all([
      bcrypt.hash("admin123", 10),
      bcrypt.hash("dist123", 10),
      bcrypt.hash("field123", 10),
    ]);

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

    const distributorUser = await User.create({
      userType: "Distributor",
      name: "ডিস্ট্রিবিউটর সাভার",
      phone: "01800000000",
      email: "distributor.dhaka.ward01@amar-ration.local",
      passwordHash: distPass,
      status: "Active",
      tokenVersion: 0,
      mustChangePassword: false,
      wardNo: "01",
      officeAddress: "তেঁতুলঝোড়া বাজার, সাভার",
      ...LOCATION_DHAKA,
      ward: "01",
      authorityStatus: "Active",
      authorityFrom: new Date("2025-01-01T00:00:00.000Z"),
      authorityTo: new Date("2027-12-31T23:59:59.000Z"),
    });

    const distributorKhulnaUser = await User.create({
      userType: "Distributor",
      name: "ডিস্ট্রিবিউটর খুলনা-ওয়ার্ড০২",
      phone: "01800000002",
      email: "distributor.khulna.ward02@amar-ration.local",
      passwordHash: distPass,
      status: "Active",
      tokenVersion: 0,
      mustChangePassword: false,
      wardNo: "02",
      officeAddress: "খালিশপুর বাজার, খুলনা",
      ...LOCATION_KHULNA,
      ward: "02",
      authorityStatus: "Active",
      authorityFrom: new Date("2025-01-01T00:00:00.000Z"),
      authorityTo: new Date("2027-12-31T23:59:59.000Z"),
    });

    await User.create({
      userType: "FieldUser",
      name: "ফিল্ড অপারেটর-১",
      phone: "01900000000",
      email: "field@amar-ration.local",
      passwordHash: fieldPass,
      status: "Active",
      tokenVersion: 0,
      mustChangePassword: false,
      wardNo: "01",
      ...LOCATION_DHAKA,
      ward: "01",
      authorityStatus: "Active",
      authorityFrom: new Date("2025-01-01T00:00:00.000Z"),
    });

    await User.create({
      userType: "FieldUser",
      name: "ফিল্ড অপারেটর-খুলনা",
      phone: "01900000002",
      email: "field.khulna.ward02@amar-ration.local",
      passwordHash: fieldPass,
      status: "Active",
      tokenVersion: 0,
      mustChangePassword: false,
      wardNo: "02",
      ...LOCATION_KHULNA,
      ward: "02",
      authorityStatus: "Active",
      authorityFrom: new Date("2025-01-01T00:00:00.000Z"),
    });

    const distributor = await Distributor.create({
      userId: distributorUser._id,
      ...LOCATION_DHAKA,
      wardNo: "01",
      ward: "01",
      authorityStatus: "Active",
      authorityFrom: new Date("2025-01-01T00:00:00.000Z"),
      authorityTo: new Date("2027-12-31T23:59:59.000Z"),
    });

    const distributorKhulna = await Distributor.create({
      userId: distributorKhulnaUser._id,
      ...LOCATION_KHULNA,
      wardNo: "02",
      ward: "02",
      authorityStatus: "Active",
      authorityFrom: new Date("2025-01-01T00:00:00.000Z"),
      authorityTo: new Date("2027-12-31T23:59:59.000Z"),
    });

    // ── Date helpers ────────────────────────────────────────
    const now = new Date();
    const h = (hrs) => new Date(now.getTime() - hrs * 3600000);
    const today = dateKey(now);
    const yday = dateKey(h(24));
    const day2 = dateKey(h(48));

    // ── Distribution Sessions ────────────────────────────────
    const [
      sesToday,
      sesYday,
      sesDay2,
      sesTodayKhulna,
      sesYdayKhulna,
      sesDay2Khulna,
    ] = await DistributionSession.create([
      {
        distributorId: distributor._id,
        dateKey: today,
        status: "Open",
        openedAt: h(6),
      },
      {
        distributorId: distributor._id,
        dateKey: yday,
        status: "Closed",
        openedAt: h(30),
        closedAt: h(24),
      },
      {
        distributorId: distributor._id,
        dateKey: day2,
        status: "Closed",
        openedAt: h(54),
        closedAt: h(48),
      },
      {
        distributorId: distributorKhulna._id,
        dateKey: today,
        status: "Open",
        openedAt: h(6),
      },
      {
        distributorId: distributorKhulna._id,
        dateKey: yday,
        status: "Closed",
        openedAt: h(30),
        closedAt: h(24),
      },
      {
        distributorId: distributorKhulna._id,
        dateKey: day2,
        status: "Closed",
        openedAt: h(54),
        closedAt: h(48),
      },
    ]);

    // ── Consumers, Families, QR, OMS ────────────────────────
    const consumers = [];
    for (let i = 0; i < CONSUMER_SEED.length; i++) {
      const row = CONSUMER_SEED[i];
      const qrToken = mkToken(row.code);
      const wardNo = normalizeWardNo(row.ward);
      const isKhulnaWard = wardNo === "02";
      const rowLocation = isKhulnaWard ? LOCATION_KHULNA : LOCATION_DHAKA;

      const family = await Family.create({
        familyKey: sha256(`FAMILY-${row.code}`),
        fatherNidLast4: String(2000 + i),
        motherNidLast4: String(5000 + i),
        flaggedDuplicate: i === 7 || i === 15, // C0008, C0016 flagged
      });

      const consumer = await Consumer.create({
        consumerCode: row.code,
        qrToken,
        name: row.name,
        nidLast4: row.nidLast4,
        nidFull: `1990${row.nidLast4}${String(1000 + i).padStart(4, "0")}`,
        fatherNidFull: `1960${String(2000 + i).padStart(4, "0")}${row.nidLast4}`,
        motherNidFull: `1970${String(5000 + i).padStart(4, "0")}${row.nidLast4}`,
        status: row.status || "Active",
        category: row.category,
        familyId: family._id,
        createdByDistributor: isKhulnaWard
          ? distributorKhulna._id
          : distributor._id,
        division: normalizeDivision(rowLocation.division),
        district: rowLocation.district,
        upazila: rowLocation.upazila,
        unionName: rowLocation.unionName,
        ward: normalizeWardNo(wardNo),
        blacklistStatus: "None",
      });

      const qr = await QRCode.create({
        payload: qrToken,
        payloadHash: sha256(qrToken),
        validFrom: now,
        validTo: new Date(now.getTime() + 30 * 86400000),
        status: consumer.status === "Active" ? "Valid" : "Revoked",
      });

      await OMSCard.create({
        consumerId: consumer._id,
        cardStatus: consumer.status === "Active" ? "Active" : "Inactive",
        qrCodeId: qr._id,
      });

      consumers.push(consumer);
    }

    // ── Tokens ──────────────────────────────────────────────
    // Today: C0001-C0006 get tokens (C0001,C0002,C0009 Used; C0003 Issued; C0004 Cancelled)
    const mkTkn = (code, c, dist, ses, status, ago, usedAgo) =>
      Token.create({
        tokenCode: code,
        consumerId: c._id,
        distributorId: dist._id,
        sessionId: ses._id,
        rationQtyKg: ALLOC[c.category],
        status,
        issuedAt: h(ago),
        ...(usedAgo !== undefined ? { usedAt: h(usedAgo) } : {}),
      });

    const [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12] =
      await Promise.all([
        // Today's session
        mkTkn(
          "TKN-2026-0001",
          consumers[0],
          distributor,
          sesToday,
          "Used",
          5,
          3,
        ), // C0001 Used
        mkTkn(
          "TKN-2026-0002",
          consumers[1],
          distributor,
          sesToday,
          "Used",
          5,
          3.5,
        ), // C0002 Used (mismatch)
        mkTkn(
          "TKN-2026-0003",
          consumers[8],
          distributorKhulna,
          sesTodayKhulna,
          "Used",
          4.5,
          3,
        ), // C0009 Used
        mkTkn(
          "TKN-2026-0004",
          consumers[2],
          distributor,
          sesToday,
          "Issued",
          1,
        ), // C0003 Pending
        mkTkn(
          "TKN-2026-0005",
          consumers[3],
          distributor,
          sesToday,
          "Cancelled",
          6,
        ), // C0004 Cancelled
        mkTkn(
          "TKN-2026-0006",
          consumers[9],
          distributorKhulna,
          sesTodayKhulna,
          "Issued",
          2,
        ), // C0010 Pending

        // Yesterday's session
        mkTkn(
          "TKN-2026-0007",
          consumers[4],
          distributor,
          sesYday,
          "Used",
          28,
          27,
        ), // C0005
        mkTkn(
          "TKN-2026-0008",
          consumers[10],
          distributorKhulna,
          sesYdayKhulna,
          "Used",
          27,
          26,
        ), // C0011
        mkTkn(
          "TKN-2026-0009",
          consumers[16],
          distributor,
          sesYday,
          "Used",
          26,
          25,
        ), // C0017
        mkTkn(
          "TKN-2026-0010",
          consumers[11],
          distributorKhulna,
          sesYdayKhulna,
          "Cancelled",
          29,
        ), // C0012 Cancelled

        // Day-2 session
        mkTkn(
          "TKN-2026-0011",
          consumers[12],
          distributorKhulna,
          sesDay2Khulna,
          "Used",
          52,
          51,
        ), // C0013
        mkTkn(
          "TKN-2026-0012",
          consumers[17],
          distributor,
          sesDay2,
          "Used",
          50,
          49,
        ), // C0018
      ]);

    // ── Distribution Records ─────────────────────────────────
    await DistributionRecord.insertMany([
      // Today
      {
        tokenId: t1._id,
        expectedKg: ALLOC["A"],
        actualKg: 5.0,
        mismatch: false,
        createdAt: h(3),
      },
      {
        tokenId: t2._id,
        expectedKg: ALLOC["A"],
        actualKg: 4.7,
        mismatch: true,
        createdAt: h(3.5),
      },
      {
        tokenId: t3._id,
        expectedKg: ALLOC["A"],
        actualKg: 5.0,
        mismatch: false,
        createdAt: h(3),
      },
      // Yesterday
      {
        tokenId: t7._id,
        expectedKg: ALLOC["C"],
        actualKg: 3.0,
        mismatch: false,
        createdAt: h(27),
      },
      {
        tokenId: t8._id,
        expectedKg: ALLOC["C"],
        actualKg: 2.8,
        mismatch: true,
        createdAt: h(26),
      },
      {
        tokenId: t9._id,
        expectedKg: ALLOC["A"],
        actualKg: 5.0,
        mismatch: false,
        createdAt: h(25),
      },
      // Day-2
      {
        tokenId: t11._id,
        expectedKg: ALLOC["B"],
        actualKg: 4.0,
        mismatch: false,
        createdAt: h(51),
      },
      {
        tokenId: t12._id,
        expectedKg: ALLOC["B"],
        actualKg: 3.9,
        mismatch: true,
        createdAt: h(49),
      },
    ]);

    // ── Stock Ledger ─────────────────────────────────────────
    await StockLedger.insertMany([
      // Today
      {
        distributorId: distributor._id,
        dateKey: today,
        type: "IN",
        item: "Rice",
        qtyKg: 300,
        ref: "BATCH-2026-T01",
      },
      {
        distributorId: distributor._id,
        dateKey: today,
        type: "OUT",
        item: "Rice",
        qtyKg: 5.0,
        ref: "TKN-2026-0001",
      },
      {
        distributorId: distributor._id,
        dateKey: today,
        type: "OUT",
        item: "Rice",
        qtyKg: 4.7,
        ref: "TKN-2026-0002",
      },
      {
        distributorId: distributorKhulna._id,
        dateKey: today,
        type: "IN",
        item: "Rice",
        qtyKg: 300,
        ref: "BATCH-2026-T01-KHU",
      },
      {
        distributorId: distributorKhulna._id,
        dateKey: today,
        type: "OUT",
        item: "Rice",
        qtyKg: 5.0,
        ref: "TKN-2026-0003",
      },
      // Yesterday
      {
        distributorId: distributor._id,
        dateKey: yday,
        type: "IN",
        item: "Rice",
        qtyKg: 300,
        ref: "BATCH-2026-T02",
      },
      {
        distributorId: distributor._id,
        dateKey: yday,
        type: "OUT",
        item: "Rice",
        qtyKg: 3.0,
        ref: "TKN-2026-0007",
      },
      {
        distributorId: distributorKhulna._id,
        dateKey: yday,
        type: "IN",
        item: "Rice",
        qtyKg: 300,
        ref: "BATCH-2026-T02-KHU",
      },
      {
        distributorId: distributorKhulna._id,
        dateKey: yday,
        type: "OUT",
        item: "Rice",
        qtyKg: 2.8,
        ref: "TKN-2026-0008",
      },
      {
        distributorId: distributor._id,
        dateKey: yday,
        type: "OUT",
        item: "Rice",
        qtyKg: 5.0,
        ref: "TKN-2026-0009",
      },
      // Day-2
      {
        distributorId: distributorKhulna._id,
        dateKey: day2,
        type: "IN",
        item: "Rice",
        qtyKg: 300,
        ref: "BATCH-2026-T03-KHU",
      },
      {
        distributorId: distributorKhulna._id,
        dateKey: day2,
        type: "OUT",
        item: "Rice",
        qtyKg: 4.0,
        ref: "TKN-2026-0011",
      },
      {
        distributorId: distributor._id,
        dateKey: day2,
        type: "IN",
        item: "Rice",
        qtyKg: 300,
        ref: "BATCH-2026-T03",
      },
      {
        distributorId: distributor._id,
        dateKey: day2,
        type: "OUT",
        item: "Rice",
        qtyKg: 3.9,
        ref: "TKN-2026-0012",
      },
    ]);

    // ── Blacklist Entries ────────────────────────────────────
    const blTemp = await BlacklistEntry.create({
      distributorId: distributor._id,
      createdByUserId: distributorUser._id,
      targetType: "Consumer",
      targetRefId: String(consumers[6]._id), // C0007
      blockType: "Temporary",
      reason: "৩ বার টানা ওজন মিসম্যাচ - স্বয়ংক্রিয় ব্লক",
      active: true,
      expiresAt: new Date(now.getTime() + 7 * 86400000),
    });
    await Consumer.findByIdAndUpdate(consumers[6]._id, {
      blacklistStatus: "Temp",
    });

    await BlacklistEntry.create({
      distributorId: distributor._id,
      createdByUserId: admin._id,
      targetType: "Consumer",
      targetRefId: String(consumers[5]._id), // C0006 (Inactive)
      blockType: "Permanent",
      reason: "ভুয়া জাতীয় পরিচয়পত্র তথ্য - এডমিন কর্তৃক ব্লক",
      active: false,
    });

    // ── Offline Queue ────────────────────────────────────────
    await OfflineQueue.insertMany([
      {
        distributorId: distributor._id,
        payload: { action: "SCAN", consumerCode: consumers[22].consumerCode },
        status: "Pending",
      },
      {
        distributorId: distributor._id,
        payload: { action: "SCAN", consumerCode: consumers[20].consumerCode },
        status: "Pending",
      },
      {
        distributorId: distributor._id,
        payload: { action: "COMPLETE", tokenCode: "TKN-2026-0007" },
        status: "Synced",
      },
    ]);

    // ── System Settings ──────────────────────────────────────
    const globalSettingsKey = "distributor:global:settings";
    await SystemSetting.insertMany([
      { key: "weightThresholdKg", value: { maxDiff: 0.05 } },
      { key: "qrCycleDays", value: { days: 30 } },
      { key: "tokenLimitPerDay", value: { limit: 1 } },
      { key: "system:maintenanceMode", value: { enabled: false } },
      {
        key: globalSettingsKey,
        value: {
          policy: { authorityMonths: 12, adminApprovalRequired: true },
          distribution: {
            weightThresholdKg: 1,
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

    // ── Audit Logs ───────────────────────────────────────────
    await AuditLog.insertMany([
      {
        actorUserId: distributorUser._id,
        actorType: "Distributor",
        action: "TOKEN_ISSUED",
        entityType: "Token",
        entityId: String(t1._id),
        severity: "Info",
        meta: { token: "TKN-2026-0001", consumer: "C0001" },
      },
      {
        actorUserId: distributorUser._id,
        actorType: "Distributor",
        action: "WEIGHT_MISMATCH",
        entityType: "Token",
        entityId: String(t2._id),
        severity: "Critical",
        meta: { token: "TKN-2026-0002", expected: 5, actual: 4.7 },
      },
      {
        actorUserId: distributorUser._id,
        actorType: "Distributor",
        action: "TOKEN_ISSUED",
        entityType: "Token",
        entityId: String(t3._id),
        severity: "Info",
        meta: { token: "TKN-2026-0003", consumer: "C0009" },
      },
      {
        actorUserId: distributorUser._id,
        actorType: "Distributor",
        action: "TOKEN_CANCELLED",
        entityType: "Token",
        entityId: String(t5._id),
        severity: "Warning",
        meta: { token: "TKN-2026-0005", consumer: "C0004" },
      },
      {
        actorUserId: distributorUser._id,
        actorType: "Distributor",
        action: "BLACKLIST_CREATED",
        entityType: "BlacklistEntry",
        entityId: String(blTemp._id),
        severity: "Warning",
        meta: { targetType: "Consumer", consumer: "C0007" },
      },
      {
        actorUserId: distributorUser._id,
        actorType: "Distributor",
        action: "WEIGHT_MISMATCH",
        entityType: "Token",
        entityId: String(t8._id),
        severity: "Critical",
        meta: { token: "TKN-2026-0008", expected: 3, actual: 2.8 },
      },
      {
        actorUserId: distributorUser._id,
        actorType: "Distributor",
        action: "DISTRIBUTION_SUCCESS",
        entityType: "Token",
        entityId: String(t9._id),
        severity: "Info",
        meta: { token: "TKN-2026-0009", consumer: "C0017" },
      },
      {
        actorUserId: distributorUser._id,
        actorType: "Distributor",
        action: "WEIGHT_MISMATCH",
        entityType: "Token",
        entityId: String(t12._id),
        severity: "Critical",
        meta: { token: "TKN-2026-0012", expected: 4, actual: 3.9 },
      },
      {
        actorUserId: admin._id,
        actorType: "Central Admin",
        action: "BLACKLIST_CREATED",
        entityType: "BlacklistEntry",
        entityId: String(consumers[5]._id),
        severity: "Warning",
        meta: {
          targetType: "Consumer",
          consumer: "C0006",
          reason: "ভুয়া NID",
        },
      },
    ]);

    // ── Summary ──────────────────────────────────────────────
    console.log("✅ Seed সম্পন্ন");
    console.log("─────────────────────────────────────────");
    console.log(
      "Admin login       : admin@amar-ration.local or 01700000000 / admin123",
    );
    console.log(
      "Distributor login : distributor.dhaka.ward01@amar-ration.local or 01800000000 / dist123",
    );
    console.log(
      "Khulna dist login : distributor.khulna.ward02@amar-ration.local or 01800000002 / dist123",
    );
    console.log(
      "Field login       : field@amar-ration.local or 01900000000 / field123",
    );
    console.log("─────────────────────────────────────────");
    console.log(`Consumers seeded  : ${CONSUMER_SEED.length} (3 wards)`);
    console.log(`Tokens seeded     : 12 across 3 sessions`);
    console.log(`Records seeded    : 8 (3 mismatches)`);
    console.log(`Stock ledger      : ${14} entries`);
    console.log(`Audit logs        : 9 entries`);
    console.log("Sample QR token   :", consumers[0].qrToken);
    console.log(
      "Collections seeded: users, distributors, consumers, qrcodes, omscards, sessions, tokens, records, stock, monitoring, reports, settings",
    );
    process.exit(0);
  } catch (e) {
    console.error("❌ Seed error:", e);
    process.exit(1);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
