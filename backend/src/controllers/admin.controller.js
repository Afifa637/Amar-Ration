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
const {
  STOCK_ITEMS,
  normalizeStockItem,
} = require("../utils/stock-items.utils");
const {
  mapSingleItemQty,
  normalizeQtyByItem,
  hydrateRecordItemFields,
  roundKg,
} = require("../services/distributionRecord.service");

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
  const slugMap = {
    ঢাকা: "dhaka",
    চট্টগ্রাম: "chattogram",
    রাজশাহী: "rajshahi",
    খুলনা: "khulna",
    বরিশাল: "barishal",
    সিলেট: "sylhet",
    রংপুর: "rangpur",
    ময়মনসিংহ: "mymensingh",
  };
  if (slugMap[canonical]) {
    return slugMap[canonical];
  }
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

    const metaDistributorIds = Array.from(
      new Set(
        recentAlerts
          .map((a) => String(a?.meta?.distributorId || "").trim())
          .filter(Boolean),
      ),
    );
    const metaSessionIds = Array.from(
      new Set(
        recentAlerts
          .map((a) => String(a?.meta?.sessionId || "").trim())
          .filter(Boolean),
      ),
    );

    const alertSessions = metaSessionIds.length
      ? await DistributionSession.find({ _id: { $in: metaSessionIds } })
          .select("_id distributorId")
          .lean()
      : [];
    const sessionToDistributorId = new Map(
      alertSessions
        .filter((s) => s?._id && s?.distributorId)
        .map((s) => [String(s._id), String(s.distributorId)]),
    );

    const allDistributorIds = Array.from(
      new Set([
        ...metaDistributorIds,
        ...Array.from(sessionToDistributorId.values()),
      ]),
    );

    const alertDistributors = allDistributorIds.length
      ? await Distributor.find({ _id: { $in: allDistributorIds } })
          .select("_id userId division wardNo ward")
          .lean()
      : [];
    const distributorById = new Map(
      alertDistributors.map((d) => [String(d._id), d]),
    );
    const alertUserIds = Array.from(
      new Set(
        alertDistributors
          .map((d) => String(d.userId || "").trim())
          .filter(Boolean),
      ),
    );
    const alertUsers = alertUserIds.length
      ? await User.find({ _id: { $in: alertUserIds } })
          .select("_id name")
          .lean()
      : [];
    const alertUserNameById = new Map(
      alertUsers.map((u) => [String(u._id), u.name || "অজানা"]),
    );

    const enrichedAlerts = recentAlerts.map((alert) => {
      const directDistributorId = String(
        alert?.meta?.distributorId || "",
      ).trim();
      const sessionId = String(alert?.meta?.sessionId || "").trim();
      const distributorId =
        directDistributorId || sessionToDistributorId.get(sessionId) || "";
      const distributor = distributorById.get(distributorId);
      const division = normalizeDivision(
        alert?.meta?.division || distributor?.division || "",
      );
      const ward =
        normalizeWardNo(
          alert?.meta?.ward || distributor?.wardNo || distributor?.ward,
        ) || "";
      const distributorName = distributor?.userId
        ? alertUserNameById.get(String(distributor.userId)) || "অজানা"
        : "";

      return {
        ...alert,
        meta: {
          ...(alert.meta || {}),
          division,
          ward,
          distributorId: distributorId || undefined,
          distributorName,
          sessionId: sessionId || undefined,
          actionable:
            !!(distributorId || sessionId) &&
            ["Warning", "Critical"].includes(String(alert?.severity || "")) &&
            String(alert?.action || "") !== "ADMIN_ALERT_ACTION_APPLIED",
        },
      };
    });

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
        alerts: enrichedAlerts,
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
    const inputStatus = String(req.query.status || "").trim();
    const inputAuditFlag = String(req.query.auditRequired || "").trim();
    const inputSearch = String(req.query.search || "")
      .trim()
      .toLowerCase();
    const canonDiv = inputDivision ? normalizeDivision(inputDivision) : "";

    if (inputWard && !canonDiv) {
      return res.status(400).json({
        success: false,
        message: "ওয়ার্ড ফিল্টার ব্যবহার করতে বিভাগ একসাথে দিতে হবে",
        code: "VALIDATION_ERROR",
      });
    }

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
        loginEmail: user.email,
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

      if (inputStatus && row.authorityStatus !== inputStatus) {
        return false;
      }

      if (inputAuditFlag === "true" && !row.auditRequired) return false;
      if (inputAuditFlag === "false" && row.auditRequired) return false;

      if (inputSearch) {
        const haystack = [
          row.name,
          row.email,
          row.contactEmail,
          row.phone,
          row.userId,
          row.division,
          row.ward,
          row.wardNo,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(inputSearch)) {
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
      loginEmail: user.email,
      contactEmail: user.contactEmail,
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
        emailPreviewUrl: emailResult.previewUrl || null,
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
        emailReason: emailResult.reason || null,
        emailPreviewUrl: emailResult.previewUrl || null,
        loginEmail: user.email,
        credentialSentTo: user.contactEmail,
        temporaryPassword: emailResult.sent ? undefined : generatedPassword,
        mustChangePassword: true,
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

    const deliveryEmail = user.contactEmail || user.email;
    const emailFallback = !user.contactEmail && !!user.email;

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
        emailFallback,
        credentialEmailSent: emailResult.sent,
        securityAlertEmailSent: securityEmailResult.sent,
        emailReason: emailResult.reason || null,
      },
    });

    if (emailFallback) {
      await writeAudit({
        actorUserId: req.user.userId,
        actorType: "Central Admin",
        action: "DISTRIBUTOR_EMAIL_FALLBACK_USED",
        entityType: "User",
        entityId: String(user._id),
        severity: "Warning",
        meta: {
          loginEmail: user.email,
          contactEmail: user.contactEmail || null,
          emailFallback: true,
        },
      });
    }

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
        emailReason: emailResult.reason || null,
        emailPreviewUrl: emailResult.previewUrl || null,
        securityAlertEmailSent: securityEmailResult.sent,
        securityEmailReason: securityEmailResult.reason || null,
        loginEmail: user.email,
        credentialSentTo: deliveryEmail || null,
        temporaryPassword: emailResult.sent ? undefined : String(newPassword),
        mustChangePassword: true,
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
    user.pendingSuspend = false;
    user.pendingSuspendAt = null;
    user.pendingSuspendReason = null;
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
        loginEmail: user.email,
        contactEmail: user.contactEmail,
        authorityStatus: status,
        authorityFrom: user.authorityFrom || new Date(),
        authorityTo: user.authorityTo,
      });
    } else {
      distributor.authorityStatus = status;
      await distributor.save();
    }

    const deliveryEmail = user.contactEmail || user.email;
    const emailFallback = !user.contactEmail && !!user.email;

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
        emailFallback,
        credentialEmailSent: credentialEmailResult.sent,
        credentialEmailReason: credentialEmailResult.reason || null,
        statusEmailSent: statusEmailResult.sent,
        statusEmailReason: statusEmailResult.reason || null,
      },
    });

    if (emailFallback) {
      await writeAudit({
        actorUserId: req.user.userId,
        actorType: "Central Admin",
        action: "DISTRIBUTOR_EMAIL_FALLBACK_USED",
        entityType: "User",
        entityId: String(user._id),
        severity: "Warning",
        meta: {
          status,
          loginEmail: user.email,
          contactEmail: user.contactEmail || null,
          emailFallback: true,
        },
      });
    }

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
        credentialEmailReason: credentialEmailResult.reason || null,
        statusEmailSent: statusEmailResult.sent,
        statusEmailReason: statusEmailResult.reason || null,
        loginEmail: user.email,
        credentialSentTo: deliveryEmail || null,
        temporaryPassword:
          rotatedPassword && !credentialEmailResult.sent
            ? rotatedPassword
            : undefined,
        mustChangePassword: Boolean(rotatedPassword),
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

