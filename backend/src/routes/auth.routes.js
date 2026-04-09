const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth");

// Public routes
router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.get("/password-change/ack", authController.acknowledgePasswordChange);

// Protected routes
router.get("/me", protect, authController.getMe);
router.put("/change-password", protect, authController.changePassword);

module.exports = router;
