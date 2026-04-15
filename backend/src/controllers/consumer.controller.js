const crypto = require("crypto");
const QRCodeImage = require("qrcode");
const Consumer = require("../models/Consumer");
const Family = require("../models/Family");
const OMSCard = require("../models/OMSCard");
const QRCode = require("../models/QRCode");
const SystemSetting = require("../models/SystemSetting");
const User = require("../models/User");
const Distributor = require("../models/Distributor");
const {
  normalizeNid,
  decryptNid,
  hashNid,
} = require("../services/nid-security.service");
const { nextConsumerCode } = require("../services/consumer-code.service");
const { writeAudit } = require("../services/audit.service");
const {
  notifyAdmins,
  notifyUser,
} = require("../services/notification.service");
const {
  normalizeWardNo,
  buildWardMatchQuery,
  isSameWard,
} = require("../utils/ward.utils");
const {
  normalizeDivision,
  isSameDivision,
  buildDivisionMatchQuery,
} = require("../utils/division.utils");
const { buildArQrPayload } = require("../utils/qr-payload.utils");
const { buildContainsRegex } = require("../utils/regex.utils");

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

function buildDistributorScopeQuery(distributor) {
  const query = {};

  const divisionQuery = buildDivisionMatchQuery(distributor?.division);
  if (divisionQuery) {
    query.division = divisionQuery;
  }

  const wardQuery = buildWardMatchQuery(
    distributor?.wardNo || distributor?.ward,
  );
  if (wardQuery) {
    Object.assign(query, wardQuery);
  }

  return query;
}

function canAccessConsumerByScope(distributor, consumer) {
  const distributorDivision = normalizeDivision(distributor?.division);
  if (
    distributorDivision &&
    !isSameDivision(distributorDivision, consumer?.division)
  ) {
    return false;
  }

  return isSameWard(
    distributor?.wardNo || distributor?.ward,
    consumer?.ward || consumer?.wardNo,
  );
}

// Generate unique consumer code
const generateConsumerCode = async () => nextConsumerCode();

const NID_LENGTHS = new Set([10, 13, 17]);

function isValidNid(value) {
  return NID_LENGTHS.has(value.length);
}

function getLast4(value) {
  return value.slice(-4);
}

function maskNid(value) {
  const plain = normalizeNid(String(value || ""));
  if (!plain) return null;
  return `******${plain.slice(-4)}`;
}

function withDecryptedNids(consumer, { includeSensitive = false } = {}) {
  if (!consumer) return consumer;
  const nid = decryptNid(consumer.nidFull);
  const fatherNid = decryptNid(consumer.fatherNidFull);
  const motherNid = decryptNid(consumer.motherNidFull);

  if (includeSensitive) {
    return {
      ...consumer,
      nidFull: nid,
      fatherNidFull: fatherNid,
      motherNidFull: motherNid,
    };
  }

  return {
    ...consumer,
    nidFull: undefined,
    fatherNidFull: undefined,
    motherNidFull: undefined,
    nidMasked: maskNid(nid),
    fatherNidMasked: maskNid(fatherNid),
    motherNidMasked: maskNid(motherNid),
  };
}

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

async function buildQrImageDataUrl(payload) {
  if (!payload) return null;
  try {
    return await QRCodeImage.toDataURL(String(payload), {
      errorCorrectionLevel: "M",
      width: 220,
      margin: 1,
    });
  } catch {
    return null;
  }
}

function parsePageLimit(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit };
}

async function getQrExpiryDays(userId) {
  const key = `distributor:${String(userId)}:settings`;
  const setting = await SystemSetting.findOne({ key }).lean();
  const days = Number(setting?.value?.qr?.expiryCycleDays);
  if (Number.isFinite(days) && days > 0) return days;
  return 30;
}

