const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const speakeasy = require("speakeasy");
const User = require("../models/User");
const Distributor = require("../models/Distributor");
const RefreshToken = require("../models/RefreshToken");
const { writeAudit } = require("../services/audit.service");
const { notifyAdmins, notifyUser } = require("../services/notification.service");
const {
  sendDistributorPasswordChangeAlertEmail,
} = require("../services/email.service");
const { nextConsumerCode } = require("../services/consumer-code.service");
const { normalizeDivision } = require("../utils/division.utils");
const { normalizeWardNo } = require("../utils/ward.utils");
const { escapeRegex } = require("../utils/regex.utils");

const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const TWO_FA_SECRET_PREFIX = "2fa:v1:";
const REFRESH_COOKIE_NAME = "refreshToken";

function readCookie(req, cookieName) {
  const raw = String(req?.headers?.cookie || "");
  if (!raw) return "";
  const parts = raw.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.split("=");
    if (String(k || "").trim() !== cookieName) continue;
    return decodeURIComponent(rest.join("=") || "");
  }
  return "";
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 86400000,
    path: "/api/auth",
  };
}

function getTwoFAKey() {
  const raw =
    process.env.TWO_FA_SECRET_KEY ||
    process.env.NID_ENCRYPTION_KEY ||
    process.env.JWT_SECRET;
  if (!raw) {
    throw new Error("TWO_FA_SECRET_KEY or JWT_SECRET is required");
  }
  return crypto.createHash("sha256").update(String(raw)).digest();
}

