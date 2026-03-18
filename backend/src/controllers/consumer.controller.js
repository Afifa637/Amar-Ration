const crypto = require("crypto");
const Consumer = require("../models/Consumer");
const Family = require("../models/Family");
const OMSCard = require("../models/OMSCard");
const QRCode = require("../models/QRCode");
const SystemSetting = require("../models/SystemSetting");
const User = require("../models/User");
const Distributor = require("../models/Distributor");
const { writeAudit } = require("../services/audit.service");
const {
  notifyAdmins,
  notifyUser,
} = require("../services/notification.service");

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

// Generate unique consumer code
const generateConsumerCode = async () => {
  const lastConsumer = await Consumer.findOne()
    .sort({ createdAt: -1 })
    .select("consumerCode");

  if (lastConsumer && lastConsumer.consumerCode) {
    const lastNumber = parseInt(lastConsumer.consumerCode.substring(1));
    return `C${String(lastNumber + 1).padStart(4, "0")}`;
  }
  return "C0001";
};

// Generate unique QR token
const generateQRToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

const NID_LENGTHS = new Set([10, 13, 17]);

function normalizeNid(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidNid(value) {
  return NID_LENGTHS.has(value.length);
}

function getLast4(value) {
  return value.slice(-4);
}

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
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
      { nidFull: { $in: nidSet } },
      { fatherNidFull: { $in: nidSet } },
      { motherNidFull: { $in: nidSet } },
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

    const distributor = await ensureDistributorProfile(req.user);
    if (!distributor) {
      return res.status(403).json({
        success: false,
        message: "Distributor profile not found",
      });
    }

    // Generate unique consumer code and QR token
    const consumerCode = await generateConsumerCode();
    const qrToken = generateQRToken();

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
      status: status || "Inactive",
      division: division || req.user.division,
      district: district || req.user.district,
      upazila: upazila || req.user.upazila,
      unionName: unionName || req.user.unionName,
      ward: ward || req.user.ward,
      createdByDistributor: distributor._id,
    });

    const qrDays = await getQrExpiryDays(req.user.userId);
    const now = new Date();
    const validTo = new Date(now.getTime() + qrDays * 86400000);
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
          nidFull: normalizedNid,
          fatherNidFull: normalizedFather,
          motherNidFull: normalizedMother,
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
          nidFull: consumer.nidFull,
          fatherNidFull: consumer.fatherNidFull,
          motherNidFull: consumer.motherNidFull,
          category: consumer.category,
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
    const { page = 1, limit = 10, search, category, status } = req.query;

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
      query.createdByDistributor = distributor._id;
    }

    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { consumerCode: { $regex: search, $options: "i" } },
        { nidLast4: { $regex: search, $options: "i" } },
      ];
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
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const consumersWithFlag = consumers.map((consumer) => ({
      ...consumer,
      familyFlag: Boolean(consumer.familyId?.flaggedDuplicate),
    }));

    res.status(200).json({
      success: true,
      data: {
        consumers: consumersWithFlag,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
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

    res.status(200).json({
      success: true,
      data: { consumer },
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

    const shouldRevalidateNids =
      Boolean(nidFull || fatherNidFull || motherNidFull) ||
      !consumer.nidFull ||
      !consumer.fatherNidFull ||
      !consumer.motherNidFull;

    if (shouldRevalidateNids) {
      const normalizedNid = normalizeNid(nidFull ?? consumer.nidFull);
      const normalizedFather = normalizeNid(
        fatherNidFull ?? consumer.fatherNidFull,
      );
      const normalizedMother = normalizeNid(
        motherNidFull ?? consumer.motherNidFull,
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
        nidFull: consumer.nidFull,
        fatherNidFull: consumer.fatherNidFull,
        motherNidFull: consumer.motherNidFull,
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
          nidFull: consumer.nidFull,
          fatherNidFull: consumer.fatherNidFull,
          motherNidFull: consumer.motherNidFull,
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

    res.status(200).json({
      success: true,
      message: "Consumer updated successfully",
      data: { consumer },
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

      if (
        !consumer.createdByDistributor ||
        String(consumer.createdByDistributor) !== String(distributor._id)
      ) {
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
      query.createdByDistributor = distributor._id;
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
