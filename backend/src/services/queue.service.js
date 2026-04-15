"use strict";

const QueueEntry = require("../models/QueueEntry.model");
const Consumer = require("../models/Consumer");
const DistributionSession = require("../models/DistributionSession");
const Token = require("../models/Token");
const DistributionRecord = require("../models/DistributionRecord");
const Distributor = require("../models/Distributor");
const User = require("../models/User");
const { hydrateRecordItemFields } = require("./distributionRecord.service");
const { makeSessionCode } = require("./sessionCode.service");
const {
  getActiveDistributorForUser,
  consumerInsideDistributorScope,
  makeHttpError,
} = require("./access-control.service");

async function assertQueueSessionAccess(sessionId, actorUser) {
  const session = await DistributionSession.findById(sessionId)
    .select("_id distributorId dateKey status")
    .lean();

  if (!session) {
    throw makeHttpError(404, "NOT_FOUND", "Session not found");
  }

  if (actorUser?.userType === "Admin") {
    return { session, distributor: null };
  }

  const distributor = await getActiveDistributorForUser(actorUser);
  if (String(distributor._id) !== String(session.distributorId)) {
    throw makeHttpError(
      403,
      "FORBIDDEN",
      "Cannot operate queue for another distributor session",
    );
  }

  return { session, distributor };
}

