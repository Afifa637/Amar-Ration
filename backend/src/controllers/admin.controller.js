const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Distributor = require("../models/Distributor");
const Consumer = require("../models/Consumer");
const Family = require("../models/Family");
const OMSCard = require("../models/OMSCard");
const QRCode = require("../models/QRCode");
const Token = require("../models/Token");
const DistributionRecord = require("../models/DistributionRecord");
const DistributionSession = require("../models/DistributionSession");
const StockLedger = require("../models/StockLedger");
const OfflineQueue = require("../models/OfflineQueue");
const AuditLog = require("../models/AuditLog");
const BlacklistEntry = require("../models/BlacklistEntry");
const AuditReportRequest = require("../models/AuditReportRequest");
const { decryptNid } = require("../services/nid-security.service");
const { writeAudit } = require("../services/audit.service");
const {
  sendDistributorCredentialEmail,
  sendDistributorStatusEmail,
  sendDistributorPasswordChangeAlertEmail,
} = require("../services/email.service");
const {
  notifyUser,
  notifyAdmins,
} = require("../services/notification.service");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { normalizeWardNo, isValidWardNo } = require("../utils/ward.utils");
const {
  normalizeDivision,
  isSameDivision,
} = require("../utils/division.utils");

function generateStrongPassword(length = 14) {
  const charset =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%";
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += charset[bytes[i] % charset.length];
  }
  return result;
}

function isValidEmail(value) {
  const email = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function divisionEmailSlug(input) {
  const canonical = normalizeDivision(input);
  return (
    String(canonical || "division")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "") || "division"
  );
}

