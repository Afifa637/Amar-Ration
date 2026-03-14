const bcrypt = require("bcryptjs");
const SystemSetting = require("../models/SystemSetting");
const Distributor = require("../models/Distributor");
const User = require("../models/User");
const { writeAudit } = require("../services/audit.service");

const DEFAULT_DISTRIBUTOR_SETTINGS = {
  policy: {
    authorityMonths: 6,
    adminApprovalRequired: true,
  },
  distribution: {
    weightThresholdKg: 0.05,
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

function sanitizeIncomingSettings(payload) {
  const merged = mergeWithDefaults(payload);

  merged.distribution.weightThresholdKg = Number(
    merged.distribution.weightThresholdKg,
  );
  if (
    !Number.isFinite(merged.distribution.weightThresholdKg) ||
    merged.distribution.weightThresholdKg < 0
  ) {
    merged.distribution.weightThresholdKg =
      DEFAULT_DISTRIBUTOR_SETTINGS.distribution.weightThresholdKg;
  }

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

async function getMySettings(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);
    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    if (req.user.userType === "Admin") {
      const adminSettings = await SystemSetting.find({
        key: { $regex: /^system:/ },
      }).lean();
      return res.json({
        success: true,
        data: { isAdmin: true, settings: adminSettings },
      });
    }

    const key = getDistributorSettingsKey(req.user.userId);
    const setting = await SystemSetting.findOne({ key }).lean();
    const user = await User.findById(req.user.userId)
      .select(
        "name email phone wardNo officeAddress division district upazila unionName ward",
      )
      .lean();

    return res.json({
      success: true,
      data: {
        isAdmin: false,
        settings: mergeWithDefaults(setting?.value),
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
    const distributor = await ensureDistributorProfile(req.user);
    if (!distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const key = getDistributorSettingsKey(req.user.userId);
    const current = await SystemSetting.findOne({ key }).lean();
    const nextValue = sanitizeIncomingSettings({
      ...(current?.value || {}),
      ...(req.body?.settings || {}),
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
      data: { settings: updated.value },
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
    const allowedFields = [
      "name",
      "phone",
      "wardNo",
      "officeAddress",
      "division",
      "district",
      "upazila",
      "unionName",
      "ward",
    ];

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
      return res
        .status(400)
        .json({
          success: false,
          message: "currentPassword and newPassword are required",
        });
    }

    if (String(newPassword).length < 6) {
      return res
        .status(400)
        .json({
          success: false,
          message: "newPassword must be at least 6 characters",
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
    await user.save();

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: req.user.userType === "Admin" ? "Admin" : "Distributor",
      action: "PASSWORD_CHANGED",
      entityType: "User",
      entityId: String(req.user.userId),
      severity: "Warning",
    });

    res.json({ success: true, message: "Password changed successfully" });
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
