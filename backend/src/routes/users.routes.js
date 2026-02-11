const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");

// @route   GET /api/users
// @desc    Get all users (Admin only)
// @access  Protected - Admin
router.get("/", protect, authorize("Admin"), async (req, res) => {
  try {
    const users = await User.find().select("-passwordHash");
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message
    });
  }
});

// @route   GET /api/users/stats
// @desc    Get user statistics by type
// @access  Protected - Admin
router.get("/stats", protect, authorize("Admin"), async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: "$userType",
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: error.message
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get single user by ID
// @access  Protected - Admin or self
router.get("/:id", protect, async (req, res) => {
  try {
    // Allow users to view their own profile or admins to view any
    if (req.user.userType !== "Admin" && req.user.userId !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const user = await User.findById(req.params.id).select("-passwordHash");
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message
    });
  }
});

module.exports = router;
