"use strict";

const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
  listInactive,
  reactivate,
  deactivate,
  eligibilityStats,
  runEligibilityFlag,
} = require("../controllers/qrRotation.controller");

router.get("/inactive", protect, authorize("Admin"), listInactive);
router.patch(
  "/:consumerId/reactivate",
  protect,
  authorize("Admin"),
  reactivate,
);
router.patch(
  "/:consumerId/deactivate",
  protect,
  authorize("Admin"),
  deactivate,
);
router.get("/stats", protect, authorize("Admin"), eligibilityStats);
router.post("/flag-now", protect, authorize("Admin"), runEligibilityFlag);

module.exports = router;