async function resolveFamilyByNids(
  { nidFull, fatherNidFull, motherNidFull },
  excludeId,
) {
  const nidSet = Array.from(
    new Set([nidFull, fatherNidFull, motherNidFull].filter(Boolean)),
  );

  if (nidSet.length === 0) {
    return { familyId: null, hasDuplicate: false, matchedIds: [] };
  }

  const matchQuery = {
    $or: [
      { nidHash: { $in: nidSet.map((x) => hashNid(x)) } },
      { fatherNidHash: { $in: nidSet.map((x) => hashNid(x)) } },
      { motherNidHash: { $in: nidSet.map((x) => hashNid(x)) } },
    ],
  };

  if (excludeId) {
    matchQuery._id = { $ne: excludeId };
  }

  const matches = await Consumer.find(matchQuery).select("_id familyId").lean();

  let familyId = matches.find((m) => m.familyId)?.familyId || null;

  if (!familyId && matches.length > 0) {
    const familyKey = crypto
      .createHash("sha256")
      .update(`FAMILY-${nidSet.sort().join("|")}`)
      .digest("hex");

    const existing = await Family.findOne({ familyKey });
    if (existing) {
      familyId = existing._id;
      if (!existing.flaggedDuplicate) {
        existing.flaggedDuplicate = true;
        await existing.save();
      }
    } else {
      const created = await Family.create({
        familyKey,
        fatherNidLast4: getLast4(fatherNidFull),
        motherNidLast4: getLast4(motherNidFull),
        flaggedDuplicate: true,
      });
      familyId = created._id;
    }
  }

  if (matches.length > 0 && familyId) {
    await Consumer.updateMany(
      { _id: { $in: matches.map((m) => m._id) } },
      { $set: { familyId } },
    );
    await Family.findByIdAndUpdate(familyId, { flaggedDuplicate: true });
  }

  return {
    familyId,
    hasDuplicate: matches.length > 0,
    matchedIds: matches.map((m) => String(m._id)),
  };
}

