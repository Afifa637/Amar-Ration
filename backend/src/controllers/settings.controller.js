const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const SystemSetting = require("../models/SystemSetting");
const Distributor = require("../models/Distributor");
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const { writeAudit } = require("../services/audit.service");
const {
  sendDistributorPasswordChangeAlertEmail,
} = require("../services/email.service");
const GLOBAL_SETTINGS_KEY = "distributor:global:settings";

const DEFAULT_DISTRIBUTOR_SETTINGS = {
  policy: {
    authorityMonths: 6,
    adminApprovalRequired: true,
  },
  distribution: {
    weightThresholdKg: 1,
    weightThresholdPercent: 0.05,
    autoPauseOnMismatch: true,
    tokenPerConsumerPerDay: 1,
  },
  qr: {
    expiryCycleDays: 30,
    autoRotation: true,
    revokeBehavior: "StrictReject",
  },
  allocation: {
    A: 5,
    B: 4,
    C: 3,
  },
  fraud: {
    autoBlacklistMismatchCount: 3,
    temporaryBlockDays: 7,
  },
  offline: {
    enabled: true,
    conflictPolicy: "ServerWins",
  },
  notifications: {
    sms: true,
    app: true,
  },
  audit: {
    retentionYears: 5,
    immutable: true,
  },
};

function generateToken(userId, userType, tokenVersion) {
  const jti = crypto.randomBytes(16).toString("hex");
  return jwt.sign(
    { userId, userType, tokenVersion, jti },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    },
  );
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

function mergeWithDefaults(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...DEFAULT_DISTRIBUTOR_SETTINGS,
    ...source,
    policy: {
      ...DEFAULT_DISTRIBUTOR_SETTINGS.policy,
      ...(source.policy || {}),
    },
    distribution: {
      ...DEFAULT_DISTRIBUTOR_SETTINGS.distribution,
      ...(source.distribution || {}),
    },
    qr: { ...DEFAULT_DISTRIBUTOR_SETTINGS.qr, ...(source.qr || {}) },
    allocation: {
      ...DEFAULT_DISTRIBUTOR_SETTINGS.allocation,
      ...(source.allocation || {}),
    },
    fraud: { ...DEFAULT_DISTRIBUTOR_SETTINGS.fraud, ...(source.fraud || {}) },
    offline: {
      ...DEFAULT_DISTRIBUTOR_SETTINGS.offline,
      ...(source.offline || {}),
    },
    notifications: {
      ...DEFAULT_DISTRIBUTOR_SETTINGS.notifications,
      ...(source.notifications || {}),
    },
    audit: { ...DEFAULT_DISTRIBUTOR_SETTINGS.audit, ...(source.audit || {}) },
  };
}

async function ensureDistributorProfile(reqUser) {
  if (reqUser.userType === "Admin") return null;

  let distributor = await Distributor.findOne({ userId: reqUser.userId });
  if (distributor) return distributor;

  const user = await User.findById(reqUser.userId).lean();
  if (
    !user ||
    (user.userType !== "Distributor" && user.userType !== "FieldUser")
  ) {
    return null;
  }

  distributor = await Distributor.create({
    userId: user._id,
    wardNo: user.wardNo,
    division: user.division,
    district: user.district,
    upazila: user.upazila,
    unionName: user.unionName,
    ward: user.ward,
    authorityStatus: user.authorityStatus || "Active",
    authorityFrom: user.authorityFrom || new Date(),
    authorityTo: user.authorityTo,
  });

  return distributor;
}

function getDistributorSettingsKey(userId) {
  return `distributor:${String(userId)}:settings`;
}

async function getGlobalSettings() {
  const setting = await SystemSetting.findOne({
    key: GLOBAL_SETTINGS_KEY,
  }).lean();
  if (!setting) {
    const created = await SystemSetting.create({
      key: GLOBAL_SETTINGS_KEY,
      value: DEFAULT_DISTRIBUTOR_SETTINGS,
    });
    return mergeWithDefaults(created.value);
  }
  return mergeWithDefaults(setting.value);
}

