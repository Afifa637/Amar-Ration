const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "টোকেন পাওয়া যায়নি। আবার লগইন করুন।",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.sub)
      .select("_id userType status")
      .lean();
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.status !== "Active")
      return res.status(401).json({ message: "Unauthorized" });

    req.user = { userId: String(user._id), userType: user.userType };
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "টোকেনের মেয়াদ শেষ। আবার লগইন করুন।",
      });
    }

    return res.status(401).json({
      success: false,
      message: "অবৈধ টোকেন। Authorization denied.",
    });
  }
}

exports.protect = auth;

// Middleware to check user type
exports.authorize = (...allowedUserTypes) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "ব্যবহারকারী প্রমানিত হয়নি",
      });
    }

    if (!allowedUserTypes.includes(req.user.userType)) {
      return res.status(403).json({
        success: false,
        message: `এই রিসোর্সে আপনার অনুমতি নেই. Only ${allowedUserTypes.join(", ")} can access this resource.`,
      });
    }

    next();
  };
};
