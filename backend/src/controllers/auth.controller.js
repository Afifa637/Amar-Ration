const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { writeAudit } = require("../services/audit.service");

function signAccessToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "2h",
  });
}

function mapActorType(userType) {
  if (userType === "Admin") return "Central Admin";
  if (userType === "Distributor" || userType === "FieldUser")
    return "Distributor";
  return "System";
}

async function login(req, res) {
  const { identifier, password, userType, phone, email } = req.body;
  const loginId = identifier || phone || email;

  if (!loginId || !password) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const query = {
    $or: [{ phone: loginId }, { email: loginId }],
  };

  if (userType) {
    query.userType = userType;
  }

  const user = await User.findOne(query).lean();
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  if (user.status !== "Active") {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  await User.updateOne(
    { _id: user._id },
    { $set: { lastLoginAt: new Date() } },
  );

  await writeAudit({
    actorUserId: user._id,
    actorType: mapActorType(user.userType),
    action: "LOGIN",
    severity: "Info",
  });

  return res.json({
    success: true,
    data: {
      token: signAccessToken(String(user._id)),
      user: {
        _id: String(user._id),
        name: user.name,
        email: user.email,
        phone: user.phone,
        userType: user.userType,
        wardNo: user.wardNo,
        officeAddress: user.officeAddress,
      },
    },
  });
}

async function me(req, res) {
  try {
    const user = await User.findById(req.user.userId)
      .select(
        "_id name email phone userType wardNo officeAddress division district upazila unionName ward",
      )
      .lean();

    if (!user) return res.status(401).json({ message: "Unauthorized" });

    return res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = { login, me };
