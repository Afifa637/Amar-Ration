"use strict";

const DistributionSession = require("../models/DistributionSession");
const Distributor = require("../models/Distributor");
const Consumer = require("../models/Consumer");
const Token = require("../models/Token");
const {
  normalizeDivision,
  isSameDivision,
} = require("../utils/division.utils");
const { normalizeWardNo, isSameWard } = require("../utils/ward.utils");

function makeHttpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

async function getActiveDistributorForUser(reqUser) {
  const distributor = await Distributor.findOne({ userId: reqUser.userId })
    .select("_id authorityStatus division wardNo ward")
    .lean();

  if (!distributor || distributor.authorityStatus !== "Active") {
    throw makeHttpError(403, "FORBIDDEN", "Distributor profile not active");
  }

  return distributor;
}

function consumerInsideDistributorScope(distributor, consumer) {
  if (!distributor || !consumer) return false;

  const distDivision = normalizeDivision(distributor.division);
  const distWard = normalizeWardNo(distributor.wardNo || distributor.ward);

  if (distDivision && !isSameDivision(distDivision, consumer.division || "")) {
    return false;
  }

  return isSameWard(distWard, consumer.ward || consumer.wardNo || "");
}

async function assertSessionAccess(reqUser, sessionId) {
  const session = await DistributionSession.findById(sessionId)
    .select("_id distributorId status dateKey")
    .lean();

  if (!session) {
    throw makeHttpError(404, "NOT_FOUND", "Session not found");
  }

  if (reqUser.userType === "Admin") return session;

  const distributor = await getActiveDistributorForUser(reqUser);
  if (String(session.distributorId) !== String(distributor._id)) {
    throw makeHttpError(
      403,
      "FORBIDDEN",
      "You do not have access to this session",
    );
  }

  return session;
}

async function assertConsumerAccess(reqUser, consumerInput) {
  const consumer =
    typeof consumerInput === "string"
      ? await Consumer.findById(consumerInput).select(
          "_id division ward wardNo createdByDistributor",
        )
      : consumerInput;

  if (!consumer) {
    throw makeHttpError(404, "NOT_FOUND", "Consumer not found");
  }

  if (reqUser.userType === "Admin") return consumer;

  const distributor = await getActiveDistributorForUser(reqUser);
  const byOwner =
    String(consumer.createdByDistributor || "") === String(distributor._id);
  const byScope = consumerInsideDistributorScope(distributor, consumer);

  if (!byOwner && !byScope) {
    throw makeHttpError(
      403,
      "FORBIDDEN",
      "You do not have access to this consumer",
    );
  }

  return consumer;
}

async function assertTokenAccess(reqUser, tokenFilter) {
  const token = await Token.findOne(tokenFilter)
    .select("_id distributorId tokenCode")
    .lean();
  if (!token) {
    throw makeHttpError(404, "NOT_FOUND", "Token not found");
  }

  if (reqUser.userType === "Admin") return token;

  const distributor = await getActiveDistributorForUser(reqUser);
  if (String(token.distributorId) !== String(distributor._id)) {
    throw makeHttpError(
      403,
      "FORBIDDEN",
      "You do not have access to this token",
    );
  }

  return token;
}

module.exports = {
  makeHttpError,
  getActiveDistributorForUser,
  consumerInsideDistributorScope,
  assertSessionAccess,
  assertConsumerAccess,
  assertTokenAccess,
};
