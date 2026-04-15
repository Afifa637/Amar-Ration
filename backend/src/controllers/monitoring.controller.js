const mongoose = require("mongoose");
const BlacklistEntry = require("../models/BlacklistEntry");
const OfflineQueue = require("../models/OfflineQueue");
const AuditLog = require("../models/AuditLog");
const Distributor = require("../models/Distributor");
const Consumer = require("../models/Consumer");
const User = require("../models/User");
const Token = require("../models/Token");
const DistributionSession = require("../models/DistributionSession");
const { normalizeStockItem } = require("../utils/stock-items.utils");
const { writeAudit } = require("../services/audit.service");
const { makeSessionCode } = require("../services/sessionCode.service");
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

function normalizeOfflinePayload(payload) {
  const action = String(payload?.action || "").toUpperCase();

  if (action === "SCAN") {
    const qrPayload =
      payload?.qrPayload || payload?.qrToken || payload?.consumerCode;
    if (!qrPayload) {
      return {
        valid: false,
        message: "SCAN action requires qrPayload/qrToken/consumerCode",
      };
    }
    return {
      valid: true,
      value: {
        action: "SCAN",
        qrPayload: String(qrPayload),
      },
    };
  }

  if (action === "COMPLETE") {
    const tokenCode = String(payload?.tokenCode || "").trim();
    const actualKg = Number(payload?.actualKg);
    if (!tokenCode || !Number.isFinite(actualKg) || actualKg <= 0) {
      return {
        valid: false,
        message: "COMPLETE action requires tokenCode and valid actualKg",
      };
    }
    return {
      valid: true,
      value: {
        action: "COMPLETE",
        tokenCode,
        actualKg,
      },
    };
  }

  return {
    valid: false,
    message: "Unsupported offline action",
  };
}

