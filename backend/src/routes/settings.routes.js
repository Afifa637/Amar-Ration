const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");

// Placeholder for settings routes
// Only Admin can access settings
router.get("/", protect, authorize("Admin"), (req, res) => {
  res.json({ message: "Settings endpoint - coming soon" });
});

module.exports = router;
