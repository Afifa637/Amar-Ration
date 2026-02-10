const AuditLog = require("../models/AuditLog");

/**
 * Write audit event (optionally inside Mongo transaction session).
 * Uses create([doc]) so it works properly with session.
 */
async function writeAudit(
  { actorUserId, actorType, action, entityType = null, entityId = null, severity = "Info", meta = {} },
  session
) {
  const doc = { actorUserId, actorType, action, entityType, entityId, severity, meta };
  const opts = session ? { session } : undefined;
  await AuditLog.create([doc], opts);
}

module.exports = { writeAudit };
