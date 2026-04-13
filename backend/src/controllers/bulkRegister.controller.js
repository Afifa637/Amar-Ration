"use strict";

const crypto = require("crypto");
const mongoose = require("mongoose");
const { parse } = require("csv-parse/sync");

const Consumer = require("../models/Consumer");
const Family = require("../models/Family");
const QRCode = require("../models/QRCode");
const OMSCard = require("../models/OMSCard");
const SystemSetting = require("../models/SystemSetting");
const Distributor = require("../models/Distributor");
const { hashNid } = require("../services/nid-security.service");
const { validateConsumerPayload, validateNID } = require("../utils/validators");
const { normalizeWardNo } = require("../utils/ward.utils");
const { normalizeDivision } = require("../utils/division.utils");
const { buildOmsQrPayload } = require("../utils/qr-payload.utils");

const CSV_REQUIRED_HEADERS = [
  "name",
  "nidNumber",
  "fatherNidNumber",
  "motherNidNumber",
  "phone",
  "wardNumber",
  "unionName",
  "upazila",
  "district",
  "division",
  "category",
  "memberCount",
];

const CSV_OPTIONAL_HEADERS = ["guardianName"];

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
}

function normalizeHeader(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .trim();
}

function monthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const last = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return { first, last };
}

async function nextConsumerCode() {
  while (true) {
    const seqDoc = await SystemSetting.findOneAndUpdate(
      { key: "consumer:code:seq" },
      [
        {
          $set: {
            value: {
              seq: {
                $add: [{ $ifNull: ["$value.seq", 0] }, 1],
              },
            },
          },
        },
      ],
      { upsert: true, new: true },
    ).lean();

    const seq = Number(seqDoc?.value?.seq || 0);
    const code = `C${String(seq).padStart(4, "0")}`;
    const exists = await Consumer.exists({ consumerCode: code });
    if (!exists) return code;
  }
}

async function getRequesterScope(reqUser) {
  if (reqUser.userType === "Admin") return null;

  const profile = await Distributor.findOne({ userId: reqUser.userId })
    .select("division wardNo ward authorityStatus")
    .lean();

  if (!profile || profile.authorityStatus !== "Active") {
    return { denied: true, reason: "Distributor profile not active" };
  }

  return {
    denied: false,
    distributorId: String(profile._id),
    division: normalizeDivision(profile.division || ""),
    ward: normalizeWardNo(profile.wardNo || profile.ward || ""),
  };
}

function rowInsideScope(cleaned, scope) {
  if (!scope) return true;
  const rowDivision = normalizeDivision(cleaned.division || "");
  const rowWard = normalizeWardNo(cleaned.ward || "");
  return rowDivision === scope.division && rowWard === scope.ward;
}

function applyScopeOverrides(cleaned, scope) {
  if (!scope) return cleaned;
  return {
    ...cleaned,
    division: scope.division,
    ward: scope.ward,
  };
}