// @route   POST /api/consumers
// @desc    Add new consumer (Distributor only)
// @access  Private (Distributor)
exports.addConsumer = async (req, res) => {
  try {
    const {
      name,
      nidFull,
      fatherNidFull,
      motherNidFull,
      category,
      division,
      district,
      upazila,
      unionName,
      ward,
      status,
      guardianPhone,
      guardianName,
    } = req.body;

    // Validation
    if (!name || !nidFull || !fatherNidFull || !motherNidFull || !category) {
      return res.status(400).json({
        success: false,
        message:
          "Name, consumer NID, father NID, mother NID, and category are required",
      });
    }

    const normalizedNid = normalizeNid(nidFull);
    const normalizedFather = normalizeNid(fatherNidFull);
    const normalizedMother = normalizeNid(motherNidFull);

    if (!isValidNid(normalizedNid)) {
      return res.status(400).json({
        success: false,
        message: "Consumer NID must be 10/13/17 digits",
      });
    }
    if (!isValidNid(normalizedFather)) {
      return res.status(400).json({
        success: false,
        message: "Father NID must be 10/13/17 digits",
      });
    }
    if (!isValidNid(normalizedMother)) {
      return res.status(400).json({
        success: false,
        message: "Mother NID must be 10/13/17 digits",
      });
    }

    if (guardianPhone) {
      const bdPhone = /^01[3-9]\d{8}$/;
      if (!bdPhone.test(String(guardianPhone).trim())) {
        return res.status(400).json({
          success: false,
          message:
            "guardianPhone must be a valid Bangladesh number (01XXXXXXXXX)",
        });
      }
    }

    const distributor = await ensureDistributorProfile(req.user);
    if (!distributor) {
      return res.status(403).json({
        success: false,
        message: "Distributor profile not found",
      });
    }

    if (req.user.userType !== "Admin" && status === "Active") {
      return res.status(403).json({
        success: false,
        message: "Admin approval required to activate consumer",
      });
    }

    // Generate unique consumer code
    const consumerCode = await generateConsumerCode();
    const normalizedWard = normalizeWardNo(
      ward || distributor.wardNo || distributor.ward,
    );
    const normalizedDivision = normalizeDivision(
      division || distributor.division,
    );

    const qrDays = await getQrExpiryDays(req.user.userId);
    const now = new Date();
    const validTo = new Date(now.getTime() + qrDays * 86400000);

    const qrToken = buildArQrPayload({
      consumerCode,
      ward: normalizedWard,
      category,
      expiryDate: validTo,
    });

    // Create consumer
    const consumer = await Consumer.create({
      consumerCode,
      qrToken,
      name,
      nidLast4: getLast4(normalizedNid),
      nidFull: normalizedNid,
      fatherNidFull: normalizedFather,
      motherNidFull: normalizedMother,
      category,
      guardianPhone: guardianPhone ? String(guardianPhone).trim() : undefined,
      guardianName: guardianName ? String(guardianName).trim() : undefined,
      status: status || "Inactive",
      division: normalizedDivision,
      district: district || distributor.district,
      upazila: upazila || distributor.upazila,
      unionName: unionName || distributor.unionName,
      ward: normalizedWard,
      createdByDistributor: distributor._id,
    });

    const qrStatus =
      consumer.status === "Active"
        ? "Valid"
        : consumer.status === "Revoked"
          ? "Revoked"
          : "Invalid";

    const qr = await QRCode.create({
      payload: qrToken,
      payloadHash: sha256(qrToken),
      validFrom: now,
      validTo,
      status: qrStatus,
    });

    await OMSCard.create({
      consumerId: consumer._id,
      cardStatus:
        consumer.status === "Active"
          ? "Active"
          : consumer.status === "Revoked"
            ? "Revoked"
            : "Inactive",
      qrCodeId: qr._id,
    });

    const familyResult = await resolveFamilyByNids(
      {
        nidFull: normalizedNid,
        fatherNidFull: normalizedFather,
        motherNidFull: normalizedMother,
      },
      consumer._id,
    );

    if (familyResult.familyId) {
      consumer.familyId = familyResult.familyId;
      await consumer.save();
    }

    if (familyResult.hasDuplicate) {
      await writeAudit({
        actorUserId: req.user.userId,
        actorType: "Distributor",
        action: "Family duplicate NID detected",
        entityType: "Consumer",
        entityId: String(consumer._id),
        severity: "Warning",
        meta: {
          matchedConsumerIds: familyResult.matchedIds,
          nidLast4: getLast4(normalizedNid),
          fatherNidLast4: getLast4(normalizedFather),
          motherNidLast4: getLast4(normalizedMother),
        },
      });

      await notifyUser(req.user.userId, {
        title: "Family duplicate detected",
        message: `Family duplicate found for ${consumer.consumerCode}.`,
        meta: { consumerCode: consumer.consumerCode },
      });

      await notifyAdmins({
        title: "Family duplicate detected",
        message: `Family duplicate found for ${consumer.consumerCode}.`,
        meta: { consumerCode: consumer.consumerCode },
      });
    }

    res.status(201).json({
      success: true,
      message: "Consumer added successfully",
      data: {
        consumer: {
          _id: consumer._id,
          consumerCode: consumer.consumerCode,
          qrToken: consumer.qrToken,
          name: consumer.name,
          nidLast4: consumer.nidLast4,
          nidFull: decryptNid(consumer.nidFull),
          fatherNidFull: decryptNid(consumer.fatherNidFull),
          motherNidFull: decryptNid(consumer.motherNidFull),
          category: consumer.category,
          guardianPhone: consumer.guardianPhone,
          guardianName: consumer.guardianName,
          status: consumer.status,
          division: consumer.division,
          district: consumer.district,
          upazila: consumer.upazila,
          unionName: consumer.unionName,
          ward: consumer.ward,
          createdAt: consumer.createdAt,
        },
      },
    });
  } catch (error) {
    console.error("Add consumer error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while adding consumer",
    });
  }
};

