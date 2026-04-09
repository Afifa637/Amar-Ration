const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Middleware to verify JWT token
exports.protect = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided.",
      });
    }

    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId)
      .select("status authorityStatus userType tokenVersion")
      .lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists.",
      });
    }

    if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({
        success: false,
        message: "Session invalidated. Please login again.",
        code: "TOKEN_INVALIDATED",
      });
    }

    if (user.status !== "Active") {
      return res.status(403).json({
        success: false,
        message: "Account is suspended or disabled. Contact administrator.",
        code: "ACCOUNT_INACTIVE",
      });
    }

    if (["Distributor", "FieldUser"].includes(user.userType)) {
      if (user.authorityStatus !== "Active") {
        return res.status(403).json({
          success: false,
          message: "Distribution authority is not active.",
          code: "AUTHORITY_INACTIVE",
        });
      }
    }

    // Add user info to request object
    req.user = {
      userId: decoded.userId,
      userType: user.userType,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid token.",
    });
  }
};

// Middleware to check user type
exports.authorize = (...allowedUserTypes) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!allowedUserTypes.includes(req.user.userType)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Only ${allowedUserTypes.join(", ")} can access this resource.`,
      });
    }

    next();
  };
};