async function resendDistributorCredentials(req, res) {
  try {
    if (req.user.userType !== "Admin") {
      return res.status(403).json({
        success: false,
        message: "শুধুমাত্র অ্যাডমিন এই কাজ করতে পারবেন",
        code: "ADMIN_ONLY",
      });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "ডিস্ট্রিবিউটর ইউজার পাওয়া যায়নি",
        code: "USER_NOT_FOUND",
      });
    }

    if (user.userType !== "Distributor") {
      return res.status(400).json({
        success: false,
        message: "শুধুমাত্র ডিস্ট্রিবিউটর ইউজারের জন্য প্রযোজ্য",
        code: "INVALID_TARGET_USER_TYPE",
      });
    }

    const generatedPassword = generateStrongPassword();
    user.passwordHash = await bcrypt.hash(generatedPassword, 10);
    user.passwordChangedAt = new Date();
    user.mustChangePassword = true;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    const deliveryEmail = user.contactEmail || user.email;
    const emailFallback = !user.contactEmail && !!user.email;

    const emailResult = deliveryEmail
      ? await sendDistributorCredentialEmail({
          to: deliveryEmail,
          name: user.name,
          loginEmail: user.email,
          password: generatedPassword,
          ward: user.ward,
          wardNo: user.wardNo,
          authorityStatus: user.authorityStatus,
        })
      : { sent: false, reason: "MISSING_EMAIL" };

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Central Admin",
      action: "DISTRIBUTOR_CREDENTIALS_RESENT",
      entityType: "User",
      entityId: String(user._id),
      severity: emailResult.sent ? "Warning" : "Critical",
      meta: {
        loginEmail: user.email,
        contactEmail: user.contactEmail || null,
        credentialSentTo: deliveryEmail || null,
        credentialEmailSent: emailResult.sent,
        emailReason: emailResult.reason || null,
        emailPreviewUrl: emailResult.previewUrl || null,
        emailFallback,
      },
    });

    return res.json({
      success: true,
      message: emailResult.sent
        ? "নতুন লগইন তথ্য যোগাযোগ ইমেইলে পাঠানো হয়েছে"
        : "নতুন পাসওয়ার্ড তৈরি হয়েছে, কিন্তু ইমেইল পাঠানো যায়নি",
      data: {
        credentialEmailSent: emailResult.sent,
        emailReason: emailResult.reason || null,
        emailPreviewUrl: emailResult.previewUrl || null,
        loginEmail: user.email,
        credentialSentTo: deliveryEmail || null,
        temporaryPassword: emailResult.sent ? undefined : generatedPassword,
        mustChangePassword: true,
      },
    });
  } catch (error) {
    console.error("resendDistributorCredentials error:", error);
    return res.status(500).json({
      success: false,
      message: "শংসাপত্র পুনরায় পাঠাতে সমস্যা হয়েছে",
      code: "SERVER_ERROR",
    });
  }
}

