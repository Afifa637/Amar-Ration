require("dotenv").config();
const bcrypt = require("bcryptjs");
const { connectDB } = require("../config/db");
const User = require("../models/User");

(async () => {
  await connectDB();

  const existing = await User.findOne({ userType: "Admin" });
  if (existing) {
    console.log("✅ Admin account already exists. No changes made.");
    console.log("   Email:", existing.email || existing.phone);
    process.exit(0);
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPhone = process.env.ADMIN_PHONE;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || "Central Admin";

  if (!adminPassword || String(adminPassword).length < 12) {
    console.error("❌ ADMIN_PASSWORD env var must be set and >= 12 chars");
    process.exit(1);
  }
  if (!adminEmail && !adminPhone) {
    console.error("❌ Either ADMIN_EMAIL or ADMIN_PHONE must be set");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await User.create({
    userType: "Admin",
    name: adminName,
    email: adminEmail || undefined,
    phone: adminPhone || undefined,
    passwordHash,
    status: "Active",
    tokenVersion: 0,
    mustChangePassword: false,
  });

  console.log("✅ Admin account created.");
  console.log(
    "   IMPORTANT: Remove ADMIN_PASSWORD from your .env immediately.",
  );
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
