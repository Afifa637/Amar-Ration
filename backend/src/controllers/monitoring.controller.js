const BlacklistEntry = require("../models/BlacklistEntry");
const OfflineQueue = require("../models/OfflineQueue");
const AuditLog = require("../models/AuditLog");
const Distributor = require("../models/Distributor");
const Consumer = require("../models/Consumer");
const User = require("../models/User");
const { writeAudit } = require("../services/audit.service");

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

function parsePageLimit(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit };
}

function getScopeFilter(distributor) {
  return distributor ? { distributorId: distributor._id } : {};
}

function applyBlacklistStatus(blockType, active) {
  if (!active) return "None";
  return blockType === "Permanent" ? "Permanent" : "Temp";
}

async function syncTargetStatus(entry) {
  const status = applyBlacklistStatus(entry.blockType, entry.active);

  if (entry.targetType === "Consumer") {
    await Consumer.findByIdAndUpdate(entry.targetRefId, {
      blacklistStatus: status,
    });
    return;
  }

  if (entry.targetType === "Distributor") {
    await Distributor.findByIdAndUpdate(entry.targetRefId, {
      authorityStatus: entry.active ? "Suspended" : "Active",
    });
  }
}

async function getMonitoringSummary(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);
    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const scope = getScopeFilter(distributor);

    const blacklistPromise = BlacklistEntry.find({ ...scope, active: true })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const offlinePromise = OfflineQueue.find({ ...scope, status: "Pending" })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const criticalQuery =
      req.user.userType === "Admin"
        ? { severity: "Critical" }
        : { severity: "Critical", actorUserId: req.user.userId };

    const criticalPromise = AuditLog.find(criticalQuery)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const [blacklist, offline, critical] = await Promise.all([
      blacklistPromise,
      offlinePromise,
      criticalPromise,
    ]);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const alertQuery = {
      ...(req.user.userType === "Admin"
        ? {}
        : { actorUserId: req.user.userId }),
      createdAt: { $gte: startOfToday },
      severity: { $in: ["Warning", "Critical"] },
    };

    const todayAlerts = await AuditLog.countDocuments(alertQuery);

    res.json({
      success: true,
      data: {
        systemStatus: "Normal",
        todayAlerts,
        criticalCount: critical.length,
        offlinePending: offline.length,
        blacklist,
        offline,
        critical,
      },
    });
  } catch (error) {
    console.error("getMonitoringSummary error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function listBlacklist(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);
    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const { search, active } = req.query;
    const { page, limit } = parsePageLimit(req.query);
    const query = { ...getScopeFilter(distributor) };

    if (active === "true") query.active = true;
    if (active === "false") query.active = false;

    if (search) {
      query.$or = [
        { targetRefId: { $regex: search, $options: "i" } },
        { reason: { $regex: search, $options: "i" } },
      ];
    }

    const [total, entries] = await Promise.all([
      BlacklistEntry.countDocuments(query),
      BlacklistEntry.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        entries,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
    });
  } catch (error) {
    console.error("listBlacklist error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function createBlacklistEntry(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);
    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const {
      targetType,
      targetRefId,
      blockType,
      reason,
      active = true,
      expiresAt,
    } = req.body;

    if (!targetType || !targetRefId || !blockType || !reason) {
      return res
        .status(400)
        .json({
          success: false,
          message: "targetType, targetRefId, blockType and reason are required",
        });
    }

    const entry = await BlacklistEntry.create({
      distributorId: distributor?._id,
      createdByUserId: req.user.userId,
      targetType,
      targetRefId,
      blockType,
      reason,
      active,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    await syncTargetStatus(entry);

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: req.user.userType === "Admin" ? "Admin" : "Distributor",
      action: "BLACKLIST_CREATED",
      entityType: "BlacklistEntry",
      entityId: String(entry._id),
      severity: active ? "Warning" : "Info",
      meta: {
        targetType,
        targetRefId,
        blockType,
      },
    });

    res
      .status(201)
      .json({
        success: true,
        message: "Blacklist entry created",
        data: { entry },
      });
  } catch (error) {
    console.error("createBlacklistEntry error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function updateBlacklistEntry(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);
    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const query = { _id: req.params.id, ...getScopeFilter(distributor) };
    const entry = await BlacklistEntry.findOne(query);

    if (!entry) {
      return res
        .status(404)
        .json({ success: false, message: "Blacklist entry not found" });
    }

    const { reason, blockType, active, expiresAt } = req.body;
    if (reason !== undefined) entry.reason = reason;
    if (blockType !== undefined) entry.blockType = blockType;
    if (active !== undefined) entry.active = Boolean(active);
    if (expiresAt !== undefined)
      entry.expiresAt = expiresAt ? new Date(expiresAt) : undefined;

    await entry.save();
    await syncTargetStatus(entry);

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: req.user.userType === "Admin" ? "Admin" : "Distributor",
      action: "BLACKLIST_UPDATED",
      entityType: "BlacklistEntry",
      entityId: String(entry._id),
      severity: entry.active ? "Warning" : "Info",
      meta: {
        blockType: entry.blockType,
        active: entry.active,
      },
    });

    res.json({
      success: true,
      message: "Blacklist entry updated",
      data: { entry },
    });
  } catch (error) {
    console.error("updateBlacklistEntry error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function deactivateBlacklistEntry(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);
    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const query = { _id: req.params.id, ...getScopeFilter(distributor) };
    const entry = await BlacklistEntry.findOne(query);

    if (!entry) {
      return res
        .status(404)
        .json({ success: false, message: "Blacklist entry not found" });
    }

    entry.active = false;
    await entry.save();
    await syncTargetStatus(entry);

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: req.user.userType === "Admin" ? "Admin" : "Distributor",
      action: "BLACKLIST_DEACTIVATED",
      entityType: "BlacklistEntry",
      entityId: String(entry._id),
      severity: "Info",
    });

    res.json({
      success: true,
      message: "Blacklist deactivated",
      data: { entry },
    });
  } catch (error) {
    console.error("deactivateBlacklistEntry error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function listOfflineQueue(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);
    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const { status } = req.query;
    const { page, limit } = parsePageLimit(req.query);
    const query = { ...getScopeFilter(distributor) };
    if (status) query.status = status;

    const [total, items] = await Promise.all([
      OfflineQueue.countDocuments(query),
      OfflineQueue.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
    });
  } catch (error) {
    console.error("listOfflineQueue error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function createOfflineQueueEntry(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);
    if (!distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const payload = req.body?.payload;
    if (!payload || typeof payload !== "object") {
      return res
        .status(400)
        .json({ success: false, message: "payload object is required" });
    }

    const item = await OfflineQueue.create({
      distributorId: distributor._id,
      payload,
      status: "Pending",
    });

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Distributor",
      action: "OFFLINE_QUEUE_CREATED",
      entityType: "OfflineQueue",
      entityId: String(item._id),
      severity: "Info",
    });

    res
      .status(201)
      .json({
        success: true,
        message: "Offline queue entry created",
        data: { item },
      });
  } catch (error) {
    console.error("createOfflineQueueEntry error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function syncOfflineQueueItem(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);
    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const query = { _id: req.params.id, ...getScopeFilter(distributor) };
    const item = await OfflineQueue.findOne(query);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Offline queue item not found" });
    }

    item.status = "Synced";
    await item.save();

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: req.user.userType === "Admin" ? "Admin" : "Distributor",
      action: "OFFLINE_QUEUE_SYNCED",
      entityType: "OfflineQueue",
      entityId: String(item._id),
      severity: "Info",
    });

    res.json({ success: true, message: "Queue item synced", data: { item } });
  } catch (error) {
    console.error("syncOfflineQueueItem error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function syncAllOfflineQueue(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);
    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const query = { ...getScopeFilter(distributor), status: "Pending" };
    const result = await OfflineQueue.updateMany(query, {
      $set: { status: "Synced" },
    });

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: req.user.userType === "Admin" ? "Admin" : "Distributor",
      action: "OFFLINE_QUEUE_SYNCED_ALL",
      entityType: "OfflineQueue",
      severity: "Info",
      meta: { modifiedCount: result.modifiedCount },
    });

    res.json({
      success: true,
      message: "All pending items synced",
      data: { syncedCount: result.modifiedCount },
    });
  } catch (error) {
    console.error("syncAllOfflineQueue error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = {
  getMonitoringSummary,
  listBlacklist,
  createBlacklistEntry,
  updateBlacklistEntry,
  deactivateBlacklistEntry,
  listOfflineQueue,
  createOfflineQueueEntry,
  syncOfflineQueueItem,
  syncAllOfflineQueue,
};