// @route   GET /api/consumers
// @desc    Get all consumers (filtered by distributor's ward)
// @access  Private (Distributor, Admin)
exports.getConsumers = async (req, res) => {
  try {
    const { search, category, status, division, ward, wardNo } = req.query;
    const { page, limit } = parsePageLimit(req.query);

    // Build query
    let query = {};

    const distributor =
      req.user.userType === "Admin"
        ? null
        : await ensureDistributorProfile(req.user);
    if (req.user.userType !== "Admin" && !distributor) {
      return res.status(403).json({
        success: false,
        message: "Distributor profile not found",
      });
    }

    if (distributor) {
      Object.assign(query, buildDistributorScopeQuery(distributor));
    }

    if (division) {
      query.division =
        buildDivisionMatchQuery(division) || normalizeDivision(division);
    }

    const wardInput = wardNo || ward;
    if (wardInput) {
      const wardQuery = buildWardMatchQuery(wardInput);
      if (wardQuery?.$or) {
        if (query.$or) {
          query.$and = query.$and || [];
          query.$and.push({ $or: query.$or }, { $or: wardQuery.$or });
          delete query.$or;
        } else {
          query.$or = wardQuery.$or;
        }
      }
    }

    // Add search filter
    if (search) {
      const safeRegex = buildContainsRegex(search);
      if (!safeRegex) {
        return res.status(400).json({
          success: false,
          message: "Invalid search query",
          code: "VALIDATION_ERROR",
        });
      }

      const searchOr = [
        { name: safeRegex },
        { consumerCode: safeRegex },
        { nidLast4: safeRegex },
      ];

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    // Add category filter
    if (category) {
      query.category = category;
    }

    // Add status filter
    if (status) {
      query.status = status;
    }

    // Get total count
    const total = await Consumer.countDocuments(query);

    // Get paginated consumers
    const consumers = await Consumer.find(query)
      .populate("createdByDistributor", "name email")
      .populate("familyId", "flaggedDuplicate")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    const includeSensitive =
      req.user.userType === "Admin" &&
      String(req.query.includeSensitive || "") === "true";

    const consumersWithFlag = consumers.map((consumer) => ({
      ...withDecryptedNids(consumer, { includeSensitive }),
      familyFlag: Boolean(consumer.familyId?.flaggedDuplicate),
    }));

    res.status(200).json({
      success: true,
      data: {
        consumers: consumersWithFlag,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
    });
  } catch (error) {
    console.error("Get consumers error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching consumers",
    });
  }
};

// @route   GET /api/consumers/:id
// @desc    Get single consumer
// @access  Private
exports.getConsumerById = async (req, res) => {
  try {
    const consumer = await Consumer.findById(req.params.id)
      .populate("createdByDistributor", "name email")
      .populate("familyId");

    if (!consumer) {
      return res.status(404).json({
        success: false,
        message: "Consumer not found",
      });
    }

    if (req.user.userType !== "Admin") {
      const distributor = await ensureDistributorProfile(req.user);
      if (!distributor) {
        return res.status(403).json({
          success: false,
          message: "Distributor profile not found",
        });
      }

      if (!canAccessConsumerByScope(distributor, consumer)) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. This consumer does not belong to your division/ward.",
        });
      }
    }

    const includeSensitive =
      req.user.userType === "Admin" &&
      String(req.query.includeSensitive || "") === "true";

    res.status(200).json({
      success: true,
      data: {
        consumer: withDecryptedNids(consumer.toObject(), { includeSensitive }),
      },
    });
  } catch (error) {
    console.error("Get consumer error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching consumer",
    });
  }
};

