const Token = require("../models/Token");
const DistributionRecord = require("../models/DistributionRecord");
const Distributor = require("../models/Distributor");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const ExcelJS = require("exceljs");
const {
  normalizeDivision,
  isSameDivision,
  buildDivisionMatchQuery,
} = require("../utils/division.utils");
const { normalizeWardNo, buildWardMatchQuery } = require("../utils/ward.utils");

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
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;
    const { page, limit } = parsePageLimit(req.query);

    const tokenQuery = distributor ? { distributorId: distributor._id } : {};

    if (status) {
      tokenQuery.status = status;
    }

    if (search) {
      tokenQuery.tokenCode = { $regex: search, $options: "i" };
    }

    const tokenDocs = await Token.find(tokenQuery)
      .populate("consumerId", "consumerCode name ward division category")
      .select("_id tokenCode status rationQtyKg consumerId createdAt")
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

        return {
          _id: record._id,
          createdAt: record.createdAt,
          tokenCode: token.tokenCode,
          tokenStatus: token.status,
          expectedKg: record.expectedKg,
          actualKg: record.actualKg,
          mismatch: record.mismatch,
          consumerCode: consumer?.consumerCode || "",
          consumerName: consumer?.name || "",
          division: consumer?.division || "",
          ward: consumer?.ward || "",
          category: consumer?.category || "",
        };
      })
      .filter(Boolean);

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
        return acc;
      },
      { expectedKg: 0, actualKg: 0, mismatches: 0 },
    );

    res.json({
      success: true,
      data: {
        rows,
        totals: {
          ...totals,
          expectedKg: Number(totals.expectedKg.toFixed(2)),
          actualKg: Number(totals.actualKg.toFixed(2)),
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

    if (format === "csv") {
      const headers = [
        "time",
        "action",
        "entityType",
        "entityId",
        "severity",
        "actorType",
      ];
      const rows = logs.map((log) => [
        formatDate(log.createdAt),
        log.action,
        log.entityType,
        log.entityId,
        log.severity,
        log.actorType,
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
      .populate("distributorId", "wardNo division district")
      .lean();

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
      { header: "Ration (kg)", key: "rationQtyKg", width: 12 },
      { header: "Status", key: "status", width: 10 },
    ];

    for (const token of tokens) {
      const consumer = token.consumerId || {};
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
        ward: consumer.ward || token.distributorId?.wardNo || "",
        division: consumer.division || token.distributorId?.division || "",
        rationQtyKg: token.rationQtyKg || 0,
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
