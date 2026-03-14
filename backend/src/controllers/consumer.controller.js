const crypto = require("crypto");
const Consumer = require("../models/Consumer");
const User = require("../models/User");
const Distributor = require("../models/Distributor");

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

const getActorContext = async (reqUser) => {
  const user = await User.findById(reqUser.userId).lean();
  if (!user) return { user: null, distributor: null };

  let distributor = null;
  if (user.userType === "Distributor" || user.userType === "FieldUser") {
    distributor = await Distributor.findOne({ userId: user._id });

    if (!distributor) {
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
    }
  }

  return { user, distributor };
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
      status,
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

    if (
      !["Distributor", "FieldUser", "Central-Admin"].includes(req.user.userType)
    ) {
      return res.status(403).json({
        success: false,
        message: "Only distributor roles can add consumers",
      });
    }

    const { user, distributor } = await getActorContext(req.user);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
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
      status: status || "Inactive",
      division: division || user.division,
      district: district || user.district,
      upazila: upazila || user.upazila,
      unionName: unionName || user.unionName,
      ward: ward || user.ward,
      createdByDistributor: distributor?._id,
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
    const { page = 1, limit = 10, search, category, status, ward } = req.query;
    const { user, distributor } = await getActorContext(req.user);

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    // Build query
    const query = {};

    // If distributor/field user, always scope by distributor ownership
    if (
      (user.userType === "Distributor" || user.userType === "FieldUser") &&
      distributor?._id
    ) {
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

    if (ward) {
      query.ward = ward;
    }

    // Get total count
    const total = await Consumer.countDocuments(query);

    // Get paginated consumers
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(1000, Math.max(1, Number(limit) || 10));

    const consumers = await Consumer.find(query)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum);

    res.status(200).json({
      success: true,
      data: {
        consumers,
        pagination: {
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum),
          limit: limitNum,
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
    const { user, distributor } = await getActorContext(req.user);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    const consumer = await Consumer.findById(req.params.id).populate(
      "familyId",
    );

    if (!consumer) {
      return res.status(404).json({
        success: false,
        message: "Consumer not found",
      });
    }

    if (
      (user.userType === "Distributor" || user.userType === "FieldUser") &&
      distributor?._id &&
      String(consumer.createdByDistributor || "") !== String(distributor._id)
    ) {
      return res.status(403).json({
        success: false,
        message: "This consumer is outside your authority",
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
    const { name, nidLast4, category, status, ward } = req.body;
    const { user, distributor } = await getActorContext(req.user);

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    const consumer = await Consumer.findById(req.params.id);

    if (!consumer) {
      return res.status(404).json({
        success: false,
        message: "Consumer not found",
      });
    }

    if (
      (user.userType === "Distributor" || user.userType === "FieldUser") &&
      distributor?._id &&
      String(consumer.createdByDistributor || "") !== String(distributor._id)
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only update consumers in your authority",
      });
    }

    // Update fields
    if (name) consumer.name = name;
    if (nidLast4) consumer.nidLast4 = nidLast4;
    if (category) consumer.category = category;
    if (status) consumer.status = status;
    if (ward) consumer.ward = ward;

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
    const { user, distributor } = await getActorContext(req.user);

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    if (!["Admin", "Distributor", "FieldUser"].includes(user.userType)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const consumer = await Consumer.findById(req.params.id);

    if (!consumer) {
      return res.status(404).json({
        success: false,
        message: "Consumer not found",
      });
    }

    if (
      (user.userType === "Distributor" || user.userType === "FieldUser") &&
      distributor?._id &&
      String(consumer.createdByDistributor || "") !== String(distributor._id)
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only delete consumers in your authority",
      });
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
    const { user, distributor } = await getActorContext(req.user);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    const query = {};

    // If distributor/field user, always scope by distributor ownership
    if (
      (user.userType === "Distributor" || user.userType === "FieldUser") &&
      distributor?._id
    ) {
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
