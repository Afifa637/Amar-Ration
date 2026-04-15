"use strict";

const {
  assignQueueNumber,
  getQueueStatus,
  callNextConsumer,
  skipConsumer,
  listQueueEntries,
} = require("../services/queue.service");

async function joinQueue(req, res) {
  try {
    const { sessionId, consumerId } = req.body || {};
    if (!sessionId || !consumerId) {
      return res.status(400).json({
        success: false,
        message: "sessionId এবং consumerId প্রয়োজন",
        code: "VALIDATION_ERROR",
      });
    }

    const data = await assignQueueNumber(sessionId, consumerId, req.user);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code || "REQUEST_FAILED",
      });
    }
    console.error("joinQueue error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function queueStatus(req, res) {
  try {
    const data = await getQueueStatus(req.params.sessionId, req.user);
    return res.json({ success: true, data });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code || "REQUEST_FAILED",
      });
    }
    console.error("queueStatus error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function callNext(req, res) {
  try {
    const data = await callNextConsumer(req.params.sessionId, req.user);
    return res.json({ success: true, data });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code || "REQUEST_FAILED",
      });
    }
    console.error("callNext error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function skipEntry(req, res) {
  try {
    const data = await skipConsumer(req.params.queueEntryId, req.user);
    return res.json({ success: true, data });
  } catch (error) {
    if (error.code === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Queue entry not found",
        code: "NOT_FOUND",
      });
    }
    if (error?.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code || "REQUEST_FAILED",
      });
    }
    console.error("skipEntry error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function sessionQueue(req, res) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const data = await listQueueEntries(
      req.params.sessionId,
      page,
      limit,
      req.user,
    );
    return res.json({ success: true, data });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code || "REQUEST_FAILED",
      });
    }
    console.error("sessionQueue error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

module.exports = {
  joinQueue,
  queueStatus,
  callNext,
  skipEntry,
  sessionQueue,
};