// @route   PUT /api/consumers/:id
// @desc    Update consumer
// @access  Private (Distributor, Admin)
exports.updateConsumer = async (req, res) => {
  try {
    const { name, nidFull, fatherNidFull, motherNidFull, category, status } =
      req.body;

    const consumer = await Consumer.findById(req.params.id);

    if (!consumer) {
      return res.status(404).json({
        success: false,
        message: "Consumer not found",
      });
    }

    if (req.user.userType !== "Admin") {
      const distributor = await ensureDistributorProfile(req.user);
      if (!distributor) {
        return res.status(403).json({
          success: false,
          message: "Distributor profile not found",
        });
      }

      if (!canAccessConsumerByScope(distributor, consumer)) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. This consumer does not belong to your division/ward.",
        });
      }
    }

    const shouldRevalidateNids =
      Boolean(nidFull || fatherNidFull || motherNidFull) ||
      !consumer.nidFull ||
      !consumer.fatherNidFull ||
      !consumer.motherNidFull;

    if (shouldRevalidateNids) {
      const normalizedNid = normalizeNid(
        nidFull ?? decryptNid(consumer.nidFull),
      );
      const normalizedFather = normalizeNid(
        fatherNidFull ?? decryptNid(consumer.fatherNidFull),
      );
      const normalizedMother = normalizeNid(
        motherNidFull ?? decryptNid(consumer.motherNidFull),
      );

      if (!normalizedNid || !normalizedFather || !normalizedMother) {
        return res.status(400).json({
          success: false,
          message: "Consumer, father, and mother NID are required",
        });
      }

      if (!isValidNid(normalizedNid)) {
        return res.status(400).json({
          success: false,
          message: "Consumer NID must be 10/13/17 digits",
        });
      }
      if (!isValidNid(normalizedFather)) {
        return res.status(400).json({
          success: false,
          message: "Father NID must be 10/13/17 digits",
        });
      }
      if (!isValidNid(normalizedMother)) {
        return res.status(400).json({
          success: false,
          message: "Mother NID must be 10/13/17 digits",
        });
      }

      consumer.nidFull = normalizedNid;
      consumer.fatherNidFull = normalizedFather;
      consumer.motherNidFull = normalizedMother;
      consumer.nidLast4 = getLast4(normalizedNid);
    }

    const previousStatus = consumer.status;

    if (status && req.user.userType !== "Admin" && status === "Active") {
      return res.status(403).json({
        success: false,
        message: "Admin approval required to activate consumer",
      });
    }

    // Update fields
    if (name) consumer.name = name;
    if (category) consumer.category = category;
    if (status) consumer.status = status;

    const previousFamilyId = consumer.familyId
      ? String(consumer.familyId)
      : null;

    const familyResult = await resolveFamilyByNids(
      {
        nidFull: normalizeNid(decryptNid(consumer.nidFull)),
        fatherNidFull: normalizeNid(decryptNid(consumer.fatherNidFull)),
        motherNidFull: normalizeNid(decryptNid(consumer.motherNidFull)),
      },
      consumer._id,
    );

    if (familyResult.familyId) {
      consumer.familyId = familyResult.familyId;
    }

    await consumer.save();

    if (status && status !== previousStatus) {
      const card = await OMSCard.findOne({ consumerId: consumer._id });
      if (card) {
        card.cardStatus =
          consumer.status === "Active"
            ? "Active"
            : consumer.status === "Revoked"
              ? "Revoked"
              : "Inactive";
        await card.save();

        if (card.qrCodeId) {
          const qr = await QRCode.findById(card.qrCodeId);
          if (qr) {
            if (consumer.status === "Active") {
              if (qr.validTo && new Date() > qr.validTo) {
                qr.status = "Expired";
              } else {
                qr.status = "Valid";
              }
            } else if (consumer.status === "Revoked") {
              qr.status = "Revoked";
            } else {
              qr.status = "Invalid";
            }
            await qr.save();
          }
        }
      }

      await writeAudit({
        actorUserId: req.user.userId,
        actorType:
          req.user.userType === "Admin" ? "Central Admin" : "Distributor",
        action: "CONSUMER_STATUS_UPDATED",
        entityType: "Consumer",
        entityId: String(consumer._id),
        severity: status === "Active" ? "Info" : "Warning",
        meta: { from: previousStatus, to: status },
      });

      const distributor = consumer.createdByDistributor
        ? await Distributor.findById(consumer.createdByDistributor).lean()
        : null;

      if (distributor?.userId) {
        await notifyUser(distributor.userId, {
          title: "Consumer status updated",
          message: `${consumer.consumerCode} is now ${status}.`,
          meta: { consumerCode: consumer.consumerCode, status },
        });
      }

      if (req.user.userType !== "Admin") {
        await notifyAdmins({
          title: "Consumer status change requested",
          message: `${consumer.consumerCode} status updated to ${status} by distributor.`,
          meta: { consumerCode: consumer.consumerCode, status },
        });
      }
    }

    if (
      previousFamilyId &&
      familyResult.familyId &&
      previousFamilyId !== String(familyResult.familyId)
    ) {
      const remaining = await Consumer.countDocuments({
        familyId: previousFamilyId,
      });
      if (remaining <= 1) {
        await Family.findByIdAndUpdate(previousFamilyId, {
          flaggedDuplicate: false,
        });
      }
    }

    if (familyResult.hasDuplicate) {
      await writeAudit({
        actorUserId: req.user.userId,
        actorType:
          req.user.userType === "Admin" ? "Central Admin" : "Distributor",
        action: "Family duplicate NID detected",
        entityType: "Consumer",
        entityId: String(consumer._id),
        severity: "Warning",
        meta: {
          matchedConsumerIds: familyResult.matchedIds,
          nidLast4: consumer.nidLast4,
          fatherNidLast4: getLast4(decryptNid(consumer.fatherNidFull)),
          motherNidLast4: getLast4(decryptNid(consumer.motherNidFull)),
        },
      });

      await notifyUser(req.user.userId, {
        title: "Family duplicate detected",
        message: `Family duplicate found for ${consumer.consumerCode}.`,
        meta: { consumerCode: consumer.consumerCode },
      });

      await notifyAdmins({
        title: "Family duplicate detected",
        message: `Family duplicate found for ${consumer.consumerCode}.`,
        meta: { consumerCode: consumer.consumerCode },
      });
    }

    const includeSensitive =
      req.user.userType === "Admin" &&
      String(req.query.includeSensitive || "") === "true";

    res.status(200).json({
      success: true,
      message: "Consumer updated successfully",
      data: {
        consumer: withDecryptedNids(consumer.toObject(), { includeSensitive }),
      },
    });
  } catch (error) {
    console.error("Update consumer error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating consumer",
    });
  }
};