async function enrichBlacklistEntries(entries = []) {
  const creatorIds = Array.from(
    new Set(
      entries.map((e) => String(e.createdByUserId || "")).filter(Boolean),
    ),
  );
  const owners = Array.from(
    new Set(entries.map((e) => String(e.distributorId || "")).filter(Boolean)),
  );

  const consumerRefIds = entries
    .filter((e) => e.targetType === "Consumer")
    .map((e) => String(e.targetRefId || "").trim())
    .filter(Boolean);
  const distributorRefIds = entries
    .filter((e) => e.targetType === "Distributor")
    .map((e) => String(e.targetRefId || "").trim())
    .filter(Boolean);

  const [creators, ownerDistributors, consumers, allDistributors] =
    await Promise.all([
      creatorIds.length
        ? User.find({ _id: { $in: creatorIds } })
            .select("_id name userType")
            .lean()
        : [],
      owners.length
        ? Distributor.find({ _id: { $in: owners } })
            .select("_id userId division wardNo ward")
            .populate("userId", "name")
            .lean()
        : [],
      consumerRefIds.length
        ? Consumer.find({
            $or: [
              {
                _id: {
                  $in: consumerRefIds.filter((id) =>
                    mongoose.Types.ObjectId.isValid(id),
                  ),
                },
              },
              { consumerCode: { $in: consumerRefIds } },
            ],
          })
            .select("_id consumerCode name division ward")
            .lean()
        : [],
      distributorRefIds.length
        ? Distributor.find({
            $or: [
              {
                _id: {
                  $in: distributorRefIds.filter((id) =>
                    mongoose.Types.ObjectId.isValid(id),
                  ),
                },
              },
              {
                userId: {
                  $in: distributorRefIds.filter((id) =>
                    mongoose.Types.ObjectId.isValid(id),
                  ),
                },
              },
            ],
          })
            .select("_id userId division wardNo ward")
            .populate("userId", "name")
            .lean()
        : [],
    ]);

  const creatorMap = new Map(creators.map((u) => [String(u._id), u]));
  const ownerMap = new Map(ownerDistributors.map((d) => [String(d._id), d]));

  const consumerMap = new Map();
  for (const c of consumers) {
    consumerMap.set(String(c._id), c);
    consumerMap.set(String(c.consumerCode || "").trim(), c);
  }

  const distributorMap = new Map();
  for (const d of allDistributors) {
    distributorMap.set(String(d._id), d);
    distributorMap.set(String(d.userId || ""), d);
  }

  return entries.map((entry) => {
    const creator = creatorMap.get(String(entry.createdByUserId || ""));
    const owner = ownerMap.get(String(entry.distributorId || ""));
    const consumer =
      entry.targetType === "Consumer"
        ? consumerMap.get(String(entry.targetRefId || "").trim())
        : null;
    const targetDistributor =
      entry.targetType === "Distributor"
        ? distributorMap.get(String(entry.targetRefId || "").trim())
        : null;
    const targetDistributorUser =
      targetDistributor?.userId && typeof targetDistributor.userId === "object"
        ? targetDistributor.userId
        : null;
    const ownerUser =
      owner?.userId && typeof owner.userId === "object" ? owner.userId : null;

    const targetName =
      entry.targetType === "Consumer"
        ? consumer?.name || ""
        : targetDistributorUser?.name || "";
    const targetCode =
      entry.targetType === "Consumer"
        ? consumer?.consumerCode || String(entry.targetRefId || "")
        : targetDistributor?._id
          ? `DST-${String(targetDistributor._id).slice(-6).toUpperCase()}`
          : String(entry.targetRefId || "");

    return {
      ...entry,
      targetName,
      targetCode,
      division:
        consumer?.division ||
        targetDistributor?.division ||
        owner?.division ||
        "",
      ward:
        consumer?.ward ||
        targetDistributor?.wardNo ||
        targetDistributor?.ward ||
        owner?.wardNo ||
        owner?.ward ||
        "",
      ownerDistributorName: ownerUser?.name || "",
      ownerDistributorCode: owner?._id
        ? `DST-${String(owner._id).slice(-6).toUpperCase()}`
        : "",
      createdByName: creator?.name || "",
      createdByType: creator?.userType || "",
      reasonText: `${entry.reason}${entry.expiresAt ? ` (expires ${new Date(entry.expiresAt).toLocaleDateString("en-GB")})` : ""}`,
    };
  });
}

