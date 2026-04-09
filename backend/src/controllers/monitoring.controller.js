const mongoose = require("mongoose");
const BlacklistEntry = require("../models/BlacklistEntry");
const OfflineQueue = require("../models/OfflineQueue");
const AuditLog = require("../models/AuditLog");
const Distributor = require("../models/Distributor");
const Consumer = require("../models/Consumer");
const User = require("../models/User");
const { writeAudit } = require("../services/audit.service");
const { normalizeDivision } = require("../utils/division.utils");
const { normalizeWardNo } = require("../utils/ward.utils");
const {
  scanAndIssueToken,
  completeDistribution,
} = require("./distribution.controller");

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
    wardNo: normalizeWardNo(user.wardNo || user.ward),
    division: normalizeDivision(user.division),
    district: user.district,
    upazila: user.upazila,
    unionName: user.unionName,
    ward: normalizeWardNo(user.ward || user.wardNo),
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
  // Scope is by distributorId — which is already bound to one (division, wardNo) pair
  // Division+ward filtering is enforced at the distributor lookup level
  return distributor ? { distributorId: distributor._id } : {};
}

function applyBlacklistStatus(blockType, active) {
  if (!active) return "None";
  return blockType === "Permanent" ? "Permanent" : "Temp";
}

function buildMockReq(user, body) {
  return {
    user,
    body,
    params: {},
    query: {},
  };
}

function runController(controller, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ statusCode: this.statusCode, payload });
      },
    };
    controller(req, res);
  });
}

async function syncTargetStatus(entry) {
  const status = applyBlacklistStatus(entry.blockType, entry.active);

  if (entry.targetType === "Consumer") {
    const ref = String(entry.targetRefId || "").trim();
    const query = mongoose.Types.ObjectId.isValid(ref)
      ? { _id: ref }
      : { consumerCode: ref };

    await Consumer.findOneAndUpdate(query, {
      $set: { blacklistStatus: status },
    });
    return;
  }

  if (entry.targetType === "Distributor") {
    const ref = String(entry.targetRefId || "").trim();

    let distributor = null;
    if (mongoose.Types.ObjectId.isValid(ref)) {
      distributor = await Distributor.findById(ref);
      if (!distributor) {
        distributor = await Distributor.findOne({ userId: ref });
      }
    } else {
      distributor = await Distributor.findOne({ userId: ref });
      if (!distributor) {
        const user = await User.findOne({
          $or: [{ email: ref }, { phone: ref }],
        })
          .select("_id")
          .lean();
        if (user?._id) {
          distributor = await Distributor.findOne({ userId: user._id });
        }
      }
    }

    if (!distributor) return;

    const nextAuthority = entry.active ? "Suspended" : "Active";

    await Distributor.findByIdAndUpdate(distributor._id, {
      $set: { authorityStatus: nextAuthority },
    });

    await User.findByIdAndUpdate(distributor.userId, {
      $set: {
        authorityStatus: nextAuthority,
        status: nextAuthority === "Suspended" ? "Suspended" : "Active",
      },
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
      return res.status(400).json({
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

    res.status(201).json({
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

    res.status(201).json({
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

    const payload = item.payload || {};
    const action = String(payload.action || "").toUpperCase();

    let result = null;

    if (action === "SCAN") {
      const qrPayload =
        payload.qrPayload || payload.qrToken || payload.consumerCode;
      result = await runController(
        scanAndIssueToken,
        buildMockReq(req.user, { qrPayload }),
      );
    } else if (action === "COMPLETE") {
      result = await runController(
        completeDistribution,
        buildMockReq(req.user, {
          tokenCode: payload.tokenCode,
          actualKg: payload.actualKg,
        }),
      );
    } else {
      result = {
        statusCode: 400,
        payload: { message: "Unsupported offline action" },
      };
    }

    if (result.statusCode >= 400) {
      item.status = "Failed";
      item.errorMessage = result.payload?.message || "Sync failed";
      await item.save();

      await writeAudit({
        actorUserId: req.user.userId,
        actorType: req.user.userType === "Admin" ? "Admin" : "Distributor",
        action: "OFFLINE_QUEUE_SYNC_FAILED",
        entityType: "OfflineQueue",
        entityId: String(item._id),
        severity: "Warning",
        meta: { error: item.errorMessage },
      });

      return res.status(409).json({
        success: false,
        message: item.errorMessage,
        data: { item },
      });
    }

    item.status = "Synced";
    item.errorMessage = undefined;
    item.syncedAt = new Date();
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
    const items = await OfflineQueue.find(query).lean();

    let syncedCount = 0;
    let failedCount = 0;

    for (const item of items) {
      const payload = item.payload || {};
      const action = String(payload.action || "").toUpperCase();

      let result = null;
      if (action === "SCAN") {
        const qrPayload =
          payload.qrPayload || payload.qrToken || payload.consumerCode;
        result = await runController(
          scanAndIssueToken,
          buildMockReq(req.user, { qrPayload }),
        );
      } else if (action === "COMPLETE") {
        result = await runController(
          completeDistribution,
          buildMockReq(req.user, {
            tokenCode: payload.tokenCode,
            actualKg: payload.actualKg,
          }),
        );
      } else {
        result = {
          statusCode: 400,
          payload: { message: "Unsupported offline action" },
        };
      }

      if (result.statusCode >= 400) {
        failedCount += 1;
        await OfflineQueue.findByIdAndUpdate(item._id, {
          $set: {
            status: "Failed",
            errorMessage: result.payload?.message || "Sync failed",
          },
        });
        continue;
      }

      syncedCount += 1;
      await OfflineQueue.findByIdAndUpdate(item._id, {
        $set: {
          status: "Synced",
          errorMessage: undefined,
          syncedAt: new Date(),
        },
      });
    }

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: req.user.userType === "Admin" ? "Admin" : "Distributor",
      action: "OFFLINE_QUEUE_SYNCED_ALL",
      entityType: "OfflineQueue",
      severity: failedCount > 0 ? "Warning" : "Info",
      meta: { syncedCount, failedCount },
    });

    res.json({
      success: true,
      message: "Offline sync completed",
      data: { syncedCount, failedCount },
    });
  } catch (error) {
    console.error("syncAllOfflineQueue error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function resolveOfflineQueueItem(req, res) {
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

    const { action } = req.body || {};
    if (!action || !["discard", "markSynced"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "action must be discard or markSynced",
      });
    }

    item.status = "Synced";
    item.resolvedAction = action;
    item.syncedAt = new Date();
    await item.save();

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: req.user.userType === "Admin" ? "Admin" : "Distributor",
      action: "OFFLINE_QUEUE_RESOLVED",
      entityType: "OfflineQueue",
      entityId: String(item._id),
      severity: "Info",
      meta: { action },
    });

    res.json({ success: true, message: "Queue item resolved", data: { item } });
  } catch (error) {
    console.error("resolveOfflineQueueItem error:", error);
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
  resolveOfflineQueueItem,
};