async function assignQueueNumber(sessionId, consumerId, actorUser) {
  const { session, distributor } = await assertQueueSessionAccess(
    sessionId,
    actorUser,
  );

  const consumer = await Consumer.findById(consumerId)
    .select(
      "name consumerCode category division ward wardNo createdByDistributor",
    )
    .lean();

  if (!consumer) {
    throw makeHttpError(404, "NOT_FOUND", "Consumer not found");
  }

  if (distributor && !consumerInsideDistributorScope(distributor, consumer)) {
    throw makeHttpError(
      403,
      "FORBIDDEN",
      "Consumer is outside your division/ward scope",
    );
  }

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
        distributorId: session.distributorId,
        createdByUserId: actorUser?.userId,
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

async function getQueueStatus(sessionId, actorUser) {
  const { session } = await assertQueueSessionAccess(sessionId, actorUser);

  const [waitingCount, servingCount, doneCount, skippedCount] =
    await Promise.all([
      QueueEntry.countDocuments({ sessionId, status: "waiting" }),
      QueueEntry.countDocuments({ sessionId, status: "serving" }),
      QueueEntry.countDocuments({ sessionId, status: "done" }),
      QueueEntry.countDocuments({ sessionId, status: "skipped" }),
    ]);

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

  const [tokens, owner] = await Promise.all([
    Token.find({ sessionId }).select("_id status").lean(),
    Distributor.findById(session.distributorId)
      .select("_id division wardNo ward userId")
      .populate("userId", "name")
      .lean(),
  ]);

  const usedTokenIds = tokens
    .filter((token) => token.status === "Used")
    .map((token) => token._id);
  const mismatchCount = usedTokenIds.length
    ? await DistributionRecord.countDocuments({
        tokenId: { $in: usedTokenIds },
        mismatch: true,
      })
    : 0;

  const ownerUser =
    owner?.userId && typeof owner.userId === "object" ? owner.userId : null;

  return {
    sessionId: String(sessionId),
    sessionCode: makeSessionCode(session),
    sessionDate: session?.dateKey || "",
    sessionStatus: session?.status || "",
    division: owner?.division || "",
    ward: owner?.wardNo || owner?.ward || "",
    distributorId: owner?._id ? String(owner._id) : "",
    distributorName: ownerUser?.name || "",
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
    summary: {
      totalInQueue: waitingCount + servingCount + doneCount + skippedCount,
      waiting: waitingCount,
      serving: servingCount,
      served: doneCount,
      skipped: skippedCount,
      mismatchCount,
      servedCount: doneCount,
      remainingCount: waitingCount + servingCount,
    },
    lastUpdated: new Date().toISOString(),
  };
}

async function callNextConsumer(sessionId, actorUser) {
  await assertQueueSessionAccess(sessionId, actorUser);

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

  return getQueueStatus(sessionId, actorUser);
}

async function skipConsumer(queueEntryId, actorUser) {
  const entry = await QueueEntry.findById(queueEntryId).lean();
  if (!entry) {
    const err = new Error("Queue entry not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  await assertQueueSessionAccess(entry.sessionId, actorUser);

  await QueueEntry.findByIdAndUpdate(queueEntryId, {
    $set: { status: "skipped", completedAt: new Date() },
  });

  return getQueueStatus(entry.sessionId, actorUser);
}

async function listQueueEntries(sessionId, page = 1, limit = 20, actorUser) {
  const { session } = await assertQueueSessionAccess(sessionId, actorUser);

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

  const consumerIds = Array.from(
    new Set(
      items.map((entry) => String(entry.consumerId || "")).filter(Boolean),
    ),
  );

  const [consumers, tokens, owner] = await Promise.all([
    consumerIds.length
      ? Consumer.find({ _id: { $in: consumerIds } })
          .select("_id consumerCode name category division ward")
          .lean()
      : [],
    consumerIds.length
      ? Token.find({ sessionId, consumerId: { $in: consumerIds } })
          .select(
            "_id tokenCode consumerId status rationItem rationQtyKg issuedAt usedAt sessionId",
          )
          .lean()
      : [],
    Distributor.findById(session.distributorId)
      .select("_id division wardNo ward userId")
      .populate("userId", "name")
      .lean(),
  ]);

  const consumerMap = new Map(consumers.map((c) => [String(c._id), c]));
  const tokenByConsumer = new Map(
    tokens.map((token) => [String(token.consumerId), token]),
  );
  const tokenIds = tokens.map((token) => token._id);
  const records = tokenIds.length
    ? await DistributionRecord.find({ tokenId: { $in: tokenIds } })
        .select(
          "tokenId expectedKg actualKg mismatch expectedByItem actualByItem mismatchDetails item",
        )
        .lean()
    : [];
  const recordMap = new Map(
    records.map((record) => [String(record.tokenId), record]),
  );

  const ownerUser =
    owner?.userId && typeof owner.userId === "object" ? owner.userId : null;

  const enrichedItems = items.map((entry) => {
    const consumer = consumerMap.get(String(entry.consumerId || ""));
    const token = tokenByConsumer.get(String(entry.consumerId || ""));
    const record = token ? recordMap.get(String(token._id)) : null;
    const hydrated = hydrateRecordItemFields({
      item: record?.item || token?.rationItem,
      expectedKg: Number(record?.expectedKg ?? token?.rationQtyKg ?? 0),
      actualKg: Number(record?.actualKg || 0),
      expectedByItem: record?.expectedByItem,
      actualByItem: record?.actualByItem,
    });
    const rationItem = hydrated.item;
    const expectedByItem = hydrated.expectedByItem;
    const actualByItem = hydrated.actualByItem;
    const mismatchDetails =
      record?.mismatchDetails?.length > 0
        ? record.mismatchDetails
        : hydrated.mismatchDetails;

    return {
      ...entry,
      sessionId: String(session._id),
      sessionCode: makeSessionCode(session),
      sessionDate: session.dateKey,
      sessionStatus: session.status,
      division: consumer?.division || owner?.division || "",
      ward: consumer?.ward || owner?.wardNo || owner?.ward || "",
      distributorId: owner?._id ? String(owner._id) : "",
      distributorName: ownerUser?.name || "",
      consumerId: consumer?._id
        ? String(consumer._id)
        : String(entry.consumerId || ""),
      consumerCode: consumer?.consumerCode || entry.consumerCode || "",
      consumerName: consumer?.name || entry.consumerName || "",
      category: consumer?.category || entry.category || "",
      tokenId: token?._id ? String(token._id) : "",
      tokenCode: token?.tokenCode || "",
      tokenStatus: token?.status || "",
      rationItem,
      expectedKg: Number(record?.expectedKg ?? token?.rationQtyKg ?? 0),
      actualKg: Number(record?.actualKg || 0),
      expectedByItem,
      actualByItem,
      mismatch: Boolean(record?.mismatch),
      mismatchItem: mismatchDetails[0]?.item || "",
      mismatchReason: mismatchDetails.map((x) => x.reason).join(" | "),
      mismatchDetails,
      joinedAt: entry.issuedAt,
    };
  });

  const summaryCounts = enrichedItems.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.status === "waiting") acc.waiting += 1;
      if (row.status === "serving") acc.serving += 1;
      if (row.status === "done") acc.served += 1;
      if (row.status === "skipped") acc.skipped += 1;
      if (row.mismatch) acc.mismatchCount += 1;
      return acc;
    },
    {
      total: 0,
      waiting: 0,
      serving: 0,
      served: 0,
      skipped: 0,
      mismatchCount: 0,
    },
  );

  return {
    session: {
      sessionId: String(session._id),
      sessionCode: makeSessionCode(session),
      sessionDate: session.dateKey,
      sessionStatus: session.status,
      division: owner?.division || "",
      ward: owner?.wardNo || owner?.ward || "",
      distributorId: owner?._id ? String(owner._id) : "",
      distributorName: ownerUser?.name || "",
    },
    items: enrichedItems,
    summary: {
      ...summaryCounts,
      remaining: summaryCounts.waiting + summaryCounts.serving,
    },
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
