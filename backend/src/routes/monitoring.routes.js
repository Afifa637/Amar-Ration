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
  resolveOfflineQueueItem,
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
router.post("/blacklist", protect, authorize("Admin"), createBlacklistEntry);
router.put("/blacklist/:id", protect, authorize("Admin"), updateBlacklistEntry);
router.patch(
  "/blacklist/:id",
  protect,
  authorize("Admin"),
  updateBlacklistEntry,
);
router.post(
  "/blacklist/:id/deactivate",
  protect,
  authorize("Admin"),
  deactivateBlacklistEntry,
);
router.patch(
  "/blacklist/:id/deactivate",
  protect,
  authorize("Admin"),
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
router.patch(
  "/offline-queue/:id/resolve",
  protect,
  authorize("Admin", "Distributor"),
  resolveOfflineQueueItem,
);

module.exports = router;
