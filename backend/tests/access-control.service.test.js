"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadWithMocks } = require("./helpers/mock-loader");

function chainLean(value) {
  return {
    select() {
      return { lean: async () => value };
    },
    lean: async () => value,
  };
}

test("assertSessionAccess blocks distributor from another session", async () => {
  const DistributionSession = {
    findById: () => chainLean({ _id: "s1", distributorId: "d1" }),
  };
  const Distributor = {
    findOne: () => chainLean({ _id: "d2", authorityStatus: "Active" }),
  };

  const { loaded: accessControl, restore } = loadWithMocks(
    "src/services/access-control.service.js",
    {
      "src/models/DistributionSession.js": DistributionSession,
      "src/models/Distributor.js": Distributor,
      "src/models/Consumer.js": {},
      "src/models/Token.js": {},
    },
  );

  try {
    await assert.rejects(
      accessControl.assertSessionAccess(
        { userType: "Distributor", userId: "u1" },
        "s1",
      ),
      (err) => err?.status === 403 && err?.code === "FORBIDDEN",
    );
  } finally {
    restore();
  }
});

test("assertTokenAccess returns token for admin", async () => {
  const Token = {
    findOne: () =>
      chainLean({ _id: "t1", distributorId: "d1", tokenCode: "TK1" }),
  };

  const { loaded: accessControl, restore } = loadWithMocks(
    "src/services/access-control.service.js",
    {
      "src/models/DistributionSession.js": {},
      "src/models/Distributor.js": {},
      "src/models/Consumer.js": {},
      "src/models/Token.js": Token,
    },
  );

  try {
    const token = await accessControl.assertTokenAccess(
      { userType: "Admin", userId: "admin" },
      { tokenCode: "TK1" },
    );

    assert.equal(token.tokenCode, "TK1");
  } finally {
    restore();
  }
});

test("consumerInsideDistributorScope matches by division and ward", () => {
  const { loaded: accessControl, restore } = loadWithMocks(
    "src/services/access-control.service.js",
    {
      "src/models/DistributionSession.js": {},
      "src/models/Distributor.js": {},
      "src/models/Consumer.js": {},
      "src/models/Token.js": {},
    },
  );

  try {
    const allowed = accessControl.consumerInsideDistributorScope(
      { division: "Dhaka", wardNo: "5" },
      { division: "dhaka", ward: "05" },
    );

    const denied = accessControl.consumerInsideDistributorScope(
      { division: "Dhaka", wardNo: "5" },
      { division: "Chattogram", ward: "05" },
    );

    assert.equal(allowed, true);
    assert.equal(denied, false);
  } finally {
    restore();
  }
});
