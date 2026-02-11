require("dotenv").config();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const mongoose = require("mongoose");
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

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

(async () => {
  await connectDB();

  console.log("➡️ Seeding...");

  // Clean core demo collections
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
    OfflineQueue.deleteMany({})
  ]);

  // settings defaults
  await SystemSetting.insertMany([
    { key: "weightThresholdKg", value: { maxDiff: 0.05 } },
    { key: "qrCycleDays", value: { days: 30 } },
    { key: "tokenLimitPerDay", value: { limit: 1 } }
  ]);

  // create admin
  const adminPass = await bcrypt.hash("admin123", 10);
  const admin = await User.create({
    userType: "Admin",
    name: "এডমিন",
    phone: "01700000000",
    passwordHash: adminPass,
    status: "Active"
  });

  // create distributor user + distributor
  const distPass = await bcrypt.hash("dist123", 10);
  const distUser = await User.create({
    userType: "Distributor",
    name: "ডিলার/ডিস্ট্রিবিউটর",
    phone: "01800000000",
    passwordHash: distPass,
    status: "Active"
  });

  const dist = await Distributor.create({
    userId: distUser._id,
    division: "ঢাকা",
    district: "ঢাকা",
    upazila: "সাভার",
    unionName: "তেঁতুলঝোড়া",
    ward: "ওয়ার্ড-০১",
    authorityStatus: "Active",
    authorityFrom: new Date(),
    authorityTo: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
  });

  // family + consumer
  const familyKey = sha256("father-1234|mother-5678");
  const fam = await Family.create({
    familyKey,
    fatherNidLast4: "1234",
    motherNidLast4: "5678",
    flaggedDuplicate: false
  });

  const consumer = await Consumer.create({
    consumerCode: "C0001",
    name: "রহিম",
    nidLast4: "9999",
    status: "Active",
    category: "A",
    familyId: fam._id,
    createdByDistributor: dist._id,
    division: "ঢাকা",
    district: "ঢাকা",
    upazila: "সাভার",
    unionName: "তেঁতুলঝোড়া",
    ward: "ওয়ার্ড-০১",
    blacklistStatus: "None"
  });

  // QR + Card
  const qrPayload = "OMS:C0001:2026";
  const payloadHash = sha256(qrPayload);

  const qr = await QRCode.create({
    payload: qrPayload,
    payloadHash,
    validFrom: new Date(),
    validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: "Valid"
  });

  await OMSCard.create({
    consumerId: consumer._id,
    cardStatus: "Active",
    qrCodeId: qr._id
  });

  console.log("✅ Seed done!");
  console.log("Admin login: 01700000000 / admin123");
  console.log("Distributor login: 01800000000 / dist123");
  console.log("Demo QR payload:", qrPayload);

  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