function encryptTwoFASecret(value) {
  const plain = String(value || "").trim();
  if (!plain) return "";
  if (plain.startsWith(TWO_FA_SECRET_PREFIX)) return plain;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getTwoFAKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${TWO_FA_SECRET_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptTwoFASecret(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!raw.startsWith(TWO_FA_SECRET_PREFIX)) return raw;

  try {
    const encoded = raw.slice(TWO_FA_SECRET_PREFIX.length);
    const [ivB64, tagB64, cipherB64] = encoded.split(":");
    if (!ivB64 || !tagB64 || !cipherB64) return "";

    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const ciphertext = Buffer.from(cipherB64, "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", getTwoFAKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}

// Generate JWT Token
const generateToken = (userId, userType, tokenVersion) => {
  const jti = crypto.randomBytes(16).toString("hex");
  return jwt.sign(
    { userId, userType, tokenVersion, jti },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    },
  );
};

async function generateRefreshToken(userId, tokenVersion, userAgent) {
  const raw = crypto.randomBytes(48).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 86400000);

  await RefreshToken.create({
    userId,
    token: hash,
    tokenVersion,
    userAgent: userAgent || "",
    expiresAt,
  });

  return raw;
}

async function revokeAllRefreshTokensForUser(userId) {
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

// Generate unique QR token for consumer
const generateQRToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

function renderAckHtml(title, message, tone = "#065f46") {
  return `
    <html>
      <head><meta charset="utf-8" /><title>${title}</title></head>
      <body style="font-family: Arial, Helvetica, sans-serif; background:#f8fafc; padding:24px;">
        <div style="max-width:680px; margin:0 auto; background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:20px;">
          <h2 style="margin-top:0; color:${tone};">${title}</h2>
          <p style="font-size:14px; color:#111827;">${message}</p>
          <p style="font-size:12px; color:#6b7280;">You can safely close this page.</p>
        </div>
      </body>
    </html>
  `;
}

function getBackendPublicBaseUrl() {
  return String(
    process.env.BACKEND_PUBLIC_URL || "http://localhost:5000",
  ).replace(/\/$/, "");
}

function makePasswordChangeAckToken({ user, changedByUserId, changedByType }) {
  const changedAt = user?.passwordChangedAt
    ? new Date(user.passwordChangedAt).getTime()
    : Date.now();

  return jwt.sign(
    {
      purpose: "PASSWORD_CHANGE_ACK",
      userId: String(user._id),
      changedAt,
      changedByUserId: changedByUserId ? String(changedByUserId) : null,
      changedByType: changedByType || "System",
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

function hashIdentifierForAudit(identifier) {
  const normalized = String(identifier || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "";
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

async function logFailedLoginAttempt({
  identifier,
  userId,
  reason,
  severity = "Warning",
  req,
  userType,
}) {
  try {
    const ip = String(
      req?.headers?.["x-forwarded-for"] ||
        req?.ip ||
        req?.socket?.remoteAddress ||
        "",
    )
      .split(",")[0]
      .trim();

    await writeAudit({
      actorUserId: userId || undefined,
      actorType: "System",
      action: "AUTH_LOGIN_FAILED",
      entityType: "User",
      entityId: userId ? String(userId) : null,
      severity,
      meta: {
        reason: String(reason || ""),
        identifierHash: hashIdentifierForAudit(identifier),
        attemptedPortalUserType: userType || null,
        ip,
        userAgent: String(req?.headers?.["user-agent"] || ""),
      },
    });
  } catch {
    // audit write must not block auth flow
  }
}

// @route   GET /api/auth/password-change/ack?action=yes|not-me&token=...
// @desc    Acknowledge distributor password change from email link
// @access  Public
exports.acknowledgePasswordChange = async (req, res) => {
  try {
    const action = String(req.query.action || "")
      .trim()
      .toLowerCase();
    const token = String(req.query.token || "").trim();

    if (!token || !["yes", "not-me"].includes(action)) {
      return res
        .status(400)
        .send(
          renderAckHtml(
            "Invalid request",
            "The password-change verification link is invalid.",
            "#b91c1c",
          ),
        );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res
        .status(400)
        .send(
          renderAckHtml(
            "Link expired",
            "This verification link is expired or invalid.",
            "#b91c1c",
          ),
        );
    }

    if (decoded?.purpose !== "PASSWORD_CHANGE_ACK" || !decoded?.userId) {
      return res
        .status(400)
        .send(
          renderAckHtml(
            "Invalid token",
            "Unsupported token payload.",
            "#b91c1c",
          ),
        );
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res
        .status(404)
        .send(
          renderAckHtml(
            "User not found",
            "Account no longer exists.",
            "#b91c1c",
          ),
        );
    }

    const tokenChangedAt = Number(decoded.changedAt || 0);
    const actualChangedAt = user.passwordChangedAt
      ? new Date(user.passwordChangedAt).getTime()
      : 0;

    if (!actualChangedAt || tokenChangedAt !== actualChangedAt) {
      return res
        .status(400)
        .send(
          renderAckHtml(
            "Outdated link",
            "This link is no longer valid for the latest password change event.",
            "#b91c1c",
          ),
        );
    }

    if (action === "yes") {
      await writeAudit({
        actorUserId: user._id,
        actorType: "Distributor",
        action: "PASSWORD_CHANGE_ACKNOWLEDGED",
        entityType: "User",
        entityId: String(user._id),
        severity: "Info",
        meta: {
          changedByType: decoded.changedByType || "System",
          changedByUserId: decoded.changedByUserId || null,
          acknowledgedAt: new Date(),
        },
      });

      return res
        .status(200)
        .send(
          renderAckHtml(
            "Confirmed",
            "Thanks. We recorded that this password change was done by you.",
            "#065f46",
          ),
        );
    }

    if (["Distributor", "FieldUser"].includes(user.userType)) {
      user.authorityStatus = "Suspended";
      user.status = "Suspended";
    } else {
      user.status = "Inactive";
    }
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await Distributor.findOneAndUpdate(
      { userId: user._id },
      { $set: { authorityStatus: "Suspended" } },
    );

    await writeAudit({
      actorUserId: user._id,
      actorType: "Distributor",
      action: "PASSWORD_CHANGE_REPORTED_NOT_ME",
      entityType: "User",
      entityId: String(user._id),
      severity: "Critical",
      meta: {
        loginEmail: user.email || null,
        changedByType: decoded.changedByType || "System",
        changedByUserId: decoded.changedByUserId || null,
        reportedAt: new Date(),
      },
    });

    await notifyAdmins({
      title: "🚨 Password breach report",
      message: `${user.name || "Distributor"} reported password change as NOT ME. Account auto-suspended.`,
      meta: {
        distributorUserId: String(user._id),
        email: user.email || null,
        phone: user.phone || null,
      },
    });

    return res
      .status(200)
      .send(
        renderAckHtml(
          "Account secured",
          "Your account has been suspended and admin has been notified immediately.",
          "#b91c1c",
        ),
      );
  } catch (error) {
    console.error("acknowledgePasswordChange error:", error);
    return res
      .status(500)
      .send(
        renderAckHtml("Server error", "Please contact support.", "#b91c1c"),
      );
  }
};

// @route   GET /api/auth/2fa/setup
// @desc    Generate/reuse manual TOTP secret for admin
// @access  Private (Admin)
exports.get2FAStatus = async (req, res) => {
  try {
    if (req.user.userType !== "Admin") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }

    const admin = await User.findById(req.user.userId).select(
      "twoFactorEnabled +twoFactorTempSecret +twoFactorTempSecretCreatedAt",
    );

    if (!admin) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const pendingSecret = decryptTwoFASecret(admin.twoFactorTempSecret);
    const setupPending = !admin.twoFactorEnabled && !!pendingSecret;

    return res.json({
      success: true,
      data: {
        enabled: !!admin.twoFactorEnabled,
        setupPending,
        pendingSince: admin.twoFactorTempSecretCreatedAt || null,
        secret: setupPending ? pendingSecret : null,
      },
    });
  } catch (error) {
    console.error("get2FAStatus error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.setup2FA = async (req, res) => {
  try {
    if (req.user.userType !== "Admin") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }

    const admin = await User.findById(req.user.userId).select(
      "+twoFactorSecret +twoFactorTempSecret twoFactorEnabled",
    );
    if (!admin) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (admin.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message:
          "2FA already enabled. Disable first if you need to reconfigure.",
      });
    }

    let tempSecret = decryptTwoFASecret(admin.twoFactorTempSecret);

    if (!tempSecret) {
      const generated = speakeasy.generateSecret({
        name: `AmarRation (${req.user.userId})`,
        issuer: "Smart OMS",
        length: 32,
      });
      tempSecret = generated.base32;

      await User.findByIdAndUpdate(req.user.userId, {
        $set: {
          twoFactorTempSecret: encryptTwoFASecret(tempSecret),
          twoFactorTempSecretCreatedAt: new Date(),
          twoFactorEnabled: false,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        secret: tempSecret,
        message:
          "Use manual secret in your authenticator app and verify to enable 2FA. This secret is reused and does not change unless you explicitly request a reset.",
      },
    });
  } catch (error) {
    console.error("setup2FA error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.setup2FAGetDeprecated = async (req, res) => {
  res.set("Deprecation", "true");
  res.set("Sunset", "2027-01-01");
  res.set(
    "Warning",
    '299 - "GET /api/auth/2fa/setup is deprecated. Use POST /api/auth/2fa/setup"',
  );
  return exports.setup2FA(req, res);
};

// @route   POST /api/auth/2fa/verify
// @desc    Verify TOTP and enable 2FA for admin
// @access  Private (Admin)
exports.verify2FA = async (req, res) => {
  try {
    if (req.user.userType !== "Admin") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }

    const token = String(req.body?.token || "").trim();
    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "TOTP token required" });
    }

    const user = await User.findById(req.user.userId)
      .select("+twoFactorSecret +twoFactorTempSecret")
      .lean();

    const pendingSecret = decryptTwoFASecret(user?.twoFactorTempSecret);
    const existingSecret = decryptTwoFASecret(user?.twoFactorSecret);
    const secretForVerification = pendingSecret || existingSecret;

    if (!secretForVerification) {
      return res.status(400).json({
        success: false,
        message: "2FA not set up. Call /2fa/setup first.",
      });
    }

    const verified = speakeasy.totp.verify({
      secret: secretForVerification,
      encoding: "base32",
      token,
      window: 2,
    });

    if (!verified) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid TOTP code. Try again." });
    }

    const backupCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString("hex").toUpperCase(),
    );
    const hashedCodes = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, 10)),
    );

    await User.findByIdAndUpdate(req.user.userId, {
      $set: {
        twoFactorEnabled: true,
        twoFactorSecret: encryptTwoFASecret(secretForVerification),
        twoFactorTempSecret: null,
        twoFactorTempSecretCreatedAt: null,
        twoFactorBackupCodes: hashedCodes,
      },
    });

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Central Admin",
      action: "2FA_ENABLED",
      entityType: "User",
      entityId: String(req.user.userId),
      severity: "Info",
    });

    return res.json({
      success: true,
      message: "2FA enabled successfully.",
      data: {
        backupCodes,
        warning:
          "Save these backup codes securely. They cannot be shown again.",
      },
    });
  } catch (error) {
    console.error("verify2FA error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// @route   POST /api/auth/2fa/setup/reset
// @desc    Reset pending admin 2FA setup and issue a new temp secret
// @access  Private (Admin)
exports.reset2FASetup = async (req, res) => {
  try {
    if (req.user.userType !== "Admin") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }

    const user = await User.findById(req.user.userId)
      .select("twoFactorEnabled")
      .lean();
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message:
          "2FA already enabled. Disable it first before resetting setup.",
      });
    }

    const confirmText = String(req.body?.confirmText || "").trim();
    if (confirmText !== "CHANGE_2FA_SECRET") {
      return res.status(400).json({
        success: false,
        message:
          "Secret reset is blocked. Send confirmText=CHANGE_2FA_SECRET to request a new secret.",
      });
    }

    await User.findByIdAndUpdate(req.user.userId, {
      $set: {
        twoFactorTempSecret: null,
        twoFactorTempSecretCreatedAt: null,
      },
    });

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Central Admin",
      action: "2FA_SETUP_SECRET_RESET",
      entityType: "User",
      entityId: String(req.user.userId),
      severity: "Warning",
    });

    return exports.setup2FA(req, res);
  } catch (error) {
    console.error("reset2FASetup error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// @route   POST /api/auth/2fa/disable
// @desc    Disable admin 2FA
// @access  Private (Admin)
exports.disable2FA = async (req, res) => {
  try {
    if (req.user.userType !== "Admin") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }

    const { password, totpToken } = req.body || {};
    const user = await User.findById(req.user.userId).select(
      "+twoFactorSecret +twoFactorBackupCodes",
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const passwordOk = await bcrypt.compare(
      String(password || ""),
      user.passwordHash,
    );
    if (!passwordOk) {
      return res
        .status(401)
        .json({ success: false, message: "Incorrect password" });
    }

    const disableSecret = decryptTwoFASecret(user.twoFactorSecret);

    if (user.twoFactorEnabled && disableSecret) {
      const totpOk = speakeasy.totp.verify({
        secret: disableSecret,
        encoding: "base32",
        token: String(totpToken || "").trim(),
        window: 2,
      });
      if (!totpOk) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid TOTP code" });
      }
    }

    await User.findByIdAndUpdate(req.user.userId, {
      $set: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorTempSecret: null,
        twoFactorTempSecretCreatedAt: null,
        twoFactorBackupCodes: [],
      },
    });

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Central Admin",
      action: "2FA_DISABLED",
      entityType: "User",
      entityId: String(req.user.userId),
      severity: "Warning",
    });

    return res.json({ success: true, message: "2FA disabled." });
  } catch (error) {
    console.error("disable2FA error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// @route   POST /api/auth/signup
// @desc    Register new user (Admin, Distributor, FieldUser, or Consumer)
// @access  Public
exports.signup = async (req, res) => {
  try {
    const { userType, name, email, phone, password, ...additionalFields } =
      req.body;

    // Normalize email and phone
    const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
    const normalizedPhone = phone ? String(phone).trim() : null;

    // Validation
    if (!userType || !name) {
      return res.status(400).json({
        success: false,
        message: "UserType and name are required",
      });
    }

    // Password is required for all types except FieldUser (which gets password on approval)
    if (userType !== "FieldUser" && !password) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    // Admin account is preset — cannot be created via signup
    if (["Admin"].includes(userType)) {
      return res.status(403).json({
        success: false,
        message: "Admin accounts are not created via this API.",
      });
    }

    if (!["Distributor", "FieldUser", "Consumer"].includes(userType)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid user type. Must be Distributor, FieldUser, or Consumer",
      });
    }

    // Distributor self-signup is still disabled
    if (userType === "Distributor") {
      return res.status(403).json({
        success: false,
        message:
          "Distributor self-signup is disabled. Use admin-assigned email and password.",
      });
    }

    // FieldUser signup: no password required, account stays Pending until Distributor approves
    if (userType === "FieldUser") {
      if (!normalizedEmail && !normalizedPhone) {
        return res.status(400).json({
          success: false,
          message: "Either email or phone is required",
        });
      }

      // Check if user already exists
      const existingFieldUser = await User.findOne({
        $or: [
          normalizedEmail ? { email: normalizedEmail } : null,
          normalizedPhone ? { phone: normalizedPhone } : null,
        ].filter(Boolean),
      });

      if (existingFieldUser) {
        return res.status(409).json({
          success: false,
          message: "এই ইমেইল বা ফোন নম্বরে ইতিমধ্যে একটি অ্যাকাউন্ট আছে",
        });
      }

      // Use a random placeholder password (FieldUser will get real password on approval)
      const placeholderPassword = crypto.randomBytes(32).toString("hex");
      const placeholderHash = await bcrypt.hash(placeholderPassword, 10);

      const normalizedWard = normalizeWardNo(
        additionalFields.wardNo || additionalFields.ward,
      );

      const fieldUserData = {
        userType: "FieldUser",
        name,
        email: normalizedEmail,
        phone: normalizedPhone,
        passwordHash: placeholderHash,
        status: "Inactive",
        authorityStatus: "Pending",
        wardNo: normalizedWard || additionalFields.wardNo,
        division: normalizeDivision(additionalFields.division),
        district: additionalFields.district,
        upazila: additionalFields.upazila,
        unionName: additionalFields.unionName,
        ward: normalizedWard || additionalFields.ward,
      };

      const fieldUser = await User.create(fieldUserData);

      console.log("✅ FieldUser signup (pending approval):", {
        id: fieldUser._id,
        name,
        email: normalizedEmail,
        phone: normalizedPhone,
        division: fieldUserData.division,
        wardNo: fieldUserData.wardNo,
      });

      // Notify the distributor of the same district + ward about this new application
      try {
        const matchingDistributor = await User.findOne({
          userType: "Distributor",
          status: "Active",
          authorityStatus: "Active",
          division: fieldUserData.division,
          wardNo: fieldUserData.wardNo,
          ...(fieldUserData.district ? { district: fieldUserData.district } : {}),
        }).select("_id").lean();

        if (matchingDistributor) {
          await notifyUser(matchingDistributor._id, {
            title: "নতুন ফিল্ড ডিস্ট্রিবিউটর আবেদন",
            message: `${name} আপনার ওয়ার্ডের (${fieldUserData.wardNo}) জন্য ফিল্ড ডিস্ট্রিবিউটর হিসেবে নিবন্ধনের আবেদন করেছেন। অনুমোদন বা প্রত্যাখ্যান করতে ড্যাশবোর্ড দেখুন।`,
            meta: {
              type: "FieldUserRegistration",
              fieldUserId: String(fieldUser._id),
              wardNo: fieldUserData.wardNo,
              district: fieldUserData.district,
            },
            channels: { app: true, sms: false },
          });
          console.log("🔔 Notified distributor:", String(matchingDistributor._id), "about FieldUser signup:", String(fieldUser._id));
        } else {
          console.warn("⚠️ No active distributor found for division:", fieldUserData.division, "wardNo:", fieldUserData.wardNo, "district:", fieldUserData.district);
        }
      } catch (notifyErr) {
        console.warn("⚠️ Failed to notify distributor for FieldUser signup:", notifyErr.message);
      }

      return res.status(201).json({
        success: true,
        message: "আবেদন সফলভাবে জমা হয়েছে। ডিস্ট্রিবিউটরের অনুমোদনের জন্য অপেক্ষা করুন।",
        data: {
          user: {
            _id: fieldUser._id,
            userType: fieldUser.userType,
            name: fieldUser.name,
            email: fieldUser.email,
            phone: fieldUser.phone,
            status: fieldUser.status,
            authorityStatus: fieldUser.authorityStatus,
            wardNo: fieldUser.wardNo,
            division: fieldUser.division,
            district: fieldUser.district,
            upazila: fieldUser.upazila,
            unionName: fieldUser.unionName,
            ward: fieldUser.ward,
          },
        },
      });
    }

    // Check if email or phone is provided
    if (!normalizedEmail && !normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: "Either email or phone is required",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        normalizedEmail ? { email: normalizedEmail } : null,
        normalizedPhone ? { phone: normalizedPhone } : null,
      ].filter(Boolean),
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email or phone already exists",
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate consumer code and QR token if user type is Consumer
    let consumerCode;
    let qrToken;
    if (userType === "Consumer") {
      consumerCode = await nextConsumerCode();

      // Generate unique QR token for consumer
      qrToken = generateQRToken();
    }

    // Create user object
    const userData = {
      userType,
      name,
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      status: "Active",
    };

    // Add user-type specific fields
    if (userType === "Consumer") {
      userData.consumerCode = consumerCode;
      userData.qrToken = qrToken;
      userData.nidLast4 = additionalFields.nidLast4;
      userData.category = additionalFields.category || "A";
    } else if (userType === "Distributor") {
      const normalizedWard = normalizeWardNo(
        additionalFields.wardNo || additionalFields.ward,
      );
      userData.wardNo = normalizedWard || additionalFields.wardNo;
      userData.officeAddress = additionalFields.officeAddress;
      userData.division = normalizeDivision(additionalFields.division);
      userData.district = additionalFields.district;
      userData.upazila = additionalFields.upazila;
      userData.unionName = additionalFields.unionName;
      userData.ward = normalizedWard || additionalFields.ward;
      userData.authorityStatus = "Pending";
    } else if (userType === "FieldUser") {
      const normalizedWard = normalizeWardNo(
        additionalFields.wardNo || additionalFields.ward,
      );
      userData.wardNo = normalizedWard || additionalFields.wardNo;
      userData.division = normalizeDivision(additionalFields.division);
      userData.district = additionalFields.district;
      userData.upazila = additionalFields.upazila;
      userData.unionName = additionalFields.unionName;
      userData.ward = normalizedWard || additionalFields.ward;
      userData.authorityStatus = "Pending";
    }

    // Save user to database
    const user = await User.create(userData);

    // Generate token
    const token = generateToken(
      user._id,
      user.userType,
      user.tokenVersion || 0,
    );

    // Prepare response (exclude password)
    const userResponse = {
      _id: user._id,
      userType: user.userType,
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      ...(userType === "Consumer" && {
        consumerCode: user.consumerCode,
        category: user.category,
        qrToken: user.qrToken,
      }),
      ...(userType === "Distributor" && {
        wardNo: user.wardNo,
        officeAddress: user.officeAddress,
        division: user.division,
        district: user.district,
        upazila: user.upazila,
        unionName: user.unionName,
        ward: user.ward,
      }),
      ...(userType === "FieldUser" && {
        wardNo: user.wardNo,
        division: user.division,
        district: user.district,
        upazila: user.upazila,
        unionName: user.unionName,
        ward: user.ward,
      }),
    };

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: userResponse,
        token,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      success: false,
      message: "Error registering user",
    });
  }
};

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
exports.login = async (req, res) => {
  try {
    const { identifier, password, userType, totpToken } = req.body; // identifier can be email, phone, or consumerCode
    const normalizedIdentifier = String(identifier || "").trim();

    // Validation
    if (!normalizedIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Identifier (email/phone/consumerCode) and password are required",
      });
    }

    // Normalize identifier for comparison
    const isPhone = /^01\d{9}$/.test(normalizedIdentifier);
    const normalizedEmail = isPhone ? null : normalizedIdentifier.toLowerCase();
    const normalizedPhone = isPhone ? normalizedIdentifier : null;

    // Find user by email, phone, or consumerCode
    const safeIdentifier = escapeRegex(normalizedIdentifier);
    const user = await User.findOne({
      $or: [
        { email: { $regex: `^${safeIdentifier}$`, $options: "i" } },
        { phone: normalizedIdentifier },
        { consumerCode: normalizedIdentifier },
      ],
    });

    if (!user) {
      await logFailedLoginAttempt({
        identifier: normalizedIdentifier,
        reason: "USER_NOT_FOUND",
        severity: "Warning",
        req,
        userType,
      });
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Verify the user is logging in through the correct portal
    if (userType && user.userType !== userType) {
      await logFailedLoginAttempt({
        identifier: normalizedIdentifier,
        userId: String(user._id),
        reason: "PORTAL_USER_TYPE_MISMATCH",
        severity: "Warning",
        req,
        userType,
      });
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if user is active
    if (user.status !== "Active") {
      await logFailedLoginAttempt({
        identifier: normalizedIdentifier,
        userId: String(user._id),
        reason: `ACCOUNT_${String(user.status || "UNKNOWN").toUpperCase()}`,
        severity: "Critical",
        req,
        userType,
      });
      return res.status(403).json({
        success: false,
        message: `Account is ${user.status}. Please contact administrator.`,
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      await logFailedLoginAttempt({
        identifier: normalizedIdentifier,
        userId: String(user._id),
        reason: "INVALID_PASSWORD",
        severity: "Warning",
        req,
        userType,
      });
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (user.userType === "Admin" && user.twoFactorEnabled) {
      if (!totpToken) {
        return res.status(200).json({
          success: true,
          requires2FA: true,
          tempUserId: user._id,
          message: "TOTP verification required",
        });
      }

      const user2FA = await User.findById(user._id)
        .select("+twoFactorSecret +twoFactorBackupCodes")
        .lean();

      const activeSecret = decryptTwoFASecret(user2FA?.twoFactorSecret);

      if (!activeSecret) {
        return res.status(401).json({
          success: false,
          message:
            "2FA is enabled but secret is unavailable. Contact administrator.",
        });
      }

      const totpOk = speakeasy.totp.verify({
        secret: activeSecret,
        encoding: "base32",
        token: String(totpToken).trim(),
        window: 2,
      });

      if (!totpOk) {
        let backupUsed = false;
        const backups = user2FA?.twoFactorBackupCodes || [];

        for (let i = 0; i < backups.length; i += 1) {
          const match = await bcrypt.compare(
            String(totpToken).trim(),
            backups[i],
          );
          if (match) {
            const newCodes = [...backups];
            newCodes.splice(i, 1);
            await User.findByIdAndUpdate(user._id, {
              $set: { twoFactorBackupCodes: newCodes },
            });
            backupUsed = true;
            break;
          }
        }

        if (!backupUsed) {
          await logFailedLoginAttempt({
            identifier: normalizedIdentifier,
            userId: String(user._id),
            reason: "INVALID_2FA_TOKEN",
            severity: "Critical",
            req,
            userType,
          });
          return res
            .status(401)
            .json({ success: false, message: "Invalid 2FA code" });
        }
      }
    }

    // Distributor/FieldUser must be approved by admin
    if (["Distributor", "FieldUser"].includes(user.userType)) {
      const authority = user.authorityStatus || "Pending";
      if (authority !== "Active") {
        const pendingMessage =
          authority === "Pending"
            ? "Waiting for admin approval"
            : `Account is ${authority}. Please contact administrator.`;

        return res.status(403).json({
          success: false,
          message: pendingMessage,
          code: authority === "Pending" ? "PENDING_APPROVAL" : "ACCESS_BLOCKED",
        });
      }

      // Authority expiry check for Distributor/FieldUser
      if (user.authorityTo && new Date() > new Date(user.authorityTo)) {
        // Auto-update status so admin sees it as expired
        await User.findByIdAndUpdate(user._id, {
          $set: { authorityStatus: "Pending" },
        });
        return res.status(403).json({
          success: false,
          message:
            "আপনার বিতরণ কর্তৃত্বের মেয়াদ শেষ হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।",
          code: "AUTHORITY_EXPIRED",
        });
      }
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate token
    const token = generateToken(
      user._id,
      user.userType,
      user.tokenVersion || 0,
    );
    const refreshToken = await generateRefreshToken(
      user._id,
      user.tokenVersion || 0,
      req.headers["user-agent"],
    );

    // Prepare response
    const userResponse = {
      _id: user._id,
      userType: user.userType,
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      ...(user.userType === "Consumer" && {
        consumerCode: user.consumerCode,
        category: user.category,
        qrToken: user.qrToken,
      }),
      ...(user.userType === "Distributor" && {
        wardNo: user.wardNo,
        officeAddress: user.officeAddress,
        division: user.division,
        district: user.district,
        upazila: user.upazila,
        unionName: user.unionName,
        ward: user.ward,
        authorityStatus: user.authorityStatus,
      }),
      ...(user.userType === "FieldUser" && {
        wardNo: user.wardNo,
        division: user.division,
        district: user.district,
        upazila: user.upazila,
        unionName: user.unionName,
        ward: user.ward,
        authorityStatus: user.authorityStatus,
      }),
    };

    try {
      res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
    } catch {
      // cookie set is optional compatibility path
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: userResponse,
        token,
        refreshToken,
        mustChangePassword: user.mustChangePassword || false,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Error logging in",
    });
  }
};

// @route   POST /api/auth/refresh
// @desc    Exchange refresh token for a new access token
// @access  Public
exports.refreshAccessToken = async (req, res) => {
  try {
    const rawRefreshToken =
      req.body?.refreshToken || readCookie(req, REFRESH_COOKIE_NAME);
    if (!rawRefreshToken) {
      return res
        .status(401)
        .json({ success: false, message: "Refresh token required" });
    }

    const hash = crypto
      .createHash("sha256")
      .update(String(rawRefreshToken))
      .digest("hex");

    const stored = await RefreshToken.findOne({ token: hash }).lean();
    if (
      !stored ||
      stored.revokedAt ||
      new Date(stored.expiresAt) < new Date()
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token. Please login again.",
        code: "REFRESH_TOKEN_INVALID",
      });
    }

    const user = await User.findById(stored.userId)
      .select("status authorityStatus userType tokenVersion mustChangePassword")
      .lean();

    if (!user || user.status !== "Active") {
      await RefreshToken.findByIdAndUpdate(stored._id, {
        $set: { revokedAt: new Date() },
      });
      return res
        .status(403)
        .json({ success: false, message: "Account inactive" });
    }

    if (Number(stored.tokenVersion) !== Number(user.tokenVersion || 0)) {
      await RefreshToken.findByIdAndUpdate(stored._id, {
        $set: { revokedAt: new Date() },
      });
      return res.status(401).json({
        success: false,
        message: "Session invalidated. Please login again.",
        code: "TOKEN_INVALIDATED",
      });
    }

    const token = generateToken(
      user._id,
      user.userType,
      user.tokenVersion || 0,
    );

    await RefreshToken.findByIdAndUpdate(stored._id, {
      $set: { revokedAt: new Date() },
    });
    const refreshToken = await generateRefreshToken(
      user._id,
      user.tokenVersion || 0,
      req.headers["user-agent"],
    );

    try {
      res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
    } catch {
      // cookie set is optional compatibility path
    }

    return res.json({
      success: true,
      data: {
        token,
        refreshToken,
        mustChangePassword: user.mustChangePassword || false,
      },
    });
  } catch (error) {
    console.error("refreshAccessToken error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// @route   POST /api/auth/logout
// @desc    Revoke refresh token
// @access  Private
exports.logout = async (req, res) => {
  try {
    const rawRefreshToken =
      req.body?.refreshToken || readCookie(req, REFRESH_COOKIE_NAME);
    if (rawRefreshToken) {
      const hash = crypto
        .createHash("sha256")
        .update(String(rawRefreshToken))
        .digest("hex");
      await RefreshToken.findOneAndUpdate(
        { token: hash },
        { $set: { revokedAt: new Date() } },
      );
    }

    try {
      res.clearCookie(REFRESH_COOKIE_NAME, {
        ...refreshCookieOptions(),
        maxAge: undefined,
      });
    } catch {
      // ignore cookie clear failures
    }

    return res.json({ success: true, message: "Logged out" });
  } catch (error) {
    console.error("logout error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-passwordHash");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user profile",
    });
  }
};

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordChangedAt = new Date();
    user.mustChangePassword = false;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    await revokeAllRefreshTokensForUser(user._id);

    if (["Distributor", "FieldUser"].includes(user.userType) && user.email) {
      const ackToken = makePasswordChangeAckToken({
        user,
        changedByUserId: req.user.userId,
        changedByType: "Distributor",
      });

      const publicBase = getBackendPublicBaseUrl();
      const yesUrl = `${publicBase}/api/auth/password-change/ack?action=yes&token=${encodeURIComponent(ackToken)}`;
      const notMeUrl = `${publicBase}/api/auth/password-change/ack?action=not-me&token=${encodeURIComponent(ackToken)}`;

      await sendDistributorPasswordChangeAlertEmail({
        to: user.email,
        name: user.name,
        loginEmail: user.email,
        changedBy: "Your account",
        changedAt: new Date(user.passwordChangedAt).toLocaleString("en-GB"),
        yesUrl,
        notMeUrl,
      });
    }

    const newToken = generateToken(user._id, user.userType, user.tokenVersion);

    res.status(200).json({
      success: true,
      message: "পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে",
      data: {
        token: newToken,
      },
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Error changing password",
    });
  }
};
