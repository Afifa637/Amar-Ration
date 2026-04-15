const Token = require("../models/Token");
const DistributionRecord = require("../models/DistributionRecord");
const DistributionSession = require("../models/DistributionSession");
const Consumer = require("../models/Consumer");
const Distributor = require("../models/Distributor");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const ExcelJS = require("exceljs");
const { makeSessionCode } = require("../services/sessionCode.service");
const {
  STOCK_ITEMS,
  normalizeStockItem,
} = require("../utils/stock-items.utils");
const {
  normalizeDivision,
  isSameDivision,
  buildDivisionMatchQuery,
} = require("../utils/division.utils");
const { normalizeWardNo, buildWardMatchQuery } = require("../utils/ward.utils");

function makeDistributorCode(distributorId) {
  if (!distributorId) return "";
  return `DST-${String(distributorId).slice(-6).toUpperCase()}`;
}

function zeroQtyByItem() {
  return STOCK_ITEMS.reduce((acc, item) => {
    acc[item] = 0;
    return acc;
  }, {});
}

function mapSingleItemQty(item, qtyKg) {
  const out = zeroQtyByItem();
  const normalizedItem = normalizeStockItem(item);
  if (!normalizedItem) return out;
  out[normalizedItem] = Number(Number(qtyKg || 0).toFixed(3));
  return out;
}

function buildMismatchDetails(expectedByItem, actualByItem) {
  const details = [];
  for (const item of STOCK_ITEMS) {
    const expected = Number(expectedByItem?.[item] || 0);
    const actual = Number(actualByItem?.[item] || 0);
    const diff = Number((actual - expected).toFixed(3));
    if (Math.abs(diff) <= 0.001) continue;
    details.push({
      item,
      expectedKg: expected,
      actualKg: actual,
      diffKg: diff,
      reason:
        diff < 0
          ? `${item} short by ${Math.abs(diff)}kg`
          : `${item} excess by ${diff}kg`,
    });
  }
  return details;
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
  const limit = Math.min(1000, Math.max(1, Number(query.limit) || 20));
  return { page, limit };
}

