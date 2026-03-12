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
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const SystemSetting = require('../models/SystemSetting');

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI;
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await SystemSetting.deleteMany({});
    console.log('✅ Existing data cleared\n');

    // Hash password for all users
    const defaultPassword = 'Admin@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Preset admin credentials
    const adminPassword = 'adminadmin';
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);

    // Create Admin User
    console.log('👤 Creating Admin user...');
    const admin = await User.create({
      userType: 'Admin',
      name: 'System Administrator',
      email: 'admin_amarration@gmail.com',
      phone: '01711000000',
      passwordHash: hashedAdminPassword,
      status: 'Active',
      division: 'Dhaka',
      district: 'Dhaka',
      upazila: 'Dhaka Sadar',
    });
    console.log('✅ Admin created:', admin.email);

    // Create Distributor Users
    console.log('\n🏪 Creating Distributor users...');
    const distributors = await User.insertMany([
      {
        userType: 'Distributor',
        name: 'Kamal Hossain',
        email: 'kamal@distributor.com',
        phone: '01711111111',
        passwordHash: hashedPassword,
        status: 'Active',
        wardNo: '1',
        officeAddress: 'Shop No. 5, Main Road, Mirpur-1',
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Mirpur',
        unionName: 'Mirpur',
        ward: '1',
        authorityStatus: 'Active',
        authorityFrom: new Date('2024-01-01'),
        authorityTo: new Date('2026-12-31'),
      },
      {
        userType: 'Distributor',
        name: 'Rashida Begum',
        email: 'rashida@distributor.com',
        phone: '01722222222',
        passwordHash: hashedPassword,
        status: 'Active',
        wardNo: '2',
        officeAddress: 'House No. 12, Block-C, Uttara',
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Uttara',
        unionName: 'Uttara',
        ward: '2',
        authorityStatus: 'Active',
        authorityFrom: new Date('2024-01-01'),
        authorityTo: new Date('2026-12-31'),
      }
    ]);
    console.log(`✅ Created ${distributors.length} distributors`);

    // Create Field Users
    console.log('\n👷 Creating Field users...');
    const fieldUsers = await User.insertMany([
      {
        userType: 'FieldUser',
        name: 'Rahim Ahmed',
        email: 'rahim@field.com',
        phone: '01733333333',
        passwordHash: hashedPassword,
        status: 'Active',
        wardNo: '1',
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Mirpur',
        unionName: 'Mirpur',
        ward: '1',
        authorityStatus: 'Active',
        authorityFrom: new Date('2024-01-01'),
        authorityTo: new Date('2026-12-31'),
      }
    ]);
    console.log(`✅ Created ${fieldUsers.length} field users`);

    // Create Consumer Users
    console.log('\n🏠 Creating Consumer users...');
    const consumers = await User.insertMany([
      {
        userType: 'Consumer',
        name: 'Fatema Khatun',
        email: 'fatema@consumer.com',
        phone: '01744444444',
        passwordHash: hashedPassword,
        status: 'Active',
        consumerCode: 'CONS001',
        nidLast4: '1234',
        category: 'A',
        qrToken: 'QR-CONS-001-' + Date.now(),
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Mirpur',
        ward: '1',
      },
      {
        userType: 'Consumer',
        name: 'Abdul Hamid',
        email: 'hamid@consumer.com',
        phone: '01755555555',
        passwordHash: hashedPassword,
        status: 'Active',
        consumerCode: 'CONS002',
        nidLast4: '5678',
        category: 'B',
        qrToken: 'QR-CONS-002-' + Date.now(),
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Mirpur',
        ward: '1',
      },
      {
        userType: 'Consumer',
        name: 'Amina Begum',
        email: 'amina@consumer.com',
        phone: '01766666666',
        passwordHash: hashedPassword,
        status: 'Active',
        consumerCode: 'CONS003',
        nidLast4: '9012',
        category: 'C',
        qrToken: 'QR-CONS-003-' + Date.now(),
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Uttara',
        ward: '2',
      }
    ]);
    console.log(`✅ Created ${consumers.length} consumers`);

    // Create System Settings
    console.log('\n⚙️  Creating system settings...');
    const settings = await SystemSetting.insertMany([
      {
        key: 'pricing',
        value: {
          rice: 30,
          wheat: 25,
          oil: 120,
          sugar: 60
        }
      },
      {
        key: 'distribution_hours',
        value: {
          start: '09:00',
          end: '17:00',
          timezone: 'Asia/Dhaka'
        }
      },
      {
        key: 'monthly_quotas',
        value: {
          categoryA: { rice: 15, wheat: 10 },
          categoryB: { rice: 10, wheat: 5 },
          categoryC: { rice: 5, wheat: 3 }
        }
      }
    ]);
    console.log(`✅ Created ${settings.length} system settings`);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n📋 Created Users:');
    console.log(`   • 1 Admin`);
    console.log(`   • ${distributors.length} Distributors`);
    console.log(`   • ${fieldUsers.length} Field Users`);
    console.log(`   • ${consumers.length} Consumers`);
    console.log(`   • Total: ${1 + distributors.length + fieldUsers.length + consumers.length} users`);
    
    console.log('\n🔐 Default Login Credentials:');
    console.log(`   Password for all users: ${defaultPassword}`);
    console.log('\n   Admin Account:');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Password: ${defaultPassword}`);
    
    console.log('\n   Distributor Accounts:');
    distributors.forEach(d => {
      console.log(`   Email: ${d.email} | Password: ${defaultPassword}`);
    });

    console.log('\n⚠️  IMPORTANT: Change these default passwords in production!');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error seeding database:');
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  }
}

// Run the seed function
seedDatabase();