// @route   DELETE /api/consumers/:id
// @desc    Delete consumer
// @access  Private (Admin only)
exports.deleteConsumer = async (req, res) => {
  try {
    const consumer = await Consumer.findById(req.params.id);

    if (!consumer) {
      return res.status(404).json({
        success: false,
        message: "Consumer not found",
      });
    }

    if (req.user.userType !== "Admin") {
      const distributor = await ensureDistributorProfile(req.user);
      if (!distributor) {
        return res.status(403).json({
          success: false,
          message: "Distributor profile not found",
        });
      }

      if (!canAccessConsumerByScope(distributor, consumer)) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to delete this consumer",
        });
      }
    }

    await Consumer.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Consumer deleted successfully",
    });
  } catch (error) {
    console.error("Delete consumer error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting consumer",
    });
  }
};

// @route   GET /api/consumers/stats
// @desc    Get consumer statistics
// @access  Private (Distributor, Admin)
exports.getConsumerStats = async (req, res) => {
  try {
    let query = {};

    const distributor =
      req.user.userType === "Admin"
        ? null
        : await ensureDistributorProfile(req.user);
    if (req.user.userType !== "Admin" && !distributor) {
      return res.status(403).json({
        success: false,
        message: "Distributor profile not found",
      });
    }

    if (distributor) {
      Object.assign(query, buildDistributorScopeQuery(distributor));
    }

    const stats = {
      total: await Consumer.countDocuments(query),
      active: await Consumer.countDocuments({ ...query, status: "Active" }),
      inactive: await Consumer.countDocuments({ ...query, status: "Inactive" }),
      revoked: await Consumer.countDocuments({ ...query, status: "Revoked" }),
      categoryA: await Consumer.countDocuments({ ...query, category: "A" }),
      categoryB: await Consumer.countDocuments({ ...query, category: "B" }),
      categoryC: await Consumer.countDocuments({ ...query, category: "C" }),
    };

    res.status(200).json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching statistics",
    });
  }
};

