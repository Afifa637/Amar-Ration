const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { protect, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { loginSchema, changePasswordSchema } = require("../validation/schemas");

// Public routes
router.post("/signup", authController.signup);
router.post("/login", validate(loginSchema), authController.login);
router.post("/refresh", authController.refreshAccessToken);
router.get("/password-change/ack", authController.acknowledgePasswordChange);

// Protected routes
router.get("/me", protect, authController.getMe);
router.put(
  "/change-password",
  protect,
  validate(changePasswordSchema),
  authController.changePassword,
);
router.post("/logout", protect, authController.logout);
router.get(
  "/2fa/status",
  protect,
  authorize("Admin"),
  authController.get2FAStatus,
);
router.post("/2fa/setup", protect, authorize("Admin"), authController.setup2FA);
router.get(
  "/2fa/setup",
  protect,
  authorize("Admin"),
  authController.setup2FAGetDeprecated,
);
router.post(
  "/2fa/setup/reset",
  protect,
  authorize("Admin"),
  authController.reset2FASetup,
);
router.post(
  "/2fa/verify",
  protect,
  authorize("Admin"),
  authController.verify2FA,
);
router.post(
  "/2fa/disable",
  protect,
  authorize("Admin"),
  authController.disable2FA,
);

module.exports = router;