async function generateDistributorLoginEmail(division, wardNo) {
  const divisionSlug = divisionEmailSlug(division);
  const wardSuffix = normalizeWardNo(wardNo).padStart(2, "0") || "00";
  const loginEmail = `distributor.${divisionSlug}.ward${wardSuffix}@amar-ration.local`;

  const exists = await User.exists({
    email: { $regex: `^${loginEmail}$`, $options: "i" },
  });

  if (exists) {
    throw new Error(
      `DUPLICATE_WARD: Login email ${loginEmail} already exists. A distributor is already registered for division ${divisionSlug}, ward ${wardSuffix}.`,
    );
  }

  return loginEmail;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
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

async function getAdminSummary(req, res) {
  try {
    const { start, end } = getTodayRange();

    const todayTokenQuery = {
      $or: [
        { issuedAt: { $gte: start, $lt: end } },
        { issuedAt: { $exists: false }, createdAt: { $gte: start, $lt: end } },
      ],
    };

    const [
      pendingDistributors,
      activeConsumers,
      duplicateFamilies,
      issuedQRCards,
      todayTokens,
      auditAlerts,
      offlinePending,
      stockOutAgg,
      recentAlerts,
    ] = await Promise.all([
      User.countDocuments({
        userType: "Distributor",
        $or: [
          { authorityStatus: { $exists: false } },
          { authorityStatus: null },
          { authorityStatus: "Pending" },
        ],
      }),
      Consumer.countDocuments({ status: "Active" }),
      Family.countDocuments({ flaggedDuplicate: true }),
      OMSCard.countDocuments({}),
      Token.countDocuments(todayTokenQuery),
      AuditLog.countDocuments({
        severity: { $in: ["Warning", "Critical"] },
        createdAt: { $gte: start, $lt: end },
      }),
      OfflineQueue.countDocuments({ status: "Pending" }),
      StockLedger.aggregate([
        { $match: { dateKey: todayKey(), type: "OUT" } },
        { $group: { _id: null, totalKg: { $sum: "$qtyKg" } } },
      ]),
      AuditLog.find({ severity: { $in: ["Warning", "Critical"] } })
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          pendingDistributors,
          activeConsumers,
          duplicateFamilies,
          issuedQRCards,
          todayTokens,
          auditAlerts,
        },
        ops: {
          validScans: todayTokens,
          rejectedScans: 0,
          tokensGenerated: todayTokens,
          stockOutKg: stockOutAgg[0]?.totalKg || 0,
          offlineQueue: offlinePending,
        },
        alerts: recentAlerts,
      },
    });
  } catch (error) {
    console.error("getAdminSummary error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function getAdminDistributors(req, res) {
  try {
    const inputDivision = String(req.query.division || "").trim();
    const inputWard = normalizeWardNo(req.query.wardNo || req.query.ward);
    const canonDiv = inputDivision ? normalizeDivision(inputDivision) : "";

    const userQuery = { userType: "Distributor" };
    if (canonDiv) {
      userQuery.division = canonDiv;
    }
    if (inputWard) {
      userQuery.wardNo = inputWard;
    }

    const users = await User.find(userQuery)
      .select(
        "name phone email contactEmail wardNo ward division district upazila unionName authorityStatus status officeAddress authorityFrom authorityTo createdAt",
      )
      .lean();

    const distributorDocs = await Distributor.find({
      userId: { $in: users.map((u) => u._id) },
    }).lean();

    const distributorMap = new Map(
      distributorDocs.map((d) => [String(d.userId), d]),
    );

    const auditRequests = await AuditReportRequest.find({
      status: { $in: ["Requested", "Submitted", "Reviewed"] },
      decision: { $ne: "Approved" },
    })
      .select("distributorUserId status decision dueAt")
      .lean();

    const auditMap = new Map(
      auditRequests.map((r) => [String(r.distributorUserId), r]),
    );

    const rows = users.map((user) => {
      const distributor = distributorMap.get(String(user._id));
      const authorityStatus =
        user.authorityStatus || distributor?.authorityStatus || "Pending";
      const auditReq = auditMap.get(String(user._id));

      return {
        userId: String(user._id),
        distributorId: distributor?._id ? String(distributor._id) : null,
        name: user.name,
        phone: user.phone,
        email: user.email,
        contactEmail: user.contactEmail,
        wardNo: user.wardNo || "",
        division: user.division || distributor?.division || "",
        ward: user.ward || distributor?.ward || "",
        officeAddress: user.officeAddress || "",
        authorityStatus,
        authorityFrom: user.authorityFrom || distributor?.authorityFrom || null,
        authorityTo: user.authorityTo || distributor?.authorityTo || null,
        auditRequired: Boolean(auditReq),
        auditRequestStatus: auditReq?.status || null,
        auditDueAt: auditReq?.dueAt || null,
        createdAt: user.createdAt,
      };
    });

    const filteredRows = rows.filter((row) => {
      if (inputDivision && !isSameDivision(inputDivision, row.division)) {
        return false;
      }

      if (inputWard) {
        const rowWard = normalizeWardNo(row.wardNo || row.ward);
        if (!rowWard || rowWard !== inputWard) {
          return false;
        }
      }

      return true;
    });

    const stats = filteredRows.reduce(
      (acc, row) => {
        acc.total += 1;
        acc[row.authorityStatus] = (acc[row.authorityStatus] || 0) + 1;
        if (!row.authorityStatus || row.authorityStatus === "Pending") {
          acc.pending += 1;
        }
        return acc;
      },
      { total: 0, pending: 0 },
    );

    res.json({ success: true, data: { rows: filteredRows, stats } });
  } catch (error) {
    console.error("getAdminDistributors error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function createDistributor(req, res) {
  try {
    const {
      name,
      email,
      phone,
      wardNo,
      ward,
      division,
      district,
      upazila,
      unionName,
      officeAddress,
      authorityMonths,
    } = req.body || {};

    if (!name || !email || !wardNo || !String(division || "").trim()) {
      return res.status(400).json({
        success: false,
        message: "name, email, division and wardNo are required",
      });
    }

    const cleanDivision = normalizeDivision(division);
    const cleanDistrict = district ? String(district).trim() : undefined;
    const cleanUpazila = upazila ? String(upazila).trim() : undefined;
    const cleanUnionName = unionName ? String(unionName).trim() : undefined;
    const wardNoNormalized = normalizeWardNo(wardNo);

    if (!isValidWardNo(wardNo)) {
      return res.status(400).json({
        success: false,
        message: "wardNo must be a valid number between 01 and 99",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "A valid contact email is required",
      });
    }

    const existingInWard = await User.findOne({
      userType: "Distributor",
      division: cleanDivision,
      wardNo: wardNoNormalized,
      status: { $ne: "Inactive" },
    }).lean();

    if (existingInWard) {
      return res.status(409).json({
        success: false,
        message: `এই বিভাগের ওয়ার্ড ${wardNoNormalized}-এ ইতিমধ্যে একজন সক্রিয় ডিস্ট্রিবিউটর আছেন। একটি ওয়ার্ডে একজনের বেশি ডিস্ট্রিবিউটর নিয়োগ করা যাবে না।`,
        existing: {
          name: existingInWard.name,
          wardNo: existingInWard.wardNo,
          division: existingInWard.division,
          authorityStatus: existingInWard.authorityStatus,
        },
      });
    }

    const loginEmail = await generateDistributorLoginEmail(
      cleanDivision,
      wardNoNormalized,
    );
    const generatedPassword = generateStrongPassword();
    const passwordHash = await bcrypt.hash(generatedPassword, 10);
    const fromDate = new Date();
    const months = Math.max(1, Number(authorityMonths) || 6);
    const toDate = new Date(fromDate);
    toDate.setMonth(toDate.getMonth() + months);

    const user = await User.create({
      userType: "Distributor",
      name: String(name).trim(),
      email: loginEmail,
      contactEmail: String(email).trim().toLowerCase(),
      phone: phone ? String(phone).trim() : undefined,
      passwordHash,
      status: "Active",
      tokenVersion: 0,
      mustChangePassword: true,
      authorityStatus: "Pending",
      wardNo: wardNoNormalized,
      ward: wardNoNormalized,
      division: cleanDivision,
      district: cleanDistrict,
      upazila: cleanUpazila,
      unionName: cleanUnionName,
      officeAddress,
      authorityFrom: fromDate,
      authorityTo: toDate,
    });

    const distributor = await Distributor.create({
      userId: user._id,
      wardNo: wardNoNormalized,
      ward: wardNoNormalized,
      division: cleanDivision,
      district: cleanDistrict,
      upazila: cleanUpazila,
      unionName: cleanUnionName,
      authorityStatus: "Pending",
      authorityFrom: fromDate,
      authorityTo: toDate,
    });

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Central Admin",
      action: "DISTRIBUTOR_CREATED",
      entityType: "User",
      entityId: String(user._id),
      severity: "Info",
      meta: {
        distributorId: String(distributor._id),
      },
    });

    await notifyAdmins({
      title: "ডিস্ট্রিবিউটর তৈরি হয়েছে",
      message: `নতুন ডিস্ট্রিবিউটর তৈরি হয়েছে: ${name} (Ward ${wardNoNormalized})`,
      meta: {
        userId: String(user._id),
        distributorId: String(distributor._id),
      },
    });

    const emailResult = await sendDistributorCredentialEmail({
      to: user.contactEmail,
      name: user.name,
      loginEmail: user.email,
      password: generatedPassword,
      ward: user.ward,
      wardNo: user.wardNo,
      authorityStatus: user.authorityStatus,
    });

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Central Admin",
      action: "DISTRIBUTOR_CREDENTIALS_EMAIL",
      entityType: "User",
      entityId: String(user._id),
      severity: emailResult.sent ? "Info" : "Warning",
      meta: {
        loginEmail: user.email,
        credentialSentTo: user.contactEmail,
        emailSent: emailResult.sent,
        emailReason: emailResult.reason || null,
      },
    });

    const userObject = user.toObject();
    delete userObject.passwordHash;

    return res.status(201).json({
      success: true,
      message: emailResult.sent
        ? "Distributor created and credentials sent by email"
        : "Distributor created, but credential email could not be sent",
      data: {
        user: userObject,
        credentialEmailSent: emailResult.sent,
        loginEmail: user.email,
        credentialSentTo: user.contactEmail,
      },
    });
  } catch (error) {
    console.error("createDistributor error:", error);
    if (error.message?.startsWith("DUPLICATE_WARD")) {
      return res.status(409).json({
        success: false,
        message: "এই ওয়ার্ডে ইতিমধ্যে একজন ডিস্ট্রিবিউটর নিবন্ধিত আছেন।",
      });
    }
    if (error?.code === 11000) {
      const dupField = Object.keys(error?.keyPattern || {})[0] || "field";
      const label = dupField === "phone" ? "Phone" : dupField;
      return res.status(409).json({
        success: false,
        message: `${label} already exists`,
      });
    }
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

async function adminResetDistributorPassword(req, res) {
  try {
    const { newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({
        success: false,
        message: "newPassword must be at least 8 characters",
      });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (!["Distributor", "FieldUser"].includes(user.userType)) {
      return res.status(400).json({
        success: false,
        message: "Password reset is allowed for Distributor/FieldUser only",
      });
    }

    user.passwordHash = await bcrypt.hash(String(newPassword), 10);
    user.passwordChangedAt = new Date();
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.mustChangePassword = true;
    await user.save();

    const deliveryEmail = user.email || user.contactEmail;

    const ackToken = makePasswordChangeAckToken({
      user,
      changedByUserId: req.user.userId,
      changedByType: "Central Admin",
    });
    const publicBase = getBackendPublicBaseUrl();
    const yesUrl = `${publicBase}/api/auth/password-change/ack?action=yes&token=${encodeURIComponent(ackToken)}`;
    const notMeUrl = `${publicBase}/api/auth/password-change/ack?action=not-me&token=${encodeURIComponent(ackToken)}`;

    const emailResult = deliveryEmail
      ? await sendDistributorCredentialEmail({
          to: deliveryEmail,
          name: user.name,
          loginEmail: user.email,
          password: String(newPassword),
          ward: user.ward,
          wardNo: user.wardNo,
          authorityStatus: user.authorityStatus,
        })
      : { sent: false, reason: "MISSING_LOGIN_EMAIL" };

    const securityEmailResult = deliveryEmail
      ? await sendDistributorPasswordChangeAlertEmail({
          to: deliveryEmail,
          name: user.name,
          loginEmail: user.email,
          changedBy: "Central Admin",
          changedAt: new Date(user.passwordChangedAt).toLocaleString("en-GB"),
          yesUrl,
          notMeUrl,
        })
      : { sent: false, reason: "MISSING_LOGIN_EMAIL" };

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Central Admin",
      action: "ADMIN_PASSWORD_RESET",
      entityType: "User",
      entityId: String(user._id),
      severity: "Warning",
      meta: {
        loginEmail: user.email,
        credentialSentTo: deliveryEmail || null,
        credentialEmailSent: emailResult.sent,
        securityAlertEmailSent: securityEmailResult.sent,
        emailReason: emailResult.reason || null,
      },
    });

    await notifyUser(user._id, {
      title: "পাসওয়ার্ড পরিবর্তন",
      message: "আপনার পাসওয়ার্ড অ্যাডমিন দ্বারা পরিবর্তন করা হয়েছে।",
    });

    return res.json({
      success: true,
      message: emailResult.sent
        ? "Password reset and new credentials sent by email"
        : deliveryEmail
          ? "Password reset completed, but credential email could not be sent"
          : "Password reset completed. Login email is missing, so credentials were not emailed",
      data: {
        credentialEmailSent: emailResult.sent,
        securityAlertEmailSent: securityEmailResult.sent,
        loginEmail: user.email,
        credentialSentTo: deliveryEmail || null,
      },
    });
  } catch (error) {
    console.error("adminResetDistributorPassword error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

async function updateDistributorStatus(req, res) {
  try {
    const { status, reason } = req.body || {};
    if (!status || !["Active", "Suspended", "Revoked"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status must be Active, Suspended, or Revoked",
      });
    }

    const user = await User.findById(req.params.userId);
    if (!user || user.userType !== "Distributor") {
      return res.status(404).json({
        success: false,
        message: "Distributor user not found",
      });
    }

    const previousStatus = user.authorityStatus || "Pending";
    user.authorityStatus = status;
    if (status === "Active") {
      user.status = "Active";
    } else if (status === "Suspended") {
      user.status = "Suspended";
    } else if (status === "Revoked") {
      user.status = "Inactive";
    }

    const isApproval = status === "Active" && previousStatus === "Pending";
    const isReEnableFromDisabled =
      status === "Active" && ["Suspended", "Revoked"].includes(previousStatus);
    const isDisabledNow = ["Suspended", "Revoked"].includes(status);

    let rotatedPassword = null;
    if (isReEnableFromDisabled) {
      rotatedPassword = generateStrongPassword();
      user.passwordHash = await bcrypt.hash(rotatedPassword, 10);
      user.mustChangePassword = true;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    if (isDisabledNow) {
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    await user.save();

    let distributor = await Distributor.findOne({ userId: user._id });
    if (!distributor) {
      distributor = await Distributor.create({
        userId: user._id,
        wardNo: user.wardNo,
        division: user.division,
        district: user.district,
        upazila: user.upazila,
        unionName: user.unionName,
        ward: user.ward,
        authorityStatus: status,
        authorityFrom: user.authorityFrom || new Date(),
        authorityTo: user.authorityTo,
      });
    } else {
      distributor.authorityStatus = status;
      await distributor.save();
    }

    const deliveryEmail = user.contactEmail;

    const credentialEmailResult =
      rotatedPassword && deliveryEmail
        ? await sendDistributorCredentialEmail({
            to: deliveryEmail,
            name: user.name,
            loginEmail: user.email,
            password: rotatedPassword,
            ward: user.ward,
            wardNo: user.wardNo,
            authorityStatus: status,
          })
        : {
            sent: false,
            reason: rotatedPassword ? "MISSING_CONTACT_EMAIL" : null,
          };

    const statusEmailResult =
      (isApproval || isDisabledNow) && deliveryEmail
        ? await sendDistributorStatusEmail({
            to: deliveryEmail,
            name: user.name,
            loginEmail: user.email,
            ward: user.ward,
            wardNo: user.wardNo,
            status,
            reason: reason
              ? String(reason)
              : status === "Revoked"
                ? "Distribution authority ended/disabled by admin"
                : status === "Suspended"
                  ? "Temporarily disabled by admin"
                  : "Approved by admin",
          })
        : {
            sent: false,
            reason:
              isApproval || isDisabledNow
                ? "MISSING_CONTACT_EMAIL"
                : "NOT_REQUIRED",
          };

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Admin",
      action: "DISTRIBUTOR_STATUS_UPDATED",
      entityType: "Distributor",
      entityId: String(distributor._id),
      severity: status === "Active" ? "Info" : "Warning",
      meta: {
        status,
        previousStatus,
        rotatedPassword: Boolean(rotatedPassword),
        loginEmail: user.email,
        credentialSentTo: deliveryEmail || null,
        credentialEmailSent: credentialEmailResult.sent,
        credentialEmailReason: credentialEmailResult.reason || null,
        statusEmailSent: statusEmailResult.sent,
        statusEmailReason: statusEmailResult.reason || null,
      },
    });

    await notifyUser(user._id, {
      title: "Distributor status updated",
      message:
        status === "Active"
          ? "Your distributor account is approved and active."
          : `Your distributor account status is now ${status}.`,
      meta: { status },
    });

    res.json({
      success: true,
      message: isApproval
        ? statusEmailResult.sent
          ? "Distributor approved. Approval email sent"
          : "Distributor approved"
        : isReEnableFromDisabled
          ? credentialEmailResult.sent
            ? "Distributor re-enabled and new credentials sent by email"
            : deliveryEmail
              ? "Distributor re-enabled and password rotated, but credential email could not be sent"
              : "Distributor re-enabled and password rotated, but contact email is missing"
          : isDisabledNow
            ? statusEmailResult.sent
              ? "Distributor disabled and notification email sent"
              : "Distributor disabled"
            : "Distributor status updated",
      data: {
        userId: String(user._id),
        authorityStatus: status,
        credentialEmailSent: credentialEmailResult.sent,
        statusEmailSent: statusEmailResult.sent,
        loginEmail: user.email,
        credentialSentTo: deliveryEmail || null,
      },
    });
  } catch (error) {
    console.error("updateDistributorStatus error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function deleteDistributor(req, res) {
  try {
    const user = await User.findById(req.params.userId);
    if (!user || user.userType !== "Distributor") {
      return res.status(404).json({
        success: false,
        message: "Distributor user not found",
      });
    }

    const distributor = await Distributor.findOne({ userId: user._id }).lean();

    if (distributor?._id) {
      const [consumerCount, tokenCount, sessionCount, stockCount, queueCount] =
        await Promise.all([
          Consumer.countDocuments({ createdByDistributor: distributor._id }),
          Token.countDocuments({ distributorId: distributor._id }),
          DistributionSession.countDocuments({
            distributorId: distributor._id,
          }),
          StockLedger.countDocuments({ distributorId: distributor._id }),
          OfflineQueue.countDocuments({ distributorId: distributor._id }),
        ]);

      const totalLinked =
        consumerCount + tokenCount + sessionCount + stockCount + queueCount;

      if (totalLinked > 0) {
        return res.status(409).json({
          success: false,
          message:
            "This distributor has operational history. Use disable/suspend instead of delete.",
          data: {
            consumerCount,
            tokenCount,
            sessionCount,
            stockCount,
            queueCount,
          },
        });
      }
    }

    if (distributor?._id) {
      await Promise.all([
        Distributor.deleteOne({ _id: distributor._id }),
        BlacklistEntry.deleteMany({
          targetType: "Distributor",
          targetRefId: String(distributor._id),
        }),
      ]);
    }

    await AuditReportRequest.deleteMany({ distributorUserId: user._id });

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Central Admin",
      action: "DISTRIBUTOR_DELETED",
      entityType: "User",
      entityId: String(user._id),
      severity: "Warning",
      meta: {
        email: user.email,
        phone: user.phone,
      },
    });

    await User.deleteOne({ _id: user._id });

    return res.json({
      success: true,
      message: "Distributor deleted permanently",
    });
  } catch (error) {
    console.error("deleteDistributor error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

async function getAdminCardsSummary(req, res) {
  try {
    const now = new Date();
    const rotationThreshold = new Date(now.getTime() + 7 * 86400000);

    const [issuedCards, activeQR, inactiveQR, dueForRotation] =
      await Promise.all([
        OMSCard.countDocuments({}),
        QRCode.countDocuments({ status: "Valid" }),
        QRCode.countDocuments({ status: { $ne: "Valid" } }),
        QRCode.countDocuments({ validTo: { $lte: rotationThreshold } }),
      ]);

    res.json({
      success: true,
      data: {
        issuedCards,
        activeQR,
        inactiveRevoked: inactiveQR,
        dueForRotation,
      },
    });
  } catch (error) {
    console.error("getAdminCardsSummary error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function getAdminDistributionMonitoring(req, res) {
  try {
    const records = await DistributionRecord.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .populate({
        path: "tokenId",
        populate: [
          {
            path: "consumerId",
            select: "ward division",
          },
          {
            path: "distributorId",
            select: "ward wardNo division userId",
          },
        ],
      })
      .lean();

    const distributorUserIds = records
      .map((record) => {
        const token =
          record.tokenId && typeof record.tokenId === "object"
            ? record.tokenId
            : null;
        const distributor =
          token?.distributorId && typeof token.distributorId === "object"
            ? token.distributorId
            : null;
        return distributor?.userId ? String(distributor.userId) : null;
      })
      .filter(Boolean);

    const users = await User.find({ _id: { $in: distributorUserIds } })
      .select("name")
      .lean();
    const userNameMap = new Map(users.map((u) => [String(u._id), u.name]));

    const rows = records.map((record) => {
      const token =
        record.tokenId && typeof record.tokenId === "object"
          ? record.tokenId
          : null;
      const consumer =
        token?.consumerId && typeof token.consumerId === "object"
          ? token.consumerId
          : null;
      const distributor =
        token?.distributorId && typeof token.distributorId === "object"
          ? token.distributorId
          : null;

      const division = normalizeDivision(
        consumer?.division || distributor?.division || "",
      );
      const ward =
        normalizeWardNo(
          consumer?.ward || distributor?.wardNo || distributor?.ward,
        ) ||
        consumer?.ward ||
        distributor?.ward ||
        "Unknown";
      const distributorName = distributor?.userId
        ? userNameMap.get(String(distributor.userId)) || "—"
        : "—";

      return {
        distributor: distributorName,
        division: division || "Unknown",
        ward,
        expectedKg: record.expectedKg,
        actualKg: record.actualKg,
        status: record.mismatch ? "Mismatch" : "Matched",
        action: record.mismatch ? "Pause + Alert" : "Continue",
      };
    });

    res.json({ success: true, data: { rows } });
  } catch (error) {
    console.error("getAdminDistributionMonitoring error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function getAdminConsumerReview(req, res) {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

    const consumers = await Consumer.find({})
      .populate("familyId", "flaggedDuplicate")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const rows = consumers.map((consumer) => {
      const family = consumer.familyId || null;
      return {
        id: String(consumer._id),
        consumerCode: consumer.consumerCode,
        name: consumer.name,
        ward: consumer.ward || "",
        nidLast4: consumer.nidLast4,
        status: consumer.status,
        blacklistStatus: consumer.blacklistStatus,
        familyFlag: !!family?.flaggedDuplicate,
      };
    });

    res.json({ success: true, data: { rows } });
  } catch (error) {
    console.error("getAdminConsumerReview error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function getAdminAuditDetail(req, res) {
  try {
    const log = await AuditLog.findById(req.params.id).lean();
    if (!log) {
      return res
        .status(404)
        .json({ success: false, message: "Audit log not found" });
    }

    let consumer = null;

    const populateConsumer = async (id) =>
      Consumer.findById(id)
        .populate(
          "createdByDistributor",
          "name phone email ward officeAddress division district upazila unionName",
        )
        .populate("familyId")
        .lean()
        .then((consumer) => {
          if (!consumer) return null;
          return {
            ...consumer,
            nidFull: decryptNid(consumer.nidFull),
            fatherNidFull: decryptNid(consumer.fatherNidFull),
            motherNidFull: decryptNid(consumer.motherNidFull),
          };
        });

    if (log.entityType === "Consumer" && log.entityId) {
      consumer = await populateConsumer(log.entityId);
    }

    if (!consumer && log.entityType === "Token" && log.entityId) {
      const token = await Token.findById(log.entityId)
        .populate({
          path: "consumerId",
          populate: [
            { path: "createdByDistributor", select: "name phone email ward" },
            { path: "familyId" },
          ],
        })
        .lean();
      consumer = token?.consumerId || null;
    }

    if (!consumer && log.entityType === "BlacklistEntry" && log.entityId) {
      const entry = await BlacklistEntry.findById(log.entityId).lean();
      if (entry?.targetType === "Consumer" && entry.targetRefId) {
        consumer = await populateConsumer(entry.targetRefId);
      }
    }

    res.json({ success: true, data: { log, consumer } });
  } catch (error) {
    console.error("getAdminAuditDetail error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function getAdminAuditLogs(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
    const query = {};

    const severity = String(req.query.severity || "").trim();
    const action = String(req.query.action || "").trim();
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();

    if (severity && ["Info", "Warning", "Critical"].includes(severity)) {
      query.severity = severity;
    }

    if (action) {
      query.action = { $regex: action, $options: "i" };
    }

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(query),
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
    });
  } catch (error) {
    console.error("getAdminAuditLogs error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

async function forceCloseSession(req, res) {
  try {
    const { sessionId } = req.params;
    const { reason } = req.body || {};

    const targetSession = await DistributionSession.findById(sessionId);
    if (!targetSession) {
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });
    }

    if (targetSession.status === "Closed") {
      return res
        .status(400)
        .json({ success: false, message: "Session already closed" });
    }

    targetSession.status = "Closed";
    targetSession.closedAt = new Date();
    await targetSession.save();

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Central Admin",
      action: "SESSION_FORCE_CLOSED",
      entityType: "DistributionSession",
      entityId: String(targetSession._id),
      severity: "Warning",
      meta: {
        reason: reason || "Force closed by admin",
        dateKey: targetSession.dateKey,
      },
    });

    const distributor = await Distributor.findById(
      targetSession.distributorId,
    ).lean();
    if (distributor?.userId) {
      await notifyUser(distributor.userId, {
        title: "Session force-closed by admin",
        message: `Your distribution session for ${targetSession.dateKey} was closed by admin. Reason: ${reason || "Not specified"}`,
        meta: { sessionId: String(targetSession._id) },
      });
    }

    return res.json({ success: true, data: { session: targetSession } });
  } catch (error) {
    console.error("forceCloseSession error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = {
  getAdminSummary,
  getAdminDistributors,
  updateDistributorStatus,
  deleteDistributor,
  createDistributor,
  adminResetDistributorPassword,
  getAdminCardsSummary,
  getAdminDistributionMonitoring,
  getAdminConsumerReview,
  getAdminAuditLogs,
  getAdminAuditDetail,
  forceCloseSession,
};
