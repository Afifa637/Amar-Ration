const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
  reportSummary,
  distributionReport,
  tokenAnalytics,
  reportAuditLogs,
} = require("../controllers/reports.controller");

router.get(
  "/summary",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  reportSummary,
);
router.get(
  "/distribution",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  distributionReport,
);
router.get(
  "/token-analytics",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  tokenAnalytics,
);
router.get(
  "/audit-logs",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  reportAuditLogs,
);

module.exports = router;
