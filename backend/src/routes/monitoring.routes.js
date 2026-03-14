const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getMonitoringSummary,
  listBlacklist,
  createBlacklistEntry,
  updateBlacklistEntry,
  deactivateBlacklistEntry,
  listOfflineQueue,
  createOfflineQueueEntry,
  syncOfflineQueueItem,
  syncAllOfflineQueue,
} = require("../controllers/monitoring.controller");

router.get(
  "/summary",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  getMonitoringSummary,
);
router.get(
  "/blacklist",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  listBlacklist,
);
router.post(
  "/blacklist",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  createBlacklistEntry,
);
router.put(
  "/blacklist/:id",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  updateBlacklistEntry,
);
router.post(
  "/blacklist/:id/deactivate",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  deactivateBlacklistEntry,
);
router.get(
  "/offline-queue",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  listOfflineQueue,
);
router.post(
  "/offline-queue",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  createOfflineQueueEntry,
);
router.post(
  "/offline-queue/:id/sync",
  protect,
  authorize("Admin", "Distributor"),
  syncOfflineQueueItem,
);
router.post(
  "/offline-queue/sync-all",
  protect,
  authorize("Admin", "Distributor"),
  syncAllOfflineQueue,
);

module.exports = router;
