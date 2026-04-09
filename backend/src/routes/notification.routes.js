const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
  listMyNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
  clearReadNotifications,
} = require("../controllers/notification.controller");

router.use(protect, authorize("Admin", "Distributor", "FieldUser"));

router.get("/", listMyNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);
router.delete("/clear-all", clearAllNotifications);
router.delete("/clear-read", clearReadNotifications);
router.delete("/:id", deleteNotification);

module.exports = router;
