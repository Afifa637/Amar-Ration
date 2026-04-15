"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadWithMocks } = require("./helpers/mock-loader");

function asLean(value) {
  return { lean: async () => value };
}

function withSelect(value) {
  return {
    select() {
      return asLean(value);
    },
    lean: async () => value,
  };
}

test("assignQueueNumber denies cross-distributor access", async () => {
  const DistributionSession = {
    findById: () => withSelect({ _id: "s1", distributorId: "d1" }),
  };

  const accessControl = {
    getActiveDistributorForUser: async () => ({ _id: "d2" }),
    consumerInsideDistributorScope: () => true,
    makeHttpError: (status, code, message) => {
      const err = new Error(message);
      err.status = status;
      err.code = code;
      return err;
    },
  };

  const { loaded: queueService, restore } = loadWithMocks(
    "src/services/queue.service.js",
    {
      "src/models/QueueEntry.model.js": {},
      "src/models/Consumer.js": {},
      "src/models/DistributionSession.js": DistributionSession,
      "src/services/access-control.service.js": accessControl,
    },
  );

  try {
    await assert.rejects(
      queueService.assignQueueNumber("s1", "c1", {
        userType: "Distributor",
        userId: "u1",
      }),
      (err) => err?.status === 403 && err?.code === "FORBIDDEN",
    );
  } finally {
    restore();
  }
});

test("assignQueueNumber writes distributor and actor fields", async () => {
  let createdPayload = null;

  const DistributionSession = {
    findById: () => withSelect({ _id: "s1", distributorId: "d1" }),
  };

  const Consumer = {
    findById: () =>
      withSelect({
        _id: "c1",
        name: "Consumer One",
        consumerCode: "C0001",
        category: "A",
      }),
  };

  const QueueEntry = {
    findOne: (query) => {
      if (query.consumerId) {
        return asLean(null);
      }
      return {
        sort() {
          return {
            select() {
              return asLean({ queueNumber: 9 });
            },
          };
        },
      };
    },
    create: async (payload) => {
      createdPayload = payload;
      return {
        _id: "q1",
        ...payload,
      };
    },
  };

  const accessControl = {
    getActiveDistributorForUser: async () => ({ _id: "d1" }),
    consumerInsideDistributorScope: () => true,
    makeHttpError: (status, code, message) => {
      const err = new Error(message);
      err.status = status;
      err.code = code;
      return err;
    },
  };

  const { loaded: queueService, restore } = loadWithMocks(
    "src/services/queue.service.js",
    {
      "src/models/QueueEntry.model.js": QueueEntry,
      "src/models/Consumer.js": Consumer,
      "src/models/DistributionSession.js": DistributionSession,
      "src/services/access-control.service.js": accessControl,
    },
  );

  try {
    const out = await queueService.assignQueueNumber("s1", "c1", {
      userType: "Distributor",
      userId: "u1",
    });

    assert.equal(out.queueNumber, 10);
    assert.equal(createdPayload.distributorId, "d1");
    assert.equal(createdPayload.createdByUserId, "u1");
    assert.equal(createdPayload.sessionId, "s1");
    assert.equal(createdPayload.consumerId, "c1");
  } finally {
    restore();
  }
});
