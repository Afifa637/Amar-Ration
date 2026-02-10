const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");

// Generate JWT Token
const generateToken = (userId, userType) => {
  return jwt.sign(
    { userId, userType },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "2h" }
  );
};

// Generate unique QR token for consumer
const generateQRToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

// @route   POST /api/auth/signup
// @desc    Register new user (Admin, Distributor, FieldUser, or Consumer)
// @access  Public
exports.signup = async (req, res) => {
  try {
    const { userType, name, email, phone, password, ...additionalFields } = req.body;

    // Validation
    if (!userType || !name || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "UserType, name, and password are required" 
      });
    }

    if (!["Admin", "Distributor", "FieldUser", "Consumer"].includes(userType)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid user type. Must be Admin, Distributor, FieldUser, or Consumer" 
      });
    }

    // Check if email or phone is provided
    if (!email && !phone) {
      return res.status(400).json({ 
        success: false, 
        message: "Either email or phone is required" 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        email ? { email } : null,
        phone ? { phone } : null
      ].filter(Boolean)
    });

    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: "User with this email or phone already exists" 
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate consumer code and QR token if user type is Consumer
    let consumerCode;
    let qrToken;
    if (userType === "Consumer") {
      const lastConsumer = await User.findOne({ userType: "Consumer" })
        .sort({ createdAt: -1 })
        .select("consumerCode");
      
      if (lastConsumer && lastConsumer.consumerCode) {
        const lastNumber = parseInt(lastConsumer.consumerCode.substring(1));
        consumerCode = `C${String(lastNumber + 1).padStart(4, "0")}`;
      } else {
        consumerCode = "C0001";
      }

      // Generate unique QR token for consumer
      qrToken = generateQRToken();
    }

    // Create user object
    const userData = {
      userType,
      name,
      email,
      phone,
      passwordHash,
      status: "Active"
    };

    // Add user-type specific fields
    if (userType === "Consumer") {
      userData.consumerCode = consumerCode;
      userData.qrToken = qrToken;
      userData.nidLast4 = additionalFields.nidLast4;
      userData.category = additionalFields.category || "A";
    } else if (userType === "Distributor") {
      userData.wardNo = additionalFields.wardNo;
      userData.officeAddress = additionalFields.officeAddress;
      userData.division = additionalFields.division;
      userData.district = additionalFields.district;
      userData.upazila = additionalFields.upazila;
      userData.unionName = additionalFields.unionName;
      userData.ward = additionalFields.ward;
      userData.authorityStatus = "Active";
      userData.authorityFrom = new Date();
    } else if (userType === "FieldUser") {
      userData.wardNo = additionalFields.wardNo;
      userData.division = additionalFields.division;
      userData.district = additionalFields.district;
      userData.upazila = additionalFields.upazila;
      userData.unionName = additionalFields.unionName;
      userData.ward = additionalFields.ward;
      userData.authorityStatus = "Active";
      userData.authorityFrom = new Date();
    }

    // Save user to database
    const user = await User.create(userData);

    // Generate token
    const token = generateToken(user._id, user.userType);

    // Prepare response (exclude password)
    const userResponse = {
      _id: user._id,
      userType: user.userType,
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      ...(userType === "Consumer" && { 
        consumerCode: user.consumerCode,
        category: user.category,
        qrToken: user.qrToken
      }),
      ...(userType === "Distributor" && {
        wardNo: user.wardNo,
        officeAddress: user.officeAddress,
        division: user.division,
        district: user.district,
        upazila: user.upazila,
        unionName: user.unionName,
        ward: user.ward
      }),
      ...(userType === "FieldUser" && {
        wardNo: user.wardNo,
        division: user.division,
        district: user.district,
        upazila: user.upazila,
        unionName: user.unionName,
        ward: user.ward
      })
    };

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error registering user",
      error: error.message 
    });
  }
};

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier can be email, phone, or consumerCode

    // Validation
    if (!identifier || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Identifier (email/phone/consumerCode) and password are required" 
      });
    }

    // Find user by email, phone, or consumerCode
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { phone: identifier },
        { consumerCode: identifier }
      ]
    });

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }

    // Check if user is active
    if (user.status !== "Active") {
      return res.status(403).json({ 
        success: false, 
        message: `Account is ${user.status}. Please contact administrator.` 
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id, user.userType);

    // Prepare response
    const userResponse = {
      _id: user._id,
      userType: user.userType,
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      ...(user.userType === "Consumer" && { 
        consumerCode: user.consumerCode,
        category: user.category,
        qrToken: user.qrToken
      }),
      ...(user.userType === "Distributor" && {
        wardNo: user.wardNo,
        officeAddress: user.officeAddress,
        division: user.division,
        district: user.district,
        upazila: user.upazila,
        unionName: user.unionName,
        ward: user.ward,
        authorityStatus: user.authorityStatus
      }),
      ...(user.userType === "FieldUser" && {
        wardNo: user.wardNo,
        division: user.division,
        district: user.district,
        upazila: user.upazila,
        unionName: user.unionName,
        ward: user.ward,
        authorityStatus: user.authorityStatus
      })
    };

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error logging in",
      error: error.message 
    });
  }
};

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    res.status(200).json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching user profile",
      error: error.message 
    });
  }
};

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: "Current password and new password are required" 
      });
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: "Current password is incorrect" 
      });
    }

    // Hash new password
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });

  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error changing password",
      error: error.message 
    });
  }
};
