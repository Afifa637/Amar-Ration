"use strict";

const QueueEntry = require("../models/QueueEntry.model");
const Consumer = require("../models/Consumer");

async function assignQueueNumber(sessionId, consumerId) {
  const consumer = await Consumer.findById(consumerId)
    .select("name consumerCode category")
    .lean();

  for (let i = 0; i < 5; i += 1) {
    const existing = await QueueEntry.findOne({ sessionId, consumerId }).lean();
    if (existing) {
      return {
        queueNumber: existing.queueNumber,
        position: existing.status === "waiting" ? existing.queueNumber : 0,
        estimatedWaitMinutes:
          existing.status === "waiting" ? existing.queueNumber * 3 : 0,
        queueEntryId: String(existing._id),
        status: existing.status,
      };
    }

    const maxEntry = await QueueEntry.findOne({ sessionId })
      .sort({ queueNumber: -1 })
      .select("queueNumber")
      .lean();
    const queueNumber = Number(maxEntry?.queueNumber || 0) + 1;

    try {
      const created = await QueueEntry.create({
        sessionId,
        consumerId,
        consumerName: consumer?.name || null,
        consumerCode: consumer?.consumerCode || null,
        category: consumer?.category || null,
        queueNumber,
      });

      return {
        queueNumber,
        position: queueNumber,
        estimatedWaitMinutes: queueNumber * 3,
        queueEntryId: String(created._id),
        status: created.status,
      };
    } catch (error) {
      if (error?.code === 11000) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Failed to assign queue number. Please retry.");
}

async function getQueueStatus(sessionId) {
  const waitingCount = await QueueEntry.countDocuments({
    sessionId,
    status: "waiting",
  });

  const [currentlyServing, nextUpRows] = await Promise.all([
    QueueEntry.findOne({ sessionId, status: "serving" })
      .sort({ calledAt: -1 })
      .select("_id queueNumber consumerName consumerCode category")
      .lean(),
    QueueEntry.find({ sessionId, status: "waiting" })
      .sort({ queueNumber: 1 })
      .limit(5)
      .select("_id queueNumber consumerName consumerCode category")
      .lean(),
  ]);

  return {
    sessionId: String(sessionId),
    currentlyServing: currentlyServing
      ? {
          id: String(currentlyServing._id),
          queueNumber: currentlyServing.queueNumber,
          consumerName: currentlyServing.consumerName,
          consumerCode: currentlyServing.consumerCode,
          category: currentlyServing.category,
        }
      : null,
    waitingCount,
    nextUp: nextUpRows.map((entry) => ({
      id: String(entry._id),
      queueNumber: entry.queueNumber,
      consumerName: entry.consumerName,
      consumerCode: entry.consumerCode,
      category: entry.category,
    })),
    lastUpdated: new Date().toISOString(),
  };
}

async function callNextConsumer(sessionId) {
  const currentServing = await QueueEntry.findOne({
    sessionId,
    status: "serving",
  })
    .sort({ calledAt: -1 })
    .lean();

  if (currentServing) {
    await QueueEntry.findByIdAndUpdate(currentServing._id, {
      $set: { status: "done", completedAt: new Date() },
    });
  }

  const nextWaiting = await QueueEntry.findOne({ sessionId, status: "waiting" })
    .sort({ queueNumber: 1 })
    .lean();

  if (nextWaiting) {
    await QueueEntry.findByIdAndUpdate(nextWaiting._id, {
      $set: { status: "serving", calledAt: new Date() },
    });
  }

  return getQueueStatus(sessionId);
}

async function skipConsumer(queueEntryId) {
  const entry = await QueueEntry.findById(queueEntryId).lean();
  if (!entry) {
    const err = new Error("Queue entry not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  await QueueEntry.findByIdAndUpdate(queueEntryId, {
    $set: { status: "skipped", completedAt: new Date() },
  });

  return getQueueStatus(entry.sessionId);
}

async function listQueueEntries(sessionId, page = 1, limit = 20) {
  const pageSafe = Math.max(1, Number(page) || 1);
  const limitSafe = Math.min(100, Math.max(1, Number(limit) || 20));

  const [total, items] = await Promise.all([
    QueueEntry.countDocuments({ sessionId }),
    QueueEntry.find({ sessionId })
      .sort({ queueNumber: 1 })
      .skip((pageSafe - 1) * limitSafe)
      .limit(limitSafe)
      .lean(),
  ]);

  return {
    items,
    pagination: {
      total,
      page: pageSafe,
      pages: Math.ceil(total / limitSafe) || 1,
      limit: limitSafe,
    },
  };
}

module.exports = {
  assignQueueNumber,
  getQueueStatus,
  callNextConsumer,
  skipConsumer,
  listQueueEntries,
};