// @route   GET /api/consumers/cards
// @desc    List consumer card + QR status (admin/distributor)
// @access  Private
exports.listConsumerCards = async (req, res) => {
  try {
    const { search, cardStatus, qrStatus, division, ward, wardNo } = req.query;
    const withImage = String(req.query.withImage || "false") === "true";
    const { page, limit } = parsePageLimit(req.query);

    const distributor =
      req.user.userType === "Admin"
        ? null
        : await ensureDistributorProfile(req.user);

    if (req.user.userType !== "Admin" && !distributor) {
      return res.status(403).json({
        success: false,
        message: "Distributor profile not found",
      });
    }

    const query = {};
    if (distributor) {
      Object.assign(query, buildDistributorScopeQuery(distributor));
    } else {
      const requestedDivision = normalizeDivision(division);
      const requestedWard = normalizeWardNo(wardNo || ward);

      if (requestedWard && !requestedDivision) {
        return res.status(400).json({
          success: false,
          message: "ওয়ার্ড ফিল্টার ব্যবহার করতে বিভাগ একসাথে দিতে হবে",
          code: "VALIDATION_ERROR",
        });
      }

      if (requestedDivision) {
        query.division = requestedDivision;
      }
      if (requestedWard) {
        query.ward = requestedWard;
      }
    }

    if (search) {
      const safeRegex = buildContainsRegex(search);
      if (!safeRegex) {
        return res.status(400).json({
          success: false,
          message: "Invalid search query",
          code: "VALIDATION_ERROR",
        });
      }

      const searchOr = [
        { name: safeRegex },
        { consumerCode: safeRegex },
        { nidLast4: safeRegex },
      ];

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    const total = await Consumer.countDocuments(query);

    const consumers = await Consumer.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const consumerIds = consumers.map((c) => c._id);
    const cards = await OMSCard.find({ consumerId: { $in: consumerIds } })
      .populate("qrCodeId")
      .lean();

    const cardMap = new Map(
      cards.map((card) => [String(card.consumerId), card]),
    );

    const baseRows = consumers.map((consumer) => {
      const card = cardMap.get(String(consumer._id));
      const qr =
        card?.qrCodeId && typeof card.qrCodeId === "object"
          ? card.qrCodeId
          : null;

      return {
        consumerId: String(consumer._id),
        consumerCode: consumer.consumerCode,
        name: consumer.name,
        category: consumer.category,
        division: consumer.division,
        ward: consumer.ward,
        unionName: consumer.unionName,
        upazila: consumer.upazila,
        cardId: card?._id ? String(card._id) : null,
        cardStatus: card?.cardStatus || "Inactive",
        qrCodeId: qr?._id ? String(qr._id) : null,
        qrStatus: qr?.status || "Invalid",
        validFrom: qr?.validFrom || null,
        validTo: qr?.validTo || null,
        qrPayload: qr?.payload || consumer.qrToken || "",
        photoUrl: consumer.photoPath
          ? `/api/photos/${consumer.consumerCode}`
          : null,
        createdAt: consumer.createdAt,
      };
    });

    const filteredRows = baseRows.filter((row) => {
      const cardMatch = cardStatus ? row.cardStatus === cardStatus : true;
      const qrMatch = qrStatus ? row.qrStatus === qrStatus : true;
      return cardMatch && qrMatch;
    });

    const rows = withImage
      ? await Promise.all(
          filteredRows.map(async (row) => ({
            ...row,
            qrImageDataUrl: await buildQrImageDataUrl(row.qrPayload),
          })),
        )
      : filteredRows;

    return res.json({
      success: true,
      data: {
        rows,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
    });
  } catch (error) {
    console.error("listConsumerCards error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// @route   GET /api/consumers/:id/card
// @desc    Get single consumer card with QR image
// @access  Private
exports.getConsumerCard = async (req, res) => {
  try {
    const distributor =
      req.user.userType === "Admin"
        ? null
        : await ensureDistributorProfile(req.user);

    if (req.user.userType !== "Admin" && !distributor) {
      return res.status(403).json({
        success: false,
        message: "Distributor profile not found",
      });
    }

    const consumer = await Consumer.findById(req.params.id).lean();
    if (!consumer) {
      return res
        .status(404)
        .json({ success: false, message: "Consumer not found" });
    }

    if (distributor && !canAccessConsumerByScope(distributor, consumer)) {
      return res.status(403).json({
        success: false,
        message: "Not allowed to access this card",
      });
    }

    const card = await OMSCard.findOne({ consumerId: consumer._id })
      .populate("qrCodeId")
      .lean();

    if (!card) {
      return res
        .status(404)
        .json({ success: false, message: "Card not found" });
    }

    const qr =
      card.qrCodeId && typeof card.qrCodeId === "object" ? card.qrCodeId : null;
    const qrPayload = qr?.payload || consumer.qrToken || "";
    const qrImageDataUrl = await buildQrImageDataUrl(qrPayload);

    return res.json({
      success: true,
      data: {
        card: {
          consumerId: String(consumer._id),
          consumerCode: consumer.consumerCode,
          name: consumer.name,
          category: consumer.category,
          division: consumer.division,
          ward: consumer.ward,
          unionName: consumer.unionName,
          upazila: consumer.upazila,
          cardId: String(card._id),
          cardStatus: card.cardStatus,
          qrCodeId: qr?._id ? String(qr._id) : null,
          qrStatus: qr?.status || "Invalid",
          validFrom: qr?.validFrom || null,
          validTo: qr?.validTo || null,
          qrPayload,
          qrImageDataUrl,
          photoUrl: consumer.photoPath
            ? `/api/photos/${consumer.consumerCode}`
            : null,
          issuedAt: card.createdAt,
          updatedAt: card.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("getConsumerCard error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// @route   DELETE /api/consumers/:id/card
// @desc    Remove consumer OMS card (admin only)
// @access  Private (Admin)
exports.deleteConsumerCard = async (req, res) => {
  try {
    if (req.user.userType !== "Admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can remove cards",
      });
    }

    const consumer = await Consumer.findById(req.params.id)
      .select("_id consumerCode createdByDistributor")
      .lean();
    if (!consumer) {
      return res.status(404).json({
        success: false,
        message: "Consumer not found",
      });
    }

    const card = await OMSCard.findOne({ consumerId: consumer._id });
    if (!card) {
      return res.status(404).json({
        success: false,
        message: "OMS card not found for this consumer",
      });
    }

    const previousQrId = card.qrCodeId ? String(card.qrCodeId) : null;
    if (card.qrCodeId) {
      await QRCode.findByIdAndUpdate(card.qrCodeId, { status: "Revoked" });
    }

    await OMSCard.deleteOne({ _id: card._id });

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Central Admin",
      action: "CONSUMER_CARD_REMOVED",
      entityType: "Consumer",
      entityId: String(consumer._id),
      severity: "Warning",
      meta: {
        consumerCode: consumer.consumerCode,
        cardId: String(card._id),
        previousQrId,
      },
    });

    if (consumer.createdByDistributor) {
      const createdByDistributor = await Distributor.findById(
        consumer.createdByDistributor,
      )
        .select("userId")
        .lean();

      if (createdByDistributor?.userId) {
        await notifyUser(createdByDistributor.userId, {
          title: "Consumer card removed",
          message: `OMS card removed for ${consumer.consumerCode}.`,
          meta: {
            consumerId: String(consumer._id),
            consumerCode: consumer.consumerCode,
          },
        });
      }
    }

    return res.json({
      success: true,
      message: "Consumer card removed successfully",
      data: {
        consumerId: String(consumer._id),
        consumerCode: consumer.consumerCode,
        removedCardId: String(card._id),
      },
    });
  } catch (error) {
    console.error("deleteConsumerCard error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while removing card",
    });
  }
};

// @route   POST /api/consumers/:id/card/reissue
// @desc    Reissue consumer QR card (admin only)
// @access  Private (Admin)
exports.reissueConsumerCard = async (req, res) => {
  try {
    if (req.user.userType !== "Admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can reissue cards",
      });
    }

    const consumer = await Consumer.findById(req.params.id).lean();
    if (!consumer) {
      return res.status(404).json({
        success: false,
        message: "Consumer not found",
      });
    }

    const card = await OMSCard.findOne({ consumerId: consumer._id });
    if (!card) {
      return res.status(404).json({
        success: false,
        message: "OMS card not found for this consumer",
      });
    }

    const previousQrId = card.qrCodeId ? String(card.qrCodeId) : null;
    if (card.qrCodeId) {
      await QRCode.findByIdAndUpdate(card.qrCodeId, { status: "Revoked" });
    }

    const createdByDistributor = consumer.createdByDistributor
      ? await Distributor.findById(consumer.createdByDistributor)
          .select("userId")
          .lean()
      : null;

    const qrDays = await getQrExpiryDays(
      createdByDistributor?.userId || req.user.userId,
    );

    const now = new Date();
    const validTo = new Date(now.getTime() + qrDays * 86400000);

    const newQrToken = buildArQrPayload({
      consumerCode: consumer.consumerCode,
      ward: consumer.ward || consumer.wardNo,
      category: consumer.category,
      expiryDate: validTo,
    });

    const newQr = await QRCode.create({
      payload: newQrToken,
      payloadHash: sha256(newQrToken),
      validFrom: now,
      validTo,
      status: consumer.status === "Active" ? "Valid" : "Invalid",
    });

    card.qrCodeId = newQr._id;
    card.cardStatus = consumer.status === "Active" ? "Active" : "Inactive";
    await card.save();

    await Consumer.findByIdAndUpdate(consumer._id, { qrToken: newQrToken });

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: "Central Admin",
      action: "CONSUMER_QR_REISSUED",
      entityType: "Consumer",
      entityId: String(consumer._id),
      severity: "Info",
      meta: {
        consumerCode: consumer.consumerCode,
        previousQrId,
        newQrId: String(newQr._id),
        validTo,
      },
    });

    if (createdByDistributor?.userId) {
      await notifyUser(createdByDistributor.userId, {
        title: "Consumer QR reissued",
        message: `QR reissued for ${consumer.consumerCode}.`,
        meta: {
          consumerId: String(consumer._id),
          consumerCode: consumer.consumerCode,
        },
      });
    }

    res.status(201).json({
      success: true,
      message: "Consumer card reissued successfully",
      data: {
        consumerId: String(consumer._id),
        consumerCode: consumer.consumerCode,
        qrCodeId: String(newQr._id),
        qrToken: newQrToken,
        validTo,
      },
    });
  } catch (error) {
    console.error("reissueConsumerCard error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while reissuing card",
    });
  }
};
