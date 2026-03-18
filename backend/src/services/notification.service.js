const Notification = require("../models/Notification");
const SmsOutbox = require("../models/SmsOutbox");
const SystemSetting = require("../models/SystemSetting");
const User = require("../models/User");

async function getUserPrefs(userId) {
  const key = `distributor:${String(userId)}:settings`;
  const setting = await SystemSetting.findOne({ key }).lean();
  const notifications = setting?.value?.notifications;
  return {
    sms: notifications?.sms !== false,
    app: notifications?.app !== false,
  };
}

async function notifyUser(userId, payload) {
  if (!userId) return;

  const user = await User.findById(userId).lean();
  if (!user) return;

  const prefs = await getUserPrefs(userId);
  const channels = payload?.channels || prefs;

  if (channels.app) {
    await Notification.create({
      userId: user._id,
      channel: "App",
      title: payload.title,
      message: payload.message,
      meta: payload.meta || {},
    });
  }

  if (channels.sms && user.phone) {
    await SmsOutbox.create({
      userId: user._id,
      phone: user.phone,
      message: payload.message,
      status: "Queued",
    });
  }
}

async function notifyAdmins(payload) {
  const admins = await User.find({ userType: "Admin" }).select("_id").lean();
  await Promise.all(admins.map((admin) => notifyUser(admin._id, payload)));
}

module.exports = {
  notifyUser,
  notifyAdmins,
};
