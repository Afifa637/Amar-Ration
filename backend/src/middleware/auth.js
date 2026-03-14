const jwt = require("jsonwebtoken");

// Middleware to verify JWT token
exports.protect = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        success: false, 
        message: "No token provided. Authorization denied." 
      });
    }

    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add user info to request object
    req.user = {
      userId: decoded.userId,
      userType: decoded.userType
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ 
        success: false, 
        message: "Token expired. Please login again." 
      });
    }
    
    return res.status(401).json({ 
      success: false, 
      message: "Invalid token. Authorization denied." 
    });
  }
};

// Middleware to check user type
exports.authorize = (...allowedUserTypes) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: "User not authenticated" 
      });
    }

    if (!allowedUserTypes.includes(req.user.userType)) {
      return res.status(403).json({ 
        success: false, 
        message: `Access denied. Only ${allowedUserTypes.join(", ")} can access this resource.` 
      });
    }

    next();
  };
};