async function enrichOfflineQueueItems(items = []) {
  const distributorIds = Array.from(
    new Set(items.map((x) => String(x.distributorId || "")).filter(Boolean)),
  );

  const payloadSessionIds = Array.from(
    new Set(
      items
        .map((x) => String(x?.payload?.sessionId || "").trim())
        .filter((id) => mongoose.Types.ObjectId.isValid(id)),
    ),
  );
  const payloadConsumerCodes = Array.from(
    new Set(
      items
        .map((x) => String(x?.payload?.consumerCode || "").trim())
        .filter(Boolean),
    ),
  );
  const payloadTokenCodes = Array.from(
    new Set(
      items
        .map((x) => String(x?.payload?.tokenCode || "").trim())
        .filter(Boolean),
    ),
  );

  const [distributors, sessions, consumers, tokens] = await Promise.all([
    distributorIds.length
      ? Distributor.find({ _id: { $in: distributorIds } })
          .select("_id division wardNo ward userId")
          .populate("userId", "name")
          .lean()
      : [],
    payloadSessionIds.length
      ? DistributionSession.find({ _id: { $in: payloadSessionIds } })
          .select("_id dateKey status distributorId")
          .lean()
      : [],
    payloadConsumerCodes.length
      ? Consumer.find({ consumerCode: { $in: payloadConsumerCodes } })
          .select("_id consumerCode name division ward")
          .lean()
      : [],
    payloadTokenCodes.length
      ? Token.find({ tokenCode: { $in: payloadTokenCodes } })
          .select("_id tokenCode consumerId sessionId rationItem rationQtyKg")
          .populate("consumerId", "consumerCode name division ward")
          .populate("sessionId", "_id dateKey status")
          .lean()
      : [],
  ]);

  const distributorMap = new Map(distributors.map((d) => [String(d._id), d]));
  const sessionMap = new Map(sessions.map((s) => [String(s._id), s]));
  const consumerMap = new Map(
    consumers.map((c) => [String(c.consumerCode), c]),
  );
  const tokenMap = new Map(tokens.map((t) => [String(t.tokenCode), t]));

  return items.map((item) => {
    const payload = item.payload || {};
    const actionType = String(payload.action || "").toUpperCase();
    const owner = distributorMap.get(String(item.distributorId || ""));
    const ownerUser =
      owner?.userId && typeof owner.userId === "object" ? owner.userId : null;

    const payloadToken = tokenMap.get(String(payload.tokenCode || "").trim());
    const payloadSession =
      sessionMap.get(String(payload.sessionId || "").trim()) ||
      (payloadToken?.sessionId && typeof payloadToken.sessionId === "object"
        ? payloadToken.sessionId
        : null);
    const payloadConsumer =
      consumerMap.get(String(payload.consumerCode || "").trim()) ||
      (payloadToken?.consumerId && typeof payloadToken.consumerId === "object"
        ? payloadToken.consumerId
        : null);

    const itemName = normalizeStockItem(payloadToken?.rationItem || "") || "";

    return {
      ...item,
      division: payloadConsumer?.division || owner?.division || "",
      ward: payloadConsumer?.ward || owner?.wardNo || owner?.ward || "",
      distributorName: ownerUser?.name || "",
      distributorCode: owner?._id
        ? `DST-${String(owner._id).slice(-6).toUpperCase()}`
        : "",
      sessionId: payloadSession?._id ? String(payloadSession._id) : "",
      sessionCode: payloadSession ? makeSessionCode(payloadSession) : "",
      sessionDate: payloadSession?.dateKey || "",
      sessionStatus: payloadSession?.status || "",
      consumerCode:
        payloadConsumer?.consumerCode || String(payload.consumerCode || ""),
      consumerName: payloadConsumer?.name || "",
      tokenCode: payloadToken?.tokenCode || String(payload.tokenCode || ""),
      actionType,
      item: itemName,
      expectedQtyKg: Number(payloadToken?.rationQtyKg || 0),
      actualQtyKg: Number(payload.actualKg || 0),
      payloadSummary: {
        actionType,
        sessionId: payloadSession?._id ? String(payloadSession._id) : "",
        sessionCode: payloadSession ? makeSessionCode(payloadSession) : "",
        consumerCode:
          payloadConsumer?.consumerCode || String(payload.consumerCode || ""),
        consumerName: payloadConsumer?.name || "",
        tokenCode: payloadToken?.tokenCode || String(payload.tokenCode || ""),
        item: itemName,
        expectedQtyKg: Number(payloadToken?.rationQtyKg || 0),
        actualQtyKg: Number(payload.actualKg || 0),
      },
    };
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

    const [enrichedBlacklist, enrichedOffline] = await Promise.all([
      enrichBlacklistEntries(blacklist),
      enrichOfflineQueueItems(offline),
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
        offlinePending: enrichedOffline.length,
        blacklist: enrichedBlacklist,
        offline: enrichedOffline,
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

    const enrichedEntries = await enrichBlacklistEntries(entries);

    res.json({
      success: true,
      data: {
        entries: enrichedEntries,
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

    const enrichedItems = await enrichOfflineQueueItems(items);

    res.json({
      success: true,
      data: {
        items: enrichedItems,
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

    const normalized = normalizeOfflinePayload(payload);
    if (!normalized.valid) {
      return res.status(400).json({
        success: false,
        message: normalized.message,
      });
    }

    const item = await OfflineQueue.create({
      distributorId: distributor._id,
      payload: normalized.value,
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
