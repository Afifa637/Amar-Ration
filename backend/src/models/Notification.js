const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    channel: { type: String, enum: ["App"], default: "App" },
    title: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ["Unread", "Read"], default: "Unread" },
    meta: { type: Object },
  },
  { timestamps: true },
);

NotificationSchema.index({ userId: 1, status: 1, createdAt: -1 });

// Auto-delete READ notifications after 30 days
NotificationSchema.index(
  { updatedAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60,
    partialFilterExpression: { status: "Read" },
    name: "ttl_read_notifications_30d",
  },
);

module.exports = mongoose.model("Notification", NotificationSchema);
