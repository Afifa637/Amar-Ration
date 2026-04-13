"use strict";

const {
  calculateDistributorFraudScore,
  getSystemFraudReport,
  getDistributorMonthlyPerformance,
  getAllDistributorMonthlyPerformance,
} = require("../services/fraudScore.service");

async function getDistributorScore(req, res) {
  try {
    const days = Number(req.query.days) || 30;
    const data = await calculateDistributorFraudScore(
      req.params.distributorId,
      days,
    );
    return res.json({ success: true, data });
  } catch (error) {
    console.error("getDistributorScore error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function getReport(req, res) {
  try {
    const days = Number(req.query.days) || 30;
    const data = await getSystemFraudReport(days);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("getReport error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function getTopRisky(req, res) {
  try {
    const days = Number(req.query.days) || 30;
    const limit = Math.max(1, Number(req.query.limit) || 5);
    const report = await getSystemFraudReport(days);
    return res.json({
      success: true,
      data: report.distributors.slice(0, limit),
    });
  } catch (error) {
    console.error("getTopRisky error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function getMonthlyDistributorPerformance(req, res) {
  try {
    const year = Number(req.query.year) || undefined;
    const month = Number(req.query.month) || undefined;
    const data = await getDistributorMonthlyPerformance(
      req.params.distributorId,
      year,
      month,
    );
    return res.json({ success: true, data });
  } catch (error) {
    console.error("getMonthlyDistributorPerformance error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function getMonthlyAllPerformance(req, res) {
  try {
    const year = Number(req.query.year) || undefined;
    const month = Number(req.query.month) || undefined;
    const data = await getAllDistributorMonthlyPerformance(year, month);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("getMonthlyAllPerformance error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

module.exports = {
  getDistributorScore,
  getReport,
  getTopRisky,
  getMonthlyDistributorPerformance,
  getMonthlyAllPerformance,
};
