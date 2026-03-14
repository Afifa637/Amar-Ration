const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getMySettings,
  updateMySettings,
  resetMySettings,
  updateMyProfile,
  changeMyPassword,
} = require("../controllers/settings.controller");

router.get(
  "/",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  getMySettings,
);
router.put(
  "/",
  protect,
  authorize("Distributor", "FieldUser"),
  updateMySettings,
);
router.post(
  "/reset",
  protect,
  authorize("Distributor", "FieldUser"),
  resetMySettings,
);
router.put(
  "/profile",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  updateMyProfile,
);
router.put(
  "/password",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  changeMyPassword,
);

module.exports = router;