async function getAdminCardsSummary(req, res) {
  try {
    const now = new Date();
    const rotationThreshold = new Date(now.getTime() + 7 * 86400000);
    const requestedDivision = normalizeDivision(req.query.division);
    const requestedWard = normalizeWardNo(req.query.ward || req.query.wardNo);

    if (requestedWard && !requestedDivision) {
      return res.status(400).json({
        success: false,
        message: "ওয়ার্ড ফিল্টার ব্যবহার করতে বিভাগ একসাথে দিতে হবে",
        code: "VALIDATION_ERROR",
      });
    }

    const consumerQuery = {};
    if (requestedDivision) consumerQuery.division = requestedDivision;
    if (requestedWard) consumerQuery.ward = requestedWard;

    const consumers = await Consumer.find(consumerQuery).select("_id").lean();
    const consumerIds = consumers.map((c) => c._id);

    const cards = await OMSCard.find({
      consumerId: { $in: consumerIds },
    })
      .select("consumerId cardStatus qrCodeId")
      .lean();

    const qrIds = cards
      .map((card) => card.qrCodeId)
      .filter(Boolean)
      .map((id) => String(id));

    const qrDocs = qrIds.length
      ? await QRCode.find({ _id: { $in: qrIds } })
          .select("_id status validTo")
          .lean()
      : [];
    const qrMap = new Map(qrDocs.map((qr) => [String(qr._id), qr]));

    const consumerTotal = consumers.length;

    const issuedCards = cards.length;
    const activeCards = cards.filter(
      (card) => card.cardStatus === "Active",
    ).length;
    const inactiveCards = cards.filter(
      (card) => card.cardStatus !== "Active",
    ).length;

    let validQR = 0;
    let revokedOrInvalidQR = 0;
    let dueForRotation = 0;

    for (const card of cards) {
      const qr = qrMap.get(String(card.qrCodeId || ""));
      if (qr?.status === "Valid") {
        validQR += 1;
        if (qr.validTo && new Date(qr.validTo) <= rotationThreshold) {
          dueForRotation += 1;
        }
      } else {
        revokedOrInvalidQR += 1;
      }
    }

    const removedCards = Math.max(0, consumerTotal - issuedCards);

    res.json({
      success: true,
      data: {
        issuedCards,
        activeCards,
        inactiveCards,
        activeQR: validQR,
        inactiveRevoked: revokedOrInvalidQR,
        validQR,
        revokedOrInvalidQR,
        removedCards,
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
    const viewRaw = String(req.query.view || "live").toLowerCase();
    const viewAlias = viewRaw === "history" ? "recent" : viewRaw;
    const view = ["live", "recent", "planned", "mismatch"].includes(viewAlias)
      ? viewAlias
      : "live";

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));

    const distributorId = String(req.query.distributorId || "").trim();
    const divisionFilter = normalizeDivision(req.query.division);
    const wardFilter = normalizeWardNo(req.query.ward || req.query.wardNo);
    const sessionStatus = String(req.query.sessionStatus || "").trim();
    const itemFilter = normalizeStockItem(req.query.item);
    const mismatchOnly =
      view === "mismatch" ||
      ["1", "true", "yes"].includes(
        String(req.query.mismatchOnly || "").toLowerCase(),
      );

    if (wardFilter && !divisionFilter) {
      return res.status(400).json({
        success: false,
        message: "ওয়ার্ড ফিল্টার ব্যবহার করতে বিভাগ একসাথে দিতে হবে",
        code: "VALIDATION_ERROR",
      });
    }

    const distributorQuery = {};
    if (distributorId) distributorQuery._id = distributorId;
    if (divisionFilter) distributorQuery.division = divisionFilter;
    if (wardFilter) {
      distributorQuery.$or = [{ wardNo: wardFilter }, { ward: wardFilter }];
    }

    const distributors = await Distributor.find(distributorQuery)
      .select("_id userId ward wardNo division")
      .lean();

    if (!distributors.length) {
      return res.json({
        success: true,
        data: {
          rows: [],
          groups: [],
          pagination: { page, limit, total: 0, pages: 1 },
          view,
          filters: {
            distributorId: distributorId || "",
            division: divisionFilter || "",
            ward: wardFilter || "",
            sessionStatus,
            item: itemFilter || "",
            mismatchOnly,
          },
        },
      });
    }

    const distributorIds = distributors.map((d) => String(d._id));
    const distributorUserIds = distributors
      .map((d) => d.userId)
      .filter(Boolean);
    const users = await User.find({ _id: { $in: distributorUserIds } })
      .select("_id name")
      .lean();
    const userNameMap = new Map(users.map((u) => [String(u._id), u.name]));

    const sessionQuery = { distributorId: { $in: distributorIds } };
    if (sessionStatus) {
      sessionQuery.status = sessionStatus;
    } else if (view === "live") {
      sessionQuery.status = { $in: ["Open", "Paused"] };
    } else if (view === "recent") {
      sessionQuery.status = "Closed";
    } else if (view === "planned") {
      sessionQuery.status = "Planned";
    }

    const dateKey = String(req.query.dateKey || "").trim();
    if (dateKey) sessionQuery.dateKey = dateKey;

    const totalSessions =
      await DistributionSession.countDocuments(sessionQuery);
    const totalPages = Math.max(1, Math.ceil(totalSessions / limit));
    const safePage = Math.min(page, totalPages);

    let sessionsQuery = DistributionSession.find(sessionQuery)
      .sort({ updatedAt: -1 })
      .select("_id distributorId dateKey status openedAt closedAt updatedAt")
      .lean();

    if (view === "recent" || view === "planned") {
      sessionsQuery = sessionsQuery.skip((safePage - 1) * limit).limit(limit);
    } else {
      sessionsQuery = sessionsQuery.limit(250);
    }

    const sessions = await sessionsQuery;
    if (!sessions.length) {
      return res.json({
        success: true,
        data: {
          rows: [],
          groups: [],
          pagination: {
            page: safePage,
            limit,
            total: totalSessions,
            pages: totalPages,
          },
          view,
          filters: {
            distributorId: distributorId || "",
            division: divisionFilter || "",
            ward: wardFilter || "",
            sessionStatus,
            item: itemFilter || "",
            mismatchOnly,
          },
        },
      });
    }

    const sessionIdList = sessions.map((s) => String(s._id));
    const tokens = await Token.find({ sessionId: { $in: sessionIdList } })
      .select(
        "_id sessionId consumerId rationItem rationQtyKg entitlementByItem status",
      )
      .lean();
    const tokenIdList = tokens.map((t) => String(t._id));
    const tokenById = new Map(tokens.map((t) => [String(t._id), t]));

    const rawRecords = tokenIdList.length
      ? await DistributionRecord.find({ tokenId: { $in: tokenIdList } })
          .select(
            "_id tokenId item expectedKg actualKg expectedByItem actualByItem mismatch createdAt",
          )
          .sort({ createdAt: -1 })
          .lean()
      : [];

    const stockQuery = {
      distributorId: {
        $in: Array.from(new Set(sessions.map((s) => String(s.distributorId)))),
      },
      dateKey: { $in: Array.from(new Set(sessions.map((s) => s.dateKey))) },
    };

    const stockRows = await StockLedger.find(stockQuery)
      .select("distributorId dateKey item type qtyKg")
      .lean();

    const emptyStockByItem = () =>
      STOCK_ITEMS.reduce((acc, itemName) => {
        acc[itemName] = 0;
        return acc;
      }, {});

    const stockByDistributorDate = new Map();
    const stockInByDistributorDate = new Map();
    for (const row of stockRows) {
      const itemName = normalizeStockItem(row.item);
      if (!itemName) continue;

      const key = `${String(row.distributorId)}::${row.dateKey}`;
      const current = stockByDistributorDate.get(key) || emptyStockByItem();
      const plannedCurrent =
        stockInByDistributorDate.get(key) || emptyStockByItem();
      const qty = Number(row.qtyKg || 0);

      if (row.type === "IN") current[itemName] += qty;
      if (row.type === "OUT") current[itemName] -= qty;
      if (row.type === "ADJUST") current[itemName] += qty;
      if (row.type === "IN") plannedCurrent[itemName] += qty;

      stockByDistributorDate.set(key, current);
      stockInByDistributorDate.set(key, plannedCurrent);
    }

    for (const stock of stockByDistributorDate.values()) {
      for (const itemName of Object.keys(stock)) {
        stock[itemName] = Number(stock[itemName].toFixed(3));
      }
    }

    const sessionStats = new Map(
      sessions.map((s) => [
        String(s._id),
        {
          assignedUsers: 0,
          permittedUsers: 0,
          scannedUsers: 0,
          matchedUsers: 0,
          mismatchUsers: 0,
          pendingUsers: 0,
          noShowUsers: 0,
          plannedKg: 0,
          expectedKg: 0,
          actualKg: 0,
          shortfallKg: 0,
          mismatchKg: 0,
          criticalAlertsCount: 0,
          itemBreakdown: STOCK_ITEMS.reduce((acc, itemName) => {
            acc[itemName] = {
              plannedKg: 0,
              scanExpectedKg: 0,
              actualKg: 0,
              remainingKg: 0,
              mismatchKg: 0,
            };
            return acc;
          }, {}),
          _scannedTokenIds: new Set(),
          _mismatchTokenIds: new Set(),
          mismatchCount: 0,
          rows: [],
        },
      ]),
    );

    for (const token of tokens) {
      const sessionId = String(token.sessionId || "");
      const stats = sessionStats.get(sessionId);
      if (!stats) continue;
      const rowItem = normalizeStockItem(token.rationItem);
      if (!rowItem) continue;

      const tokenEntitlementByItem = normalizeQtyByItem(
        token.entitlementByItem,
      );
      const hasEntitlementMap = STOCK_ITEMS.some(
        (itemName) => Number(tokenEntitlementByItem[itemName] || 0) > 0,
      );
      const legacyQty = Number(token.rationQtyKg || 0);
      const plannedByItem = hasEntitlementMap
        ? tokenEntitlementByItem
        : mapSingleItemQty(rowItem, legacyQty);

      if (itemFilter && Number(plannedByItem[itemFilter] || 0) <= 0) continue;

      const qty = STOCK_ITEMS.reduce(
        (sum, itemName) => sum + Number(plannedByItem[itemName] || 0),
        0,
      );

      stats.assignedUsers += 1;
      stats.permittedUsers += 1;
      stats.plannedKg += qty;
    }

    for (const record of rawRecords) {
      const token = tokenById.get(String(record.tokenId));
      if (!token) continue;
      const sessionId = String(token.sessionId);
      const stats = sessionStats.get(sessionId);
      if (!stats) continue;
      if (mismatchOnly && !record.mismatch) continue;

      const hydrated = hydrateRecordItemFields({
        item: record.item || token.rationItem,
        expectedKg: record.expectedKg || token.rationQtyKg,
        actualKg: record.actualKg,
        expectedByItem: record.expectedByItem,
        actualByItem: record.actualByItem,
      });

      let items = STOCK_ITEMS.filter(
        (itemName) =>
          Number(hydrated.expectedByItem[itemName] || 0) > 0 ||
          Number(hydrated.actualByItem[itemName] || 0) > 0,
      );

      if (!items.length) {
        items = [hydrated.item].filter(Boolean);
      }

      if (itemFilter) {
        items = items.filter((itemName) => itemName === itemFilter);
        if (!items.length) continue;
      }

      const expected = items.reduce(
        (sum, itemName) => sum + Number(hydrated.expectedByItem[itemName] || 0),
        0,
      );
      const actual = items.reduce(
        (sum, itemName) => sum + Number(hydrated.actualByItem[itemName] || 0),
        0,
      );

      stats.expectedKg += expected;
      stats.actualKg += actual;
      stats._scannedTokenIds.add(String(record.tokenId));
      if (record.mismatch) stats.mismatchCount += 1;
      if (record.mismatch) {
        stats._mismatchTokenIds.add(String(record.tokenId));
        stats.mismatchKg += Math.abs(expected - actual);
      }
      for (const itemName of items) {
        if (stats.itemBreakdown[itemName]) {
          const itemExpected = Number(hydrated.expectedByItem[itemName] || 0);
          const itemActual = Number(hydrated.actualByItem[itemName] || 0);
          stats.itemBreakdown[itemName].scanExpectedKg += itemExpected;
          stats.itemBreakdown[itemName].actualKg += itemActual;
          if (record.mismatch) {
            stats.itemBreakdown[itemName].mismatchKg += Math.abs(
              itemExpected - itemActual,
            );
          }
        }
      }

      for (const itemName of items) {
        stats.rows.push({
          recordId: String(record._id),
          item: itemName,
          expectedKg: Number(hydrated.expectedByItem[itemName] || 0),
          actualKg: Number(hydrated.actualByItem[itemName] || 0),
          mismatch: !!record.mismatch,
          createdAt: record.createdAt,
        });
      }
    }

    const alertLogs = await AuditLog.find({
      severity: { $in: ["Warning", "Critical"] },
      $or: [
        { "meta.sessionId": { $in: sessionIdList } },
        { "meta.distributorId": { $in: distributorIds } },
      ],
    })
      .select("createdAt meta")
      .lean();

    const sessionIdsByDistributorDate = new Map();
    for (const session of sessions) {
      const key = `${String(session.distributorId)}::${session.dateKey}`;
      if (!sessionIdsByDistributorDate.has(key)) {
        sessionIdsByDistributorDate.set(key, []);
      }
      sessionIdsByDistributorDate.get(key).push(String(session._id));
    }

    for (const log of alertLogs) {
      const directSessionId = String(log?.meta?.sessionId || "").trim();
      if (directSessionId && sessionStats.has(directSessionId)) {
        sessionStats.get(directSessionId).criticalAlertsCount += 1;
        continue;
      }

      const metaDistributorId = String(log?.meta?.distributorId || "").trim();
      if (!metaDistributorId || !log.createdAt) continue;
      const dk = new Date(log.createdAt).toISOString().slice(0, 10);
      const key = `${metaDistributorId}::${dk}`;
      const sessionIds = sessionIdsByDistributorDate.get(key) || [];
      for (const sid of sessionIds) {
        const stats = sessionStats.get(sid);
        if (stats) stats.criticalAlertsCount += 1;
      }
    }

    const distributorById = new Map(
      distributors.map((d) => [String(d._id), d]),
    );
    const groupsMap = new Map();

    for (const session of sessions) {
      const sessionId = String(session._id);
      const distributorIdStr = String(session.distributorId);
      const stats = sessionStats.get(sessionId) || {
        expectedKg: 0,
        actualKg: 0,
        mismatchCount: 0,
        rows: [],
      };

      if ((view === "mismatch" || mismatchOnly) && stats.mismatchCount < 1) {
        continue;
      }

      const distributor = distributorById.get(distributorIdStr);
      if (!distributor) continue;

      const stockKey = `${distributorIdStr}::${session.dateKey}`;
      const stockBalanceByItem =
        stockByDistributorDate.get(stockKey) || emptyStockByItem();
      const stockInByItem =
        stockInByDistributorDate.get(stockKey) || emptyStockByItem();

      stats.scannedUsers = stats._scannedTokenIds.size;
      stats.mismatchUsers = stats._mismatchTokenIds.size;
      stats.matchedUsers = Math.max(
        stats.scannedUsers - stats.mismatchUsers,
        0,
      );
      stats.pendingUsers = Math.max(
        stats.assignedUsers - stats.scannedUsers,
        0,
      );
      stats.noShowUsers = session.status === "Closed" ? stats.pendingUsers : 0;
      stats.shortfallKg = stats.expectedKg - stats.actualKg;
      stats.plannedKg = roundKg(stats.plannedKg);
      stats.expectedKg = roundKg(stats.expectedKg);
      stats.actualKg = roundKg(stats.actualKg);
      stats.shortfallKg = roundKg(stats.shortfallKg);
      stats.mismatchKg = roundKg(stats.mismatchKg);

      for (const itemName of STOCK_ITEMS) {
        if (!stats.itemBreakdown[itemName]) continue;
        stats.itemBreakdown[itemName].plannedKg = Number(
          Number(stockInByItem[itemName] || 0).toFixed(3),
        );
        stats.itemBreakdown[itemName].remainingKg = Number(
          Number(stockBalanceByItem[itemName] || 0).toFixed(3),
        );
        stats.itemBreakdown[itemName].scanExpectedKg = Number(
          Number(stats.itemBreakdown[itemName].scanExpectedKg || 0).toFixed(3),
        );
        stats.itemBreakdown[itemName].actualKg = Number(
          Number(stats.itemBreakdown[itemName].actualKg || 0).toFixed(3),
        );
        stats.itemBreakdown[itemName].mismatchKg = Number(
          Number(stats.itemBreakdown[itemName].mismatchKg || 0).toFixed(3),
        );
      }

      if (!groupsMap.has(distributorIdStr)) {
        const ward =
          normalizeWardNo(distributor.wardNo || distributor.ward) ||
          distributor.ward ||
          "—";
        const division = normalizeDivision(distributor.division) || "Unknown";

        groupsMap.set(distributorIdStr, {
          distributorId: distributorIdStr,
          distributorName:
            userNameMap.get(String(distributor.userId)) ||
            "অজানা ডিস্ট্রিবিউটর",
          division,
          ward,
          sessions: [],
          totals: {
            assignedUsers: 0,
            scannedUsers: 0,
            matchedUsers: 0,
            mismatchUsers: 0,
            pendingUsers: 0,
            noShowUsers: 0,
            plannedKg: 0,
            expectedKg: 0,
            actualKg: 0,
            shortfallKg: 0,
            criticalAlertsCount: 0,
            mismatchCount: 0,
          },
        });
      }

      const group = groupsMap.get(distributorIdStr);
      group.sessions.push({
        sessionId,
        dateKey: session.dateKey,
        sessionStatus: session.status,
        openedAt: session.openedAt || null,
        closedAt: session.closedAt || null,
        updatedAt: session.updatedAt,
        assignedUsers: stats.assignedUsers,
        permittedUsers: stats.permittedUsers,
        scannedUsers: stats.scannedUsers,
        matchedUsers: stats.matchedUsers,
        mismatchUsers: stats.mismatchUsers,
        pendingUsers: stats.pendingUsers,
        noShowUsers: stats.noShowUsers,
        plannedKg: Number(stats.plannedKg.toFixed(3)),
        expectedKg: Number(stats.expectedKg.toFixed(3)),
        actualKg: Number(stats.actualKg.toFixed(3)),
        shortfallKg: Number(stats.shortfallKg.toFixed(3)),
        mismatchKg: Number(stats.mismatchKg.toFixed(3)),
        mismatchCount: stats.mismatchCount,
        criticalAlertsCount: stats.criticalAlertsCount,
        itemBreakdown: stats.itemBreakdown,
        stockBalanceByItem,
        rows: stats.rows,
      });
      group.totals.assignedUsers += stats.assignedUsers;
      group.totals.scannedUsers += stats.scannedUsers;
      group.totals.matchedUsers += stats.matchedUsers;
      group.totals.mismatchUsers += stats.mismatchUsers;
      group.totals.pendingUsers += stats.pendingUsers;
      group.totals.noShowUsers += stats.noShowUsers;
      group.totals.plannedKg += stats.plannedKg;
      group.totals.expectedKg += stats.expectedKg;
      group.totals.actualKg += stats.actualKg;
      group.totals.shortfallKg += stats.shortfallKg;
      group.totals.criticalAlertsCount += stats.criticalAlertsCount;
      group.totals.mismatchCount += stats.mismatchCount;
    }

    const groups = Array.from(groupsMap.values()).map((group) => ({
      ...group,
      totals: {
        assignedUsers: group.totals.assignedUsers,
        scannedUsers: group.totals.scannedUsers,
        matchedUsers: group.totals.matchedUsers,
        mismatchUsers: group.totals.mismatchUsers,
        pendingUsers: group.totals.pendingUsers,
        noShowUsers: group.totals.noShowUsers,
        plannedKg: Number(group.totals.plannedKg.toFixed(3)),
        expectedKg: Number(group.totals.expectedKg.toFixed(3)),
        actualKg: Number(group.totals.actualKg.toFixed(3)),
        shortfallKg: Number(group.totals.shortfallKg.toFixed(3)),
        criticalAlertsCount: group.totals.criticalAlertsCount,
        mismatchCount: group.totals.mismatchCount,
      },
      sessions: group.sessions.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    }));

    const rows = groups.flatMap((group) =>
      group.sessions.map((s) => ({
        distributorId: group.distributorId,
        distributor: group.distributorName,
        division: group.division,
        ward: group.ward,
        sessionId: s.sessionId,
        dateKey: s.dateKey,
        sessionStatus: s.sessionStatus,
        expectedKg: s.expectedKg,
        actualKg: s.actualKg,
        shortfallKg: s.shortfallKg,
        assignedUsers: s.assignedUsers,
        scannedUsers: s.scannedUsers,
        matchedUsers: s.matchedUsers,
        mismatchUsers: s.mismatchUsers,
        pendingUsers: s.pendingUsers,
        noShowUsers: s.noShowUsers,
        criticalAlertsCount: s.criticalAlertsCount,
        plannedKg: s.plannedKg,
        mismatchCount: s.mismatchCount,
        status: s.mismatchCount > 0 ? "Mismatch" : "Matched",
        action: s.mismatchCount > 0 ? "Pause + Alert" : "Continue",
        itemBreakdown: s.itemBreakdown,
        stockBalanceByItem: s.stockBalanceByItem,
      })),
    );

    return res.json({
      success: true,
      data: {
        rows,
        groups,
        pagination: {
          page: safePage,
          limit,
          total: totalSessions,
          pages: totalPages,
        },
        view,
        filters: {
          distributorId: distributorId || "",
          division: divisionFilter || "",
          ward: wardFilter || "",
          sessionStatus,
          item: itemFilter || "",
          mismatchOnly,
        },
      },
    });
  } catch (error) {
    console.error("getAdminDistributionMonitoring error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function applyAdminAlertAction(req, res) {
  try {
    const alertId = String(req.params.id || "").trim();
    const actionType = String(req.body?.action || "").trim();
    const note = String(req.body?.note || "").trim();

    const allowed = [
      "acknowledge",
      "under_review",
      "pause_session",
      "stop_session",
      "request_audit",
    ];
    if (!allowed.includes(actionType)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported alert action",
        code: "VALIDATION_ERROR",
      });
    }

    const alert = await AuditLog.findById(alertId);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found",
        code: "NOT_FOUND",
      });
    }

    let sourceAlert = alert;
    if (
      alert.action === "ADMIN_ALERT_ACTION_APPLIED" &&
      alert.entityType === "AuditLog" &&
      alert.entityId
    ) {
      const parent = await AuditLog.findById(alert.entityId).lean();
      if (parent) {
        sourceAlert = parent;
      }
    }

    const sourceMeta = sourceAlert?.meta || {};
    const meta = alert.meta || {};
    const sessionId = String(
      sourceMeta.sessionId || meta.sessionId || req.body?.sessionId || "",
    ).trim();
    let distributorId = String(
      sourceMeta.distributorId ||
        meta.distributorId ||
        req.body?.distributorId ||
        "",
    ).trim();

    let session = null;
    if (sessionId) {
      session = await DistributionSession.findById(sessionId);
      if (!distributorId && session?.distributorId) {
        distributorId = String(session.distributorId);
      }
    }

    if (!session && distributorId) {
      session = await DistributionSession.findOne({
        distributorId,
        status: { $in: ["Open", "Paused", "Planned"] },
      })
        .sort({ updatedAt: -1 })
        .lean();
      if (session?._id) {
        session = await DistributionSession.findById(session._id);
      }
    }

    if (actionType === "pause_session") {
      if (!session) {
        return res.status(404).json({
          success: false,
          message: "No session found to pause",
          code: "NOT_FOUND",
        });
      }
      if (session.status === "Open") {
        session.status = "Paused";
        await session.save();
      }
    }

    if (actionType === "stop_session") {
      if (!session) {
        return res.status(404).json({
          success: false,
          message: "No session found to stop",
          code: "NOT_FOUND",
        });
      }
      if (session.status !== "Closed") {
        session.status = "Closed";
        session.closedAt = new Date();
        await session.save();
      }
    }

    if (actionType === "request_audit") {
      let distributor = null;
      if (distributorId) {
        distributor = await Distributor.findById(distributorId)
          .select("_id userId division wardNo ward")
          .lean();
      }
      if (!distributor && session?.distributorId) {
        distributor = await Distributor.findById(session.distributorId)
          .select("_id userId division wardNo ward")
          .lean();
      }

      if (!distributor?.userId) {
        return res.status(400).json({
          success: false,
          message: "Distributor mapping missing for audit request",
          code: "VALIDATION_ERROR",
        });
      }

      await AuditReportRequest.create({
        distributorUserId: distributor.userId,
        requestedByAdminId: req.user.userId,
        auditLogId: sourceAlert?._id || alert._id,
        note:
          note ||
          `Critical alert audit request (${normalizeDivision(distributor.division) || "Unknown"}/${normalizeWardNo(distributor.wardNo || distributor.ward) || "--"})`,
        status: "Requested",
      });
    }

    const distributorDoc = distributorId
      ? await Distributor.findById(distributorId)
          .select("_id userId division wardNo ward")
          .lean()
      : null;
    const resolvedDivision = normalizeDivision(
      sourceMeta.division || meta.division || distributorDoc?.division || "",
    );
    const resolvedWard =
      normalizeWardNo(
        sourceMeta.ward ||
          meta.ward ||
          distributorDoc?.wardNo ||
          distributorDoc?.ward,
      ) || "";
    const distributorUser = distributorDoc?.userId
      ? await User.findById(distributorDoc.userId).select("name").lean()
      : null;

    alert.meta = {
      ...meta,
      division: resolvedDivision || undefined,
      ward: resolvedWard || undefined,
      distributorId: distributorId || undefined,
      sessionId: session ? String(session._id) : sessionId || undefined,
      adminAction: {
        action: actionType,
        note,
        actorUserId: String(req.user.userId),
        actedAt: new Date().toISOString(),
      },
    };
    await alert.save();

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Central Admin",
      action: "ADMIN_ALERT_ACTION_APPLIED",
      entityType: "AuditLog",
      entityId: String(alert._id),
      severity: actionType === "stop_session" ? "Critical" : "Warning",
      meta: {
        actionType,
        sourceAction: sourceAlert?.action || alert.action,
        sessionId: session ? String(session._id) : undefined,
        distributorId: distributorId || undefined,
        division: resolvedDivision || undefined,
        ward: resolvedWard || undefined,
        distributorName: distributorUser?.name || undefined,
        actionable: false,
      },
    });

    return res.json({
      success: true,
      data: {
        alertId: String(alert._id),
        action: actionType,
        session: session
          ? {
              id: String(session._id),
              status: session.status,
              dateKey: session.dateKey,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("applyAdminAlertAction error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

async function getAdminConsumerReview(req, res) {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const requestedDivision = String(req.query.division || "").trim();
    const requestedWard = normalizeWardNo(req.query.ward || req.query.wardNo);
    const requestedStatus = String(req.query.status || "").trim();
    const requestedBlacklist = String(req.query.blacklistStatus || "").trim();
    const requestedCardStatus = String(req.query.cardStatus || "").trim();
    const requestedQrStatus = String(req.query.qrStatus || "").trim();
    const requestedFamilyFlag = String(req.query.familyFlag || "").trim();
    const requestedAuditNeeded = String(req.query.auditNeeded || "").trim();
    const requestedMismatchOnly = String(req.query.mismatchOnly || "").trim();
    const search = String(req.query.search || "").trim();

    if (requestedWard && !requestedDivision) {
      return res.status(400).json({
        success: false,
        message: "ওয়ার্ড ফিল্টার ব্যবহার করতে বিভাগ একসাথে দিতে হবে",
        code: "VALIDATION_ERROR",
      });
    }

    const consumerQuery = {};
    if (requestedDivision) {
      consumerQuery.division = normalizeDivision(requestedDivision);
    }
    if (requestedWard) {
      consumerQuery.ward = requestedWard;
    }
    if (requestedStatus) {
      consumerQuery.status = requestedStatus;
    }
    if (requestedBlacklist) {
      consumerQuery.blacklistStatus = requestedBlacklist;
    }

    const consumers = await Consumer.find(consumerQuery)
      .populate("familyId", "flaggedDuplicate")
      .populate("createdByDistributor", "userId")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const consumerIds = consumers.map((c) => c._id);
    const cards = await OMSCard.find({ consumerId: { $in: consumerIds } })
      .populate("qrCodeId", "status")
      .select("consumerId cardStatus qrCodeId")
      .lean();
    const cardByConsumerId = new Map(
      cards.map((card) => [String(card.consumerId), card]),
    );

    const tokens = await Token.find({ consumerId: { $in: consumerIds } })
      .select("_id consumerId")
      .lean();
    const tokenById = new Map(tokens.map((t) => [String(t._id), t]));
    const tokenIds = tokens.map((t) => t._id);

    const mismatchRecords = tokenIds.length
      ? await DistributionRecord.find({
          tokenId: { $in: tokenIds },
          mismatch: true,
        })
          .select("tokenId")
          .lean()
      : [];

    const mismatchByConsumerId = new Map();
    for (const record of mismatchRecords) {
      const token = tokenById.get(String(record.tokenId));
      if (!token?.consumerId) continue;
      const key = String(token.consumerId);
      mismatchByConsumerId.set(key, (mismatchByConsumerId.get(key) || 0) + 1);
    }

    const rows = consumers.map((consumer) => {
      const family = consumer.familyId || null;
      const distributor =
        consumer.createdByDistributor &&
        typeof consumer.createdByDistributor === "object"
          ? consumer.createdByDistributor
          : null;
      const card = cardByConsumerId.get(String(consumer._id));
      const qr =
        card?.qrCodeId && typeof card.qrCodeId === "object"
          ? card.qrCodeId
          : null;
      const mismatchCount = Number(
        mismatchByConsumerId.get(String(consumer._id)) || 0,
      );
      const auditNeeded =
        !!family?.flaggedDuplicate ||
        consumer.blacklistStatus === "Temp" ||
        consumer.blacklistStatus === "Permanent" ||
        mismatchCount > 0;

      return {
        id: String(consumer._id),
        consumerCode: consumer.consumerCode,
        name: consumer.name,
        division: consumer.division || "",
        ward: consumer.ward || "",
        nidLast4: consumer.nidLast4,
        status: consumer.status,
        blacklistStatus: consumer.blacklistStatus,
        familyFlag: !!family?.flaggedDuplicate,
        cardStatus: card?.cardStatus || "Inactive",
        qrStatus: qr?.status || "Invalid",
        mismatchCount,
        auditNeeded,
        distributorUserId: distributor?.userId
          ? String(distributor.userId)
          : null,
      };
    });

    const filteredRows = rows.filter((row) => {
      if (
        requestedDivision &&
        !isSameDivision(requestedDivision, row.division || "")
      ) {
        return false;
      }

      if (requestedWard && normalizeWardNo(row.ward || "") !== requestedWard) {
        return false;
      }

      if (requestedCardStatus && row.cardStatus !== requestedCardStatus) {
        return false;
      }

      if (requestedQrStatus && row.qrStatus !== requestedQrStatus) {
        return false;
      }

      if (requestedFamilyFlag === "true" && !row.familyFlag) return false;
      if (requestedFamilyFlag === "false" && row.familyFlag) return false;

      if (requestedAuditNeeded === "true" && !row.auditNeeded) return false;
      if (requestedAuditNeeded === "false" && row.auditNeeded) return false;

      if (
        ["1", "true", "yes"].includes(requestedMismatchOnly.toLowerCase()) &&
        row.mismatchCount < 1
      ) {
        return false;
      }

      if (search) {
        const needle = search.toLowerCase();
        const hit =
          row.consumerCode.toLowerCase().includes(needle) ||
          row.name.toLowerCase().includes(needle) ||
          String(row.nidLast4 || "")
            .toLowerCase()
            .includes(needle);
        if (!hit) return false;
      }

      return true;
    });

    res.json({ success: true, data: { rows: filteredRows } });
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

    const actorUserIds = Array.from(
      new Set(logs.map((log) => String(log.actorUserId || "")).filter(Boolean)),
    );
    const [actorUsers, actorDistributors] = await Promise.all([
      actorUserIds.length
        ? User.find({ _id: { $in: actorUserIds } })
            .select("_id name")
            .lean()
        : [],
      actorUserIds.length
        ? Distributor.find({ userId: { $in: actorUserIds } })
            .select("_id userId division wardNo ward")
            .lean()
        : [],
    ]);

    const actorUserMap = new Map(actorUsers.map((u) => [String(u._id), u]));
    const actorDistributorMap = new Map(
      actorDistributors.map((d) => [String(d.userId), d]),
    );

    const enrichedLogs = logs.map((log) => {
      const actorId = String(log.actorUserId || "");
      const actor = actorUserMap.get(actorId);
      const actorDistributor = actorDistributorMap.get(actorId);

      const division =
        normalizeDivision(
          log.meta?.division || actorDistributor?.division || "",
        ) || "";
      const ward =
        normalizeWardNo(
          log.meta?.ward || actorDistributor?.wardNo || actorDistributor?.ward,
        ) || "";

      return {
        ...log,
        actorName: actor?.name || "",
        division,
        ward,
        sessionId: String(log.meta?.sessionId || ""),
        sessionCode: String(log.meta?.sessionCode || ""),
        consumerCode: String(log.meta?.consumerCode || ""),
        consumerName: String(log.meta?.consumerName || ""),
        distributorId:
          String(log.meta?.distributorId || "") ||
          (actorDistributor?._id ? String(actorDistributor._id) : ""),
        distributorCode:
          String(log.meta?.distributorCode || "") ||
          (actorDistributor?._id
            ? `DST-${String(actorDistributor._id).slice(-6).toUpperCase()}`
            : ""),
        distributorName: String(log.meta?.distributorName || ""),
        tokenCode: String(log.meta?.tokenCode || ""),
        item: String(log.meta?.item || log.meta?.rationItem || ""),
        mismatchReason: String(
          log.meta?.mismatchReason || log.meta?.reason || "",
        ),
      };
    });

    return res.json({
      success: true,
      data: {
        logs: enrichedLogs,
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
  resendDistributorCredentials,
  getAdminCardsSummary,
  getAdminDistributionMonitoring,
  getAdminConsumerReview,
  getAdminAuditLogs,
  getAdminAuditDetail,
  forceCloseSession,
  applyAdminAlertAction,
};
