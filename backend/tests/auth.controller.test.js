"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { loadWithMocks } = require("./helpers/mock-loader");

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
}

function withSelectLean(value) {
  return {
    select() {
      return { lean: async () => value };
    },
    lean: async () => value,
  };
}

test("refreshAccessToken rejects request without body refresh token", async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

  const { loaded: authController, restore } = loadWithMocks(
    "src/controllers/auth.controller.js",
    {
      "src/models/User.js": {},
      "src/models/Distributor.js": {},
      "src/models/RefreshToken.js": {},
      "src/services/audit.service.js": { writeAudit: async () => {} },
      "src/services/notification.service.js": { notifyAdmins: async () => {} },
      "src/services/email.service.js": {
        sendDistributorPasswordChangeAlertEmail: async () => {},
      },
      "src/services/consumer-code.service.js": {
        nextConsumerCode: async () => "C0001",
      },
      "src/utils/division.utils.js": { normalizeDivision: (v) => v },
      "src/utils/ward.utils.js": { normalizeWardNo: (v) => v },
      "src/utils/regex.utils.js": { escapeRegex: (v) => v },
    },
  );

  try {
    const req = { body: {}, headers: {} };
    const res = createRes();

    await authController.refreshAccessToken(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.payload.success, false);
  } finally {
    restore();
  }
});

test("refreshAccessToken rotates refresh token for valid session", async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
  const rawRefreshToken = "raw-refresh-token";
  const tokenHash = crypto
    .createHash("sha256")
    .update(rawRefreshToken)
    .digest("hex");

  const calls = {
    revokedById: 0,
    created: 0,
  };

  const RefreshToken = {
    findOne: () =>
      withSelectLean({
        _id: "rt1",
        userId: "u1",
        tokenVersion: 4,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        token: tokenHash,
      }),
    findByIdAndUpdate: async () => {
      calls.revokedById += 1;
    },
    create: async () => {
      calls.created += 1;
    },
  };

  const User = {
    findById: () =>
      withSelectLean({
        _id: "u1",
        status: "Active",
        userType: "Distributor",
        tokenVersion: 4,
        mustChangePassword: false,
      }),
  };

  const { loaded: authController, restore } = loadWithMocks(
    "src/controllers/auth.controller.js",
    {
      "src/models/User.js": User,
      "src/models/Distributor.js": {},
      "src/models/RefreshToken.js": RefreshToken,
      "src/services/audit.service.js": { writeAudit: async () => {} },
      "src/services/notification.service.js": { notifyAdmins: async () => {} },
      "src/services/email.service.js": {
        sendDistributorPasswordChangeAlertEmail: async () => {},
      },
      "src/services/consumer-code.service.js": {
        nextConsumerCode: async () => "C0001",
      },
      "src/utils/division.utils.js": { normalizeDivision: (v) => v },
      "src/utils/ward.utils.js": { normalizeWardNo: (v) => v },
      "src/utils/regex.utils.js": { escapeRegex: (v) => v },
    },
  );

  try {
    const req = {
      body: { refreshToken: rawRefreshToken },
      headers: { "user-agent": "unit-test-agent" },
    };
    const res = createRes();

    await authController.refreshAccessToken(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.success, true);
    assert.ok(typeof res.payload.data.token === "string");
    assert.ok(typeof res.payload.data.refreshToken === "string");
    assert.equal(calls.revokedById, 1);
    assert.equal(calls.created, 1);
  } finally {
    restore();
  }
});

test("logout revokes provided refresh token hash", async () => {
  const rawRefreshToken = "logout-refresh";
  const expectedHash = crypto
    .createHash("sha256")
    .update(rawRefreshToken)
    .digest("hex");

  let findOneAndUpdateFilter = null;

  const RefreshToken = {
    findOneAndUpdate: async (filter) => {
      findOneAndUpdateFilter = filter;
    },
  };

  const { loaded: authController, restore } = loadWithMocks(
    "src/controllers/auth.controller.js",
    {
      "src/models/User.js": {},
      "src/models/Distributor.js": {},
      "src/models/RefreshToken.js": RefreshToken,
      "src/services/audit.service.js": { writeAudit: async () => {} },
      "src/services/notification.service.js": { notifyAdmins: async () => {} },
      "src/services/email.service.js": {
        sendDistributorPasswordChangeAlertEmail: async () => {},
      },
      "src/services/consumer-code.service.js": {
        nextConsumerCode: async () => "C0001",
      },
      "src/utils/division.utils.js": { normalizeDivision: (v) => v },
      "src/utils/ward.utils.js": { normalizeWardNo: (v) => v },
      "src/utils/regex.utils.js": { escapeRegex: (v) => v },
    },
  );

  try {
    const req = { body: { refreshToken: rawRefreshToken } };
    const res = createRes();

    await authController.logout(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.success, true);
    assert.equal(findOneAndUpdateFilter.token, expectedHash);
  } finally {
    restore();
  }
});
