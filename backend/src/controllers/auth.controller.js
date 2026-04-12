const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const Distributor = require("../models/Distributor");
const { writeAudit } = require("../services/audit.service");
const { notifyAdmins } = require("../services/notification.service");
const {
  sendDistributorPasswordChangeAlertEmail,
} = require("../services/email.service");
const { normalizeDivision } = require("../utils/division.utils");
const { normalizeWardNo } = require("../utils/ward.utils");

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Generate JWT Token
const generateToken = (userId, userType, tokenVersion) => {
  const jti = crypto.randomBytes(16).toString("hex");
  return jwt.sign(
    { userId, userType, tokenVersion, jti },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "2h",
    },
  );
};

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

// @route   POST /api/auth/signup
// @desc    Register new user (Admin, Distributor, FieldUser, or Consumer)
// @access  Public
exports.signup = async (req, res) => {
  try {
    const { userType, name, email, phone, password, ...additionalFields } =
      req.body;

    console.log('🔍 Signup attempt:', { userType, name, email, phone });

    // Normalize email and phone
    const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
    const normalizedPhone = phone ? String(phone).trim() : null;

    console.log('🔍 Normalized:', { normalizedEmail, normalizedPhone });

    // Validation
    if (!userType || !name || !password) {
      return res.status(400).json({
        success: false,
        message: "UserType, name, and password are required",
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

    if (userType === "Distributor" || userType === "FieldUser") {
      return res.status(403).json({
        success: false,
        message:
          "Distributor/FieldUser self-signup is disabled. Use admin-assigned email and password.",
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
      const lastConsumer = await User.findOne({ userType: "Consumer" })
        .sort({ createdAt: -1 })
        .select("consumerCode");

      if (lastConsumer && lastConsumer.consumerCode) {
        const lastNumber = parseInt(lastConsumer.consumerCode.substring(1));
        consumerCode = `C${String(lastNumber + 1).padStart(4, "0")}`;
      } else {
        consumerCode = "C0001";
      }

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

    console.log('✅ User saved successfully:', { 
      id: user._id, 
      userType, 
      name, 
      email: normalizedEmail, 
      phone: normalizedPhone,
      authorityStatus: user.authorityStatus || user.status
    });

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
    const { identifier, password, userType } = req.body; // identifier can be email, phone, or consumerCode
    const normalizedIdentifier = String(identifier || "").trim();

    console.log('🔍 Login attempt:', { identifier, userType });

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

    console.log('🔍 Normalized:', { normalizedIdentifier, isPhone, normalizedEmail, normalizedPhone });

    // Find user by email, phone, or consumerCode
    const safeIdentifier = escapeRegex(normalizedIdentifier);
    const user = await User.findOne({
      $or: [
        { email: { $regex: `^${safeIdentifier}$`, $options: "i" } },
        { phone: normalizedIdentifier },
        { consumerCode: normalizedIdentifier },
      ],
    });

    console.log('🔍 User found:', user ? { id: user._id, email: user.email, phone: user.phone, userType: user.userType } : 'No user found');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Verify the user is logging in through the correct portal
    if (userType && user.userType !== userType) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if user is active
    if (user.status !== "Active") {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.status}. Please contact administrator.`,
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
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

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: userResponse,
        token,
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