function sanitizeIncomingSettings(payload) {
  const merged = mergeWithDefaults(payload);

  merged.distribution.weightThresholdKg = Number(
    merged.distribution.weightThresholdKg,
  );
  if (!Number.isFinite(merged.distribution.weightThresholdKg)) {
    merged.distribution.weightThresholdKg =
      DEFAULT_DISTRIBUTOR_SETTINGS.distribution.weightThresholdKg;
  }
  merged.distribution.weightThresholdKg = Math.max(
    1,
    Number(merged.distribution.weightThresholdKg) || 1,
  );

  merged.distribution.weightThresholdPercent = Number(
    merged.distribution.weightThresholdPercent,
  );
  if (!Number.isFinite(merged.distribution.weightThresholdPercent)) {
    merged.distribution.weightThresholdPercent =
      DEFAULT_DISTRIBUTOR_SETTINGS.distribution.weightThresholdPercent;
  }
  merged.distribution.weightThresholdPercent = Math.max(
    0.01,
    Number(merged.distribution.weightThresholdPercent) || 0.05,
  );

  merged.distribution.tokenPerConsumerPerDay = Math.max(
    1,
    Number(merged.distribution.tokenPerConsumerPerDay) || 1,
  );
  merged.qr.expiryCycleDays = Math.max(
    1,
    Number(merged.qr.expiryCycleDays) || 30,
  );
  merged.policy.authorityMonths = Math.max(
    1,
    Number(merged.policy.authorityMonths) || 6,
  );
  merged.fraud.autoBlacklistMismatchCount = Math.max(
    1,
    Number(merged.fraud.autoBlacklistMismatchCount) || 3,
  );
  merged.fraud.temporaryBlockDays = Math.max(
    1,
    Number(merged.fraud.temporaryBlockDays) || 7,
  );
  merged.audit.retentionYears = Math.max(
    1,
    Number(merged.audit.retentionYears) || 5,
  );

  merged.allocation.A = Math.max(0, Number(merged.allocation.A) || 0);
  merged.allocation.B = Math.max(0, Number(merged.allocation.B) || 0);
  merged.allocation.C = Math.max(0, Number(merged.allocation.C) || 0);

  return merged;
}

function mergeDistributorWithGlobal(distributorValue, globalValue) {
  const scoped = mergeWithDefaults(distributorValue);
  const global = mergeWithDefaults(globalValue);

  return {
    ...scoped,
    policy: { ...global.policy },
    fraud: { ...global.fraud },
    distribution: {
      ...scoped.distribution,
      weightThresholdKg: global.distribution.weightThresholdKg,
      weightThresholdPercent: global.distribution.weightThresholdPercent,
      tokenPerConsumerPerDay: global.distribution.tokenPerConsumerPerDay,
      autoPauseOnMismatch: global.distribution.autoPauseOnMismatch,
    },
    allocation: { ...global.allocation },
    qr: { ...global.qr },
    audit: { ...global.audit },
  };
}

function pickDistributorEditableSettings(incoming, currentMerged) {
  const next = mergeWithDefaults(currentMerged);

  if (incoming?.offline) {
    next.offline.enabled = incoming.offline.enabled !== false;
    if (typeof incoming.offline.conflictPolicy === "string") {
      next.offline.conflictPolicy = incoming.offline.conflictPolicy;
    }
  }

  if (incoming?.notifications) {
    next.notifications.sms = incoming.notifications.sms !== false;
    next.notifications.app = incoming.notifications.app !== false;
  }

  return next;
}