function csvEscape(value) {
  const raw = value === undefined || value === null ? "" : String(value);
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

function formatDate(input) {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

async function reportSummary(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);
    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const tokenQuery = distributor ? { distributorId: distributor._id } : {};
    const tokens = await Token.find(tokenQuery).select("_id status").lean();
    const tokenIds = tokens.map((item) => item._id);

    const [usedTokens, mismatches] = await Promise.all([
      Token.countDocuments({ ...tokenQuery, status: "Used" }),
      DistributionRecord.countDocuments({
        tokenId: { $in: tokenIds },
        mismatch: true,
      }),
    ]);

    res.json({ totalTokens: tokens.length, usedTokens, mismatches });
  } catch (error) {
    console.error("reportSummary error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function distributionReport(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);
    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const {
      from,
      to,
      search,
      mismatch,
      status,
      division,
      ward,
      wardNo,
      sessionId,
      sessionCode,
      distributorId,
      consumerCode,
      consumerName,
      item,
      mismatchReason,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;
    const { page, limit } = parsePageLimit(req.query);

    const tokenQuery = distributor ? { distributorId: distributor._id } : {};

    if (!distributor && distributorId) {
      tokenQuery.distributorId = distributorId;
    }

    if (sessionId) {
      tokenQuery.sessionId = sessionId;
    }

    if (status) {
      tokenQuery.status = status;
    }

    const tokenDocs = await Token.find(tokenQuery)
      .populate("consumerId", "consumerCode name ward division category")
      .populate({
        path: "distributorId",
        select: "_id division wardNo ward userId",
        populate: { path: "userId", select: "name" },
      })
      .populate("sessionId", "_id dateKey status")
      .select(
        "_id tokenCode status rationQtyKg rationItem consumerId distributorId sessionId issuedAt createdAt",
      )
      .lean();

    const tokenMap = new Map(
      tokenDocs.map((token) => [String(token._id), token]),
    );
    const tokenIds = tokenDocs.map((token) => token._id);

    const recordQuery = { tokenId: { $in: tokenIds } };
    if (mismatch === "true") recordQuery.mismatch = true;
    if (mismatch === "false") recordQuery.mismatch = false;

    if (from || to) {
      recordQuery.createdAt = {};
      if (from) recordQuery.createdAt.$gte = new Date(String(from));
      if (to) {
        const end = new Date(String(to));
        end.setHours(23, 59, 59, 999);
        recordQuery.createdAt.$lte = end;
      }
    }

    const recordsRaw = await DistributionRecord.find(recordQuery)
      .sort({ createdAt: sortOrder === "asc" ? 1 : -1 })
      .lean();

    const enriched = recordsRaw
      .map((record) => {
        const token = tokenMap.get(String(record.tokenId));
        if (!token) return null;

        const consumer =
          token.consumerId && typeof token.consumerId === "object"
            ? token.consumerId
            : null;
        const distributorDoc =
          token.distributorId && typeof token.distributorId === "object"
            ? token.distributorId
            : null;
        const distributorUser =
          distributorDoc?.userId && typeof distributorDoc.userId === "object"
            ? distributorDoc.userId
            : null;
        const session =
          token.sessionId && typeof token.sessionId === "object"
            ? token.sessionId
            : null;

        const rationItem = normalizeStockItem(token.rationItem) || "চাল";
        const expectedByItem = mapSingleItemQty(rationItem, record.expectedKg);
        const actualByItem = mapSingleItemQty(rationItem, record.actualKg);
        const mismatchDetails = buildMismatchDetails(
          expectedByItem,
          actualByItem,
        );
        const mismatchReasonText = mismatchDetails
          .map((x) => x.reason)
          .join(" | ");

        const resolvedDivision =
          consumer?.division || distributorDoc?.division || "";
        const resolvedWard =
          consumer?.ward ||
          distributorDoc?.wardNo ||
          distributorDoc?.ward ||
          "";

        return {
          _id: record._id,
          createdAt: record.createdAt,
          tokenCode: token.tokenCode,
          tokenStatus: token.status,
          tokenId: String(token._id),
          sessionId: session?._id ? String(session._id) : null,
          sessionCode: session ? makeSessionCode(session) : "",
          sessionDate: session?.dateKey || "",
          sessionStatus: session?.status || "",
          distributorId: distributorDoc?._id ? String(distributorDoc._id) : "",
          distributorCode: distributorDoc?._id
            ? makeDistributorCode(distributorDoc._id)
            : "",
          distributorName: distributorUser?.name || "",
          expectedKg: record.expectedKg,
          actualKg: record.actualKg,
          rationItem,
          expectedByItem,
          actualByItem,
          mismatchDetails,
          mismatchItem: mismatchDetails[0]?.item || "",
          mismatchReason: mismatchReasonText,
          mismatch: record.mismatch,
          dateTime: record.createdAt,
          consumerCode: consumer?.consumerCode || "",
          consumerName: consumer?.name || "",
          consumerId: consumer?._id ? String(consumer._id) : "",
          division: resolvedDivision,
          ward: resolvedWard,
          category: consumer?.category || "",
        };
      })
      .filter(Boolean);

    const searchNeedle = String(search || "")
      .trim()
      .toLowerCase();

    const requestedDivision = String(division || "").trim();
    const requestedWard = normalizeWardNo(wardNo || ward);

    if (requestedWard && !requestedDivision) {
      return res.status(400).json({
        success: false,
        message: "ওয়ার্ড ফিল্টার ব্যবহার করতে বিভাগ একসাথে দিতে হবে",
        code: "VALIDATION_ERROR",
      });
    }

    const scopedRows = enriched.filter((row) => {
      if (
        sessionCode &&
        !String(row.sessionCode || "")
          .toLowerCase()
          .includes(String(sessionCode).trim().toLowerCase())
      ) {
        return false;
      }

      if (
        consumerCode &&
        !String(row.consumerCode || "")
          .toLowerCase()
          .includes(String(consumerCode).trim().toLowerCase())
      ) {
        return false;
      }

      if (
        consumerName &&
        !String(row.consumerName || "")
          .toLowerCase()
          .includes(String(consumerName).trim().toLowerCase())
      ) {
        return false;
      }

      if (item && normalizeStockItem(item) !== row.rationItem) {
        return false;
      }

      if (
        mismatchReason &&
        !String(row.mismatchReason || "")
          .toLowerCase()
          .includes(String(mismatchReason).trim().toLowerCase())
      ) {
        return false;
      }

      if (searchNeedle) {
        const haystack = [
          row.tokenCode,
          row.consumerCode,
          row.consumerName,
          row.sessionCode,
          row.distributorName,
          row.distributorCode,
          row.division,
          row.ward,
          row.rationItem,
          row.mismatchReason,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(searchNeedle)) return false;
      }

      if (
        requestedDivision &&
        !isSameDivision(requestedDivision, row.division)
      ) {
        return false;
      }

      if (requestedWard) {
        return normalizeWardNo(row.ward) === requestedWard;
      }

      return true;
    });

    const sortableFields = new Set([
      "createdAt",
      "tokenCode",
      "expectedKg",
      "actualKg",
      "consumerCode",
      "consumerName",
      "sessionCode",
      "distributorName",
    ]);

    if (sortableFields.has(String(sortBy))) {
      const direction = sortOrder === "asc" ? 1 : -1;
      scopedRows.sort((a, b) => {
        const left = a[sortBy];
        const right = b[sortBy];

        if (left === right) return 0;
        if (left === undefined || left === null) return -1 * direction;
        if (right === undefined || right === null) return 1 * direction;
        return left > right ? direction : -1 * direction;
      });
    }

    const total = scopedRows.length;
    const start = (page - 1) * limit;
    const rows = scopedRows.slice(start, start + limit);

    const totals = scopedRows.reduce(
      (acc, row) => {
        acc.expectedKg += Number(row.expectedKg || 0);
        acc.actualKg += Number(row.actualKg || 0);
        if (row.mismatch) acc.mismatches += 1;

        for (const stockItem of STOCK_ITEMS) {
          acc.itemWise[stockItem].expectedKg += Number(
            row.expectedByItem?.[stockItem] || 0,
          );
          acc.itemWise[stockItem].actualKg += Number(
            row.actualByItem?.[stockItem] || 0,
          );
        }

        return acc;
      },
      {
        expectedKg: 0,
        actualKg: 0,
        mismatches: 0,
        itemWise: STOCK_ITEMS.reduce((acc, stockItem) => {
          acc[stockItem] = { expectedKg: 0, actualKg: 0 };
          return acc;
        }, {}),
      },
    );

    for (const stockItem of STOCK_ITEMS) {
      totals.itemWise[stockItem].expectedKg = Number(
        totals.itemWise[stockItem].expectedKg.toFixed(3),
      );
      totals.itemWise[stockItem].actualKg = Number(
        totals.itemWise[stockItem].actualKg.toFixed(3),
      );
      totals.itemWise[stockItem].differenceKg = Number(
        (
          totals.itemWise[stockItem].actualKg -
          totals.itemWise[stockItem].expectedKg
        ).toFixed(3),
      );
    }

    res.json({
      success: true,
      data: {
        rows,
        totals: {
          ...totals,
          expectedKg: Number(totals.expectedKg.toFixed(2)),
          actualKg: Number(totals.actualKg.toFixed(2)),
          differenceKg: Number(
            (totals.actualKg - totals.expectedKg).toFixed(2),
          ),
        },
        scope: {
          division: distributor?.division || requestedDivision || "",
          ward: distributor?.wardNo || distributor?.ward || requestedWard || "",
          distributorId: distributor ? String(distributor._id) : null,
        },
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
    });
  } catch (error) {
    console.error("distributionReport error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function tokenAnalytics(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);
    if (req.user.userType !== "Admin" && !distributor) {
      return res
        .status(403)
        .json({ success: false, message: "Distributor profile not found" });
    }

    const tokenQuery = distributor ? { distributorId: distributor._id } : {};
    const tokens = await Token.find(tokenQuery)
      .populate("consumerId", "category consumerCode name")
      .select("status rationQtyKg consumerId")
      .lean();

    const byStatus = {
      Issued: 0,
      Used: 0,
      Cancelled: 0,
      Expired: 0,
    };

    const byCategory = {
      A: 0,
      B: 0,
      C: 0,
    };

    const consumerUsage = new Map();
    let totalRationKg = 0;

    for (const token of tokens) {
      byStatus[token.status] = (byStatus[token.status] || 0) + 1;
      totalRationKg += Number(token.rationQtyKg || 0);

      const consumer =
        token.consumerId && typeof token.consumerId === "object"
          ? token.consumerId
          : null;
      const category = consumer?.category;
      if (category && byCategory[category] !== undefined) {
        byCategory[category] += 1;
      }

      if (consumer && token.status === "Used") {
        const key = String(consumer.consumerCode || consumer._id || "UNKNOWN");
        const current = consumerUsage.get(key) || {
          consumerCode: consumer.consumerCode || "",
          name: consumer.name || "",
          usedTokens: 0,
        };
        current.usedTokens += 1;
        consumerUsage.set(key, current);
      }
    }

    const topConsumers = Array.from(consumerUsage.values())
      .sort((a, b) => b.usedTokens - a.usedTokens)
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        byStatus,
        byCategory,
        totalRationKg: Number(totalRationKg.toFixed(2)),
        topConsumers,
      },
    });
  } catch (error) {
    console.error("tokenAnalytics error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

async function reportAuditLogs(req, res) {
  try {
    const {
      severity,
      action,
      search,
      from,
      to,
      sessionId,
      tokenCode,
      consumerCode,
      sortOrder = "desc",
      format,
    } = req.query;
    const { page, limit } = parsePageLimit(req.query);

    const query = {};
    if (req.user.userType !== "Admin") {
      query.actorUserId = req.user.userId;
    }

    if (severity) query.severity = severity;
    if (action) query.action = action;

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(String(from));
      if (to) {
        const end = new Date(String(to));
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (search) {
      query.$or = [
        { action: { $regex: search, $options: "i" } },
        { entityType: { $regex: search, $options: "i" } },
        { entityId: { $regex: search, $options: "i" } },
        { "meta.tokenCode": { $regex: search, $options: "i" } },
        { "meta.consumerCode": { $regex: search, $options: "i" } },
      ];
    }

    if (sessionId) {
      query.$or = [
        ...(query.$or || []),
        { "meta.sessionId": String(sessionId) },
      ];
    }
    if (tokenCode) {
      query.$or = [
        ...(query.$or || []),
        { "meta.tokenCode": { $regex: String(tokenCode), $options: "i" } },
      ];
    }
    if (consumerCode) {
      query.$or = [
        ...(query.$or || []),
        {
          "meta.consumerCode": { $regex: String(consumerCode), $options: "i" },
        },
      ];
    }

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(query),
      AuditLog.find(query)
        .sort({ createdAt: sortOrder === "asc" ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const actorUserIds = Array.from(
      new Set(logs.map((log) => String(log.actorUserId || "")).filter(Boolean)),
    );
    const users = actorUserIds.length
      ? await User.find({ _id: { $in: actorUserIds } })
          .select("_id name")
          .lean()
      : [];
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const distributorIds = Array.from(
      new Set(
        logs
          .map((log) => String(log.meta?.distributorId || "").trim())
          .filter(Boolean),
      ),
    );
    const distributors = distributorIds.length
      ? await Distributor.find({ _id: { $in: distributorIds } })
          .select("_id division wardNo ward userId")
          .populate("userId", "name")
          .lean()
      : [];
    const distributorMap = new Map(distributors.map((d) => [String(d._id), d]));

    const enrichedLogs = logs.map((log) => {
      const meta = log.meta || {};
      const distributor = distributorMap.get(String(meta.distributorId || ""));
      const distributorUser =
        distributor?.userId && typeof distributor.userId === "object"
          ? distributor.userId
          : null;
      const actorUser = userMap.get(String(log.actorUserId || ""));
      const division =
        normalizeDivision(meta.division || distributor?.division || "") || "";
      const ward =
        normalizeWardNo(
          meta.ward || distributor?.wardNo || distributor?.ward || "",
        ) || "";
      const sessionIdValue = String(meta.sessionId || "").trim();
      const sessionDateKey = String(meta.sessionDateKey || "").trim();

      return {
        ...log,
        actorName: actorUser?.name || "",
        division,
        ward,
        sessionId: sessionIdValue || "",
        sessionCode:
          sessionDateKey && sessionIdValue
            ? makeSessionCode({ _id: sessionIdValue, dateKey: sessionDateKey })
            : String(meta.sessionCode || ""),
        consumerCode: String(meta.consumerCode || ""),
        consumerName: String(meta.consumerName || ""),
        distributorId: distributor?._id
          ? String(distributor._id)
          : String(meta.distributorId || ""),
        distributorCode:
          distributor?._id || meta.distributorId
            ? makeDistributorCode(distributor?._id || meta.distributorId)
            : "",
        distributorName:
          String(meta.distributorName || "") || distributorUser?.name || "",
        tokenCode: String(meta.tokenCode || ""),
        item: normalizeStockItem(meta.item || meta.rationItem || "") || "",
        mismatchReason:
          String(meta.reason || meta.mismatchReason || "") ||
          (log.action.includes("MISMATCH") ? "Weight mismatch detected" : ""),
      };
    });

    if (format === "csv") {
      const headers = [
        "time",
        "action",
        "actorName",
        "entityType",
        "entityId",
        "severity",
        "actorType",
        "division",
        "ward",
        "sessionId",
        "sessionCode",
        "consumerCode",
        "consumerName",
        "distributorCode",
        "distributorName",
        "tokenCode",
        "item",
        "mismatchReason",
      ];
      const rows = enrichedLogs.map((log) => [
        formatDate(log.createdAt),
        log.action,
        log.actorName,
        log.entityType,
        log.entityId,
        log.severity,
        log.actorType,
        log.division,
        log.ward,
        log.sessionId,
        log.sessionCode,
        log.consumerCode,
        log.consumerName,
        log.distributorCode,
        log.distributorName,
        log.tokenCode,
        log.item,
        log.mismatchReason,
      ]);

      const csv = [headers, ...rows]
        .map((row) => row.map((cell) => csvEscape(cell)).join(","))
        .join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=audit-logs-${Date.now()}.csv`,
      );
      return res.send(csv);
    }

    res.json({
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
    console.error("reportAuditLogs error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// GET /api/reports/export?format=csv&from=2026-04-01&to=2026-04-30&division=Khulna&wardNo=02
async function exportDistributionReport(req, res) {
  try {
    if (req.user.userType !== "Admin") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }

    const { format = "csv", from, to, division, wardNo, ward } = req.query;

    if ((wardNo || ward) && !division) {
      return res.status(400).json({
        success: false,
        message: "ওয়ার্ড ফিল্টার ব্যবহার করতে বিভাগ একসাথে দিতে হবে",
        code: "VALIDATION_ERROR",
      });
    }

    const tokenQuery = {};
    if (from || to) {
      tokenQuery.issuedAt = {};
      if (from) tokenQuery.issuedAt.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        tokenQuery.issuedAt.$lte = end;
      }
    }

    if (division || wardNo || ward) {
      const distQuery = {};
      if (division) {
        distQuery.division =
          buildDivisionMatchQuery(division) || normalizeDivision(division);
      }

      const wardInput = wardNo || ward;
      if (wardInput) {
        const wardQuery = buildWardMatchQuery(wardInput, ["wardNo", "ward"]);
        if (wardQuery?.$or) {
          distQuery.$or = wardQuery.$or;
        } else {
          distQuery.wardNo = normalizeWardNo(wardInput);
        }
      }

      const distributors = await Distributor.find(distQuery)
        .select("_id")
        .lean();
      tokenQuery.distributorId = { $in: distributors.map((d) => d._id) };
    }

    const tokens = await Token.find(tokenQuery)
      .populate(
        "consumerId",
        "consumerCode name category ward division nidLast4 guardianPhone",
      )
      .populate({
        path: "distributorId",
        select: "_id wardNo ward division district userId",
        populate: { path: "userId", select: "name" },
      })
      .populate("sessionId", "_id dateKey status")
      .lean();

    const tokenIds = tokens.map((t) => t._id);
    const records = tokenIds.length
      ? await DistributionRecord.find({ tokenId: { $in: tokenIds } })
          .select("tokenId expectedKg actualKg mismatch")
          .lean()
      : [];
    const recordMap = new Map(records.map((r) => [String(r.tokenId), r]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Distribution Report");

    sheet.columns = [
      { header: "Token Code", key: "tokenCode", width: 18 },
      { header: "Date", key: "date", width: 14 },
      { header: "Consumer Code", key: "consumerCode", width: 15 },
      { header: "Consumer Name", key: "consumerName", width: 20 },
      { header: "NID Last 4", key: "nidLast4", width: 12 },
      { header: "Guardian Phone", key: "guardianPhone", width: 16 },
      { header: "Category", key: "category", width: 10 },
      { header: "Ward", key: "ward", width: 8 },
      { header: "Division", key: "division", width: 12 },
      { header: "Session ID", key: "sessionId", width: 20 },
      { header: "Session Code", key: "sessionCode", width: 22 },
      { header: "Session Date", key: "sessionDate", width: 14 },
      { header: "Session Status", key: "sessionStatus", width: 14 },
      { header: "Distributor", key: "distributorName", width: 20 },
      { header: "Distributor Code", key: "distributorCode", width: 16 },
      { header: "Item", key: "rationItem", width: 10 },
      { header: "Expected (kg)", key: "expectedKg", width: 12 },
      { header: "Actual (kg)", key: "actualKg", width: 12 },
      { header: "Mismatch", key: "mismatch", width: 10 },
      { header: "Status", key: "status", width: 10 },
    ];

    for (const token of tokens) {
      const consumer = token.consumerId || {};
      const session = token.sessionId || null;
      const record = recordMap.get(String(token._id));
      const distributor = token.distributorId || {};
      const distributorUser =
        distributor?.userId && typeof distributor.userId === "object"
          ? distributor.userId
          : null;
      const rationItem = normalizeStockItem(token.rationItem) || "চাল";
      sheet.addRow({
        tokenCode: token.tokenCode,
        date: token.issuedAt
          ? new Date(token.issuedAt).toLocaleDateString("en-GB")
          : "",
        consumerCode: consumer.consumerCode || "",
        consumerName: consumer.name || "",
        nidLast4: consumer.nidLast4 || "",
        guardianPhone: consumer.guardianPhone || "",
        category: consumer.category || "",
        ward: consumer.ward || distributor?.wardNo || distributor?.ward || "",
        division: consumer.division || distributor?.division || "",
        sessionId: session?._id ? String(session._id) : "",
        sessionCode: session ? makeSessionCode(session) : "",
        sessionDate: session?.dateKey || "",
        sessionStatus: session?.status || "",
        distributorName: distributorUser?.name || "",
        distributorCode: makeDistributorCode(distributor?._id),
        rationItem,
        expectedKg: Number(record?.expectedKg ?? token.rationQtyKg ?? 0),
        actualKg: Number(record?.actualKg ?? 0),
        mismatch: record?.mismatch ? "Yes" : "No",
        status: token.status || "",
      });
    }

    sheet.getRow(1).font = { bold: true };

    const filename = `distribution-report-${new Date().toISOString().slice(0, 10)}`;

    if (String(format).toLowerCase() === "xlsx") {
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=\"${filename}.xlsx\"`,
      );
      await workbook.xlsx.write(res);
    } else {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=\"${filename}.csv\"`,
      );
      await workbook.csv.write(res);
    }

    return res.end();
  } catch (error) {
    console.error("exportDistributionReport error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = {
  reportSummary,
  distributionReport,
  tokenAnalytics,
  reportAuditLogs,
  exportDistributionReport,
};
