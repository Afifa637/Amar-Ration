"use strict";

const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getDistributorScore,
  getReport,
  getTopRisky,
  getMonthlyDistributorPerformance,
  getMonthlyAllPerformance,
} = require("../controllers/fraudScore.controller");

router.get(
  "/distributor/:distributorId",
  protect,
  authorize("Admin"),
  getDistributorScore,
);
router.get("/report", protect, authorize("Admin"), getReport);
router.get("/top-risky", protect, authorize("Admin"), getTopRisky);
router.get(
  "/monthly/:distributorId",
  protect,
  authorize("Admin"),
  getMonthlyDistributorPerformance,
);
router.get(
  "/monthly-all",
  protect,
  authorize("Admin"),
  getMonthlyAllPerformance,
);

module.exports = router;