async function getMySettings(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);
    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    if (req.user.userType === "Admin") {
      const global = await getGlobalSettings();
      return res.json({
        success: true,
        data: { isAdmin: true, settings: global },
      });
    }

    const key = getDistributorSettingsKey(req.user.userId);
    const [setting, global] = await Promise.all([
      SystemSetting.findOne({ key }).lean(),
      getGlobalSettings(),
    ]);
    const user = await User.findById(req.user.userId)
      .select(
        "name email phone wardNo officeAddress division district upazila unionName ward",
      )
      .lean();

    return res.json({
      success: true,
      data: {
        isAdmin: false,
        settings: mergeDistributorWithGlobal(setting?.value, global),
        profile: user,
      },
    });
  } catch (error) {
    console.error("getMySettings error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function updateMySettings(req, res) {
  try {
    const incoming =
      req.body && typeof req.body === "object"
        ? req.body.settings || req.body
        : {};

    if (req.user.userType === "Admin") {
      const global = sanitizeIncomingSettings(incoming);
      const updated = await SystemSetting.findOneAndUpdate(
        { key: GLOBAL_SETTINGS_KEY },
        { $set: { value: global } },
        { new: true, upsert: true },
      ).lean();

      await writeAudit({
        actorUserId: req.user.userId,
        actorType: "Central Admin",
        action: "GLOBAL_SETTINGS_UPDATED",
        entityType: "SystemSetting",
        entityId: String(updated._id),
        severity: "Info",
      });

      return res.json({
        success: true,
        message: "Global settings updated",
        data: { settings: mergeWithDefaults(updated.value) },
      });
    }

    const distributor = await ensureDistributorProfile(req.user);
    if (!distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const key = getDistributorSettingsKey(req.user.userId);
    const [current, global] = await Promise.all([
      SystemSetting.findOne({ key }).lean(),
      getGlobalSettings(),
    ]);

    const mergedCurrent = mergeDistributorWithGlobal(current?.value, global);
    const picked = pickDistributorEditableSettings(incoming, mergedCurrent);
    const nextValue = sanitizeIncomingSettings({
      ...(current?.value || {}),
      ...picked,
    });

    const updated = await SystemSetting.findOneAndUpdate(
      { key },
      { $set: { value: nextValue } },
      { new: true, upsert: true },
    ).lean();

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Distributor",
      action: "SETTINGS_UPDATED",
      entityType: "SystemSetting",
      entityId: String(updated._id),
      severity: "Info",
    });

    res.json({
      success: true,
      message: "Settings updated",
      data: { settings: mergeDistributorWithGlobal(updated.value, global) },
    });
  } catch (error) {
    console.error("updateMySettings error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function resetMySettings(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);
    if (!distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const key = getDistributorSettingsKey(req.user.userId);
    const updated = await SystemSetting.findOneAndUpdate(
      { key },
      { $set: { value: DEFAULT_DISTRIBUTOR_SETTINGS } },
      { new: true, upsert: true },
    ).lean();

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Distributor",
      action: "SETTINGS_RESET",
      entityType: "SystemSetting",
      entityId: String(updated._id),
      severity: "Warning",
    });

    res.json({
      success: true,
      message: "Settings reset to default",
      data: { settings: updated.value },
    });
  } catch (error) {
    console.error("resetMySettings error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function updateMyProfile(req, res) {
  try {
    const allowedFields =
      req.user.userType === "Admin" ? ["name", "phone"] : ["name", "phone"];

    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updates },
      { new: true },
    )
      .select(
        "_id userType name email phone wardNo officeAddress division district upazila unionName ward",
      )
      .lean();

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (req.user.userType === "Admin") {
      await Distributor.findOneAndUpdate(
        { userId: req.user.userId },
        {
          $set: {
            division: user.division,
            district: user.district,
            upazila: user.upazila,
            unionName: user.unionName,
            ward: user.ward,
          },
        },
        { new: true },
      );
    }

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: req.user.userType === "Admin" ? "Admin" : "Distributor",
      action: "PROFILE_UPDATED",
      entityType: "User",
      entityId: String(req.user.userId),
      severity: "Info",
    });

    res.json({ success: true, message: "Profile updated", data: { user } });
  } catch (error) {
    console.error("updateMyProfile error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function changeMyPassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "currentPassword and newPassword are required",
      });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({
        success: false,
        message: "newPassword must be at least 8 characters",
      });
    }

    if (String(currentPassword) === String(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return res
        .status(401)
        .json({ success: false, message: "Current password is incorrect" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordChangedAt = new Date();
    user.mustChangePassword = false;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    await RefreshToken.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );

    const token = generateToken(user._id, user.userType, user.tokenVersion);

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

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: req.user.userType === "Admin" ? "Admin" : "Distributor",
      action: "PASSWORD_CHANGED",
      entityType: "User",
      entityId: String(req.user.userId),
      severity: "Warning",
    });

    res.json({
      success: true,
      message: "Password changed successfully",
      data: { token },
    });
  } catch (error) {
    console.error("changeMyPassword error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = {
  getMySettings,
  updateMySettings,
  resetMySettings,
  updateMyProfile,
  changeMyPassword,
  DEFAULT_DISTRIBUTOR_SETTINGS,
};
