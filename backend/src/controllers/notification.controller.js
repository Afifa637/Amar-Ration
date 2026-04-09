const Notification = require("../models/Notification");

// GET /api/notifications
async function listMyNotifications(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const status = String(req.query.status || "").trim();

    const query = { userId: req.user.userId };
    if (status && ["Unread", "Read"].includes(status)) {
      query.status = status;
    }

    const [total, items] = await Promise.all([
      Notification.countDocuments(query),
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.json({
      success: true,
      data: {
        items,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
    });
  } catch (error) {
    console.error("listMyNotifications error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// GET /api/notifications/unread-count
async function getUnreadCount(req, res) {
  try {
    const unreadCount = await Notification.countDocuments({
      userId: req.user.userId,
      status: "Unread",
    });

    return res.json({ success: true, data: { unreadCount } });
  } catch (error) {
    console.error("getUnreadCount error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// PATCH /api/notifications/:id/read
async function markNotificationRead(req, res) {
  try {
    const item = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { $set: { status: "Read" } },
      { new: true },
    ).lean();

    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    return res.json({ success: true, data: { item } });
  } catch (error) {
    console.error("markNotificationRead error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// PATCH /api/notifications/read-all
async function markAllNotificationsRead(req, res) {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.userId, status: "Unread" },
      { $set: { status: "Read" } },
    );

    return res.json({
      success: true,
      data: { updated: Number(result.modifiedCount || 0) },
    });
  } catch (error) {
    console.error("markAllNotificationsRead error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// DELETE /api/notifications/:id
async function deleteNotification(req, res) {
  try {
    const item = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    return res.json({ success: true, message: "Notification deleted" });
  } catch (error) {
    console.error("deleteNotification error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// DELETE /api/notifications/clear-all
async function clearAllNotifications(req, res) {
  try {
    const result = await Notification.deleteMany({ userId: req.user.userId });
    return res.json({
      success: true,
      data: { deleted: Number(result.deletedCount || 0) },
      message: "সব নোটিফিকেশন মুছে ফেলা হয়েছে",
    });
  } catch (error) {
    console.error("clearAllNotifications error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// DELETE /api/notifications/clear-read
async function clearReadNotifications(req, res) {
  try {
    const result = await Notification.deleteMany({
      userId: req.user.userId,
      status: "Read",
    });
    return res.json({
      success: true,
      data: { deleted: Number(result.deletedCount || 0) },
      message: "পঠিত নোটিফিকেশন মুছে ফেলা হয়েছে",
    });
  } catch (error) {
    console.error("clearReadNotifications error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = {
  listMyNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
  clearReadNotifications,
};
