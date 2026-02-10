const BlacklistEntry = require("../models/BlacklistEntry");
const OfflineQueue = require("../models/OfflineQueue");
const AuditLog = require("../models/AuditLog");

async function getMonitoringSummary(req, res) {
  const blacklist = await BlacklistEntry.find({ active: true })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const offline = await OfflineQueue.find({ status: "Pending" })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const critical = await AuditLog.find({ severity: "Critical" })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  res.json({ blacklist, offline, critical });
}

module.exports = { getMonitoringSummary };
