const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.sub).select("_id userType status").lean();
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.status !== "Active") return res.status(401).json({ message: "Unauthorized" });

    req.user = { id: String(user._id), userType: user.userType };
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

module.exports = { auth };
