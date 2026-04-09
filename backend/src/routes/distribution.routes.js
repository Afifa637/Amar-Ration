const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
  createDistributionSession,
  startDistributionSession,
  scanAndIssueToken,
  completeDistribution,
  listTokens,
  cancelToken,
  getDistributionRecords,
  getDistributionStats,
  getDistributionQuickInfo,
  listDistributionSessions,
  closeDistributionSession,
} = require("../controllers/distribution.controller");

router.post(
  "/session/create",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  createDistributionSession,
);
router.post(
  "/session/start",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  startDistributionSession,
);

router.post(
  "/scan",
  protect,
  authorize("Distributor", "FieldUser"),
  scanAndIssueToken,
);
router.post(
  "/complete",
  protect,
  authorize("Distributor", "FieldUser"),
  completeDistribution,
);
router.get(
  "/tokens",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  listTokens,
);
router.patch(
  "/tokens/:id/cancel",
  protect,
  authorize("Distributor", "FieldUser"),
  cancelToken,
);
router.get(
  "/records",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  getDistributionRecords,
);
router.get(
  "/stats",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  getDistributionStats,
);
router.get(
  "/quick-info",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  getDistributionQuickInfo,
);
router.get(
  "/sessions",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  listDistributionSessions,
);
router.post(
  "/session/close",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  closeDistributionSession,
);

module.exports = router;
