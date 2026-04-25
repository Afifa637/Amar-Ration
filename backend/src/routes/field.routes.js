const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
  scanAndIssueToken,
  completeDistribution,
  listDistributionSessions,
  consumerPreview,
} = require("../controllers/distribution.controller");
const {
  listMyNotifications,
} = require("../controllers/notification.controller");
const { syncAllOfflineQueue } = require("../controllers/monitoring.controller");

router.use(protect, authorize("FieldUser"));

router.get("/session-status", (req, res, next) => {
  req.query = { ...req.query, status: "Open", limit: req.query.limit || "1" };
  return listDistributionSessions(req, res, next);
});

router.get("/consumer-preview", consumerPreview);
router.post("/scan", scanAndIssueToken);
router.post("/confirm", completeDistribution);
router.get("/notifications", listMyNotifications);
router.post("/offline-sync", syncAllOfflineQueue);

module.exports = router;
