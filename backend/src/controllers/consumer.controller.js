const crypto = require("crypto");
const Consumer = require("../models/Consumer");
const Family = require("../models/Family");
const User = require("../models/User");
const Distributor = require("../models/Distributor");

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

// @route   POST /api/consumers
// @desc    Add new consumer (Distributor only)
// @access  Private (Distributor)
exports.addConsumer = async (req, res) => {
  try {
    const {
      name,
      nidLast4,
      category,
      division,
      district,
      upazila,
      unionName,
      ward,
      familyId,
    } = req.body;

    // Validation
    if (!name || !nidLast4 || !category) {
      return res.status(400).json({
        success: false,
        message: "Name, NID last 4 digits, and category are required",
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
      nidLast4,
      category,
      status: "Active",
      division: division || req.user.division,
      district: district || req.user.district,
      upazila: upazila || req.user.upazila,
      unionName: unionName || req.user.unionName,
      ward: ward || req.user.ward,
      createdByDistributor: distributor._id,
      familyId: familyId || null,
    });

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
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.status(200).json({
      success: true,
      data: {
        consumers,
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
    const { name, nidLast4, category, status } = req.body;

    const consumer = await Consumer.findById(req.params.id);

    if (!consumer) {
      return res.status(404).json({
        success: false,
        message: "Consumer not found",
      });
    }

    // Update fields
    if (name) consumer.name = name;
    if (nidLast4) consumer.nidLast4 = nidLast4;
    if (category) consumer.category = category;
    if (status) consumer.status = status;

    await consumer.save();

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
    if (req.user.userType !== "Admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can delete consumers",
      });
    }

    const consumer = await Consumer.findByIdAndDelete(req.params.id);

    if (!consumer) {
      return res.status(404).json({
        success: false,
        message: "Consumer not found",
      });
    }

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
