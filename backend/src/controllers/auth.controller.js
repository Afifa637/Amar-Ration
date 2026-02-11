const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { writeAudit } = require("../services/audit.service");

function signAccessToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "2h"
  });
}

async function login(req, res) {
  const { phone, password } = req.body;

  const user = await User.findOne({ phone }).lean();
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

  await writeAudit({
    actorUserId: user._id,
    actorType: user.userType,
    action: "LOGIN",
    severity: "Info"
  });

  return res.json({
    accessToken: signAccessToken(String(user._id)),
    user: { id: String(user._id), name: user.name, userType: user.userType }
  });
}

module.exports = { login };