async function uploadBulkRegister(req, res) {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "CSV file is required",
        code: "VALIDATION_ERROR",
      });
    }

    const dryRun =
      String(req.query?.dryRun || "false").toLowerCase() === "true";
    const content = req.file.buffer.toString("utf8");

    const rows = parse(content, {
      bom: true,
      columns: (headers) => headers.map(normalizeHeader),
      skip_empty_lines: true,
      trim: true,
    });

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "CSV তে কোনো ডেটা পাওয়া যায়নি",
        code: "VALIDATION_ERROR",
      });
    }

    const firstRow = rows[0] || {};
    const missing = CSV_REQUIRED_HEADERS.filter(
      (h) => !Object.prototype.hasOwnProperty.call(firstRow, h),
    );
    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required CSV columns: ${missing.join(", ")}`,
        code: "VALIDATION_ERROR",
        data: {
          missingHeaders: missing,
          requiredHeaders: CSV_REQUIRED_HEADERS,
          optionalHeaders: CSV_OPTIONAL_HEADERS,
        },
      });
    }

    const scope = await getRequesterScope(req.user);
    if (scope?.denied) {
      return res.status(403).json({
        success: false,
        message: scope.reason,
        code: "FORBIDDEN",
      });
    }

    const errors = [];
    const validRows = [];
    const seenNids = new Map();

    rows.forEach((row, idx) => {
      const payload = validateConsumerPayload(row);
      if (!payload.valid) {
        errors.push({
          row: idx + 2,
          name: row?.name || "",
          nid: row?.nidNumber || "",
          reason: payload.errors.join(", "),
        });
        return;
      }

      const originalCleaned = payload.cleaned;
      if (scope && !rowInsideScope(originalCleaned, scope)) {
        errors.push({
          row: idx + 2,
          name: row?.name || "",
          nid: row?.nidNumber || "",
          reason:
            "Row বাইরে: আপনার division/ward scope এর বাইরে নিবন্ধন অনুমোদিত নয়",
        });
        return;
      }

      const scopedCleaned = applyScopeOverrides(originalCleaned, scope);

      const nidKey = String(payload.cleaned.nidFull || "");
      if (seenNids.has(nidKey)) {
        errors.push({
          row: idx + 2,
          name: row?.name || "",
          nid: row?.nidNumber || "",
          reason: `Duplicate NID inside CSV (first seen at row ${seenNids.get(nidKey)})`,
        });
        return;
      }
      seenNids.set(nidKey, idx + 2);

      validRows.push({
        original: row,
        cleaned: scopedCleaned,
        rowNumber: idx + 2,
      });
    });

    for (const item of validRows) {
      const existing = await Consumer.findOne({
        nidHash: hashNid(item.cleaned.nidFull),
      })
        .select("consumerCode")
        .lean();
      if (existing) {
        errors.push({
          row: item.rowNumber,
          name: item.cleaned.name,
          nid: item.cleaned.nidFull,
          reason: `Duplicate NID (${existing.consumerCode || "existing"})`,
        });
      }
    }

    if (dryRun) {
      const skipped = errors.length;
      const inserted = Math.max(0, rows.length - skipped);
      return res.json({
        success: true,
        data: {
          dryRun: true,
          total: rows.length,
          inserted,
          skipped,
          errors,
        },
      });
    }

    let inserted = 0;

    for (const item of validRows) {
      const duplicate = errors.find((e) => e.row === item.rowNumber);
      if (duplicate) continue;

      const rowSession = await mongoose.startSession();
      try {
        rowSession.startTransaction();

        const code = await nextConsumerCode();
        const { first, last } = monthRange();

        const father = validateNID(item.original.fatherNidNumber);
        const mother = validateNID(item.original.motherNidNumber);
        const familyKey = sha256(
          (father.cleaned || item.cleaned.fatherNidFull) +
            "|" +
            (mother.cleaned || item.cleaned.motherNidFull),
        );

        const family = await Family.findOneAndUpdate(
          { familyKey },
          {
            $setOnInsert: {
              familyKey,
              fatherNidLast4: (father.cleaned || "").slice(-4),
              motherNidLast4: (mother.cleaned || "").slice(-4),
              flaggedDuplicate: false,
            },
          },
          { upsert: true, new: true, session: rowSession },
        );

        const qrPayload =
          buildOmsQrPayload({
            consumerCode: code,
            ward: item.cleaned.ward,
            category: item.cleaned.category,
            expiryDate: last,
          }) || crypto.randomBytes(32).toString("hex");

        const qr = await QRCode.create(
          [
            {
              payload: qrPayload,
              payloadHash: sha256(qrPayload),
              validFrom: first,
              validTo: last,
              status: "Valid",
            },
          ],
          { session: rowSession },
        ).then((docs) => docs[0]);

        const consumer = await Consumer.create(
          [
            {
              consumerCode: code,
              qrToken: qrPayload,
              name: item.cleaned.name,
              nidFull: item.cleaned.nidFull,
              fatherNidFull: item.cleaned.fatherNidFull,
              motherNidFull: item.cleaned.motherNidFull,
              category: item.cleaned.category,
              status: "Inactive",
              guardianPhone: item.cleaned.phone,
              guardianName: item.cleaned.guardianName || "",
              familyId: family?._id,
              createdByDistributor: scope?.distributorId || undefined,
              division: item.cleaned.division,
              district: item.cleaned.district,
              upazila: item.cleaned.upazila,
              unionName: item.cleaned.unionName,
              ward: item.cleaned.ward,
            },
          ],
          { session: rowSession },
        ).then((docs) => docs[0]);

        await OMSCard.create(
          [
            {
              consumerId: consumer._id,
              cardStatus: "Inactive",
              qrCodeId: qr._id,
            },
          ],
          { session: rowSession },
        );

        await rowSession.commitTransaction();

        inserted += 1;
      } catch (rowError) {
        await rowSession.abortTransaction();
        errors.push({
          row: item.rowNumber,
          name: item.cleaned.name,
          nid: item.cleaned.nidFull,
          reason:
            rowError instanceof Error
              ? rowError.message
              : "Insert failed for this row",
        });
      } finally {
        rowSession.endSession();
      }
    }

    return res.status(201).json({
      success: true,
      data: {
        dryRun: false,
        total: rows.length,
        inserted,
        skipped: rows.length - inserted,
        errors,
      },
    });
  } catch (error) {
    console.error("uploadBulkRegister error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

module.exports = {
  uploadBulkRegister,
};
