"use strict";

const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
  streamLiveHealth,
  downloadReconciliationReport,
  generateReportManually,
} = require("../controllers/sessionHealth.controller");

router.get(
  "/:sessionId/live",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  streamLiveHealth,
);
router.get(
  "/:sessionId/report",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  downloadReconciliationReport,
);
router.post(
  "/:sessionId/generate-report",
  protect,
  authorize("Admin"),
  generateReportManually,
);

module.exports = router;
