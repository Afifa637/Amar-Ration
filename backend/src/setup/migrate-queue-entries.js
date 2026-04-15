"use strict";

require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB } = require("../config/db");
const QueueEntry = require("../models/QueueEntry.model");

async function dedupeQueueEntries() {
  const duplicateGroups = await QueueEntry.aggregate([
    {
      $group: {
        _id: { sessionId: "$sessionId", consumerId: "$consumerId" },
        ids: { $push: "$_id" },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  let removed = 0;

  for (const group of duplicateGroups) {
    const entries = await QueueEntry.find({ _id: { $in: group.ids } })
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    const keep = entries[0];
    const toDelete = entries.slice(1).map((entry) => entry._id);
    if (toDelete.length) {
      const result = await QueueEntry.deleteMany({ _id: { $in: toDelete } });
      removed += Number(result.deletedCount || 0);
      console.log(
        `[queue-migrate] kept ${keep._id} and removed ${toDelete.length} duplicates for session=${group._id.sessionId}, consumer=${group._id.consumerId}`,
      );
    }
  }

  return { duplicateGroups: duplicateGroups.length, removed };
}

async function run() {
  await connectDB();

  const { duplicateGroups, removed } = await dedupeQueueEntries();
  await QueueEntry.syncIndexes();

  console.log(
    `[queue-migrate] done. duplicateGroups=${duplicateGroups}, removed=${removed}`,
  );

  await mongoose.connection.close();
}

run().catch(async (error) => {
  console.error("[queue-migrate] failed:", error);
  try {
    await mongoose.connection.close();
  } catch {
    // ignore
  }
  process.exit(1);
});
