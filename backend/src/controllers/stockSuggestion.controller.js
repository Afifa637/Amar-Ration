"use strict";

const {
  getStockSuggestion,
  getSystemWideStockSuggestion,
  getSystemStockSuggestionSimple,
} = require("../services/stockSuggestion.service");

async function wardSuggestion(req, res) {
  try {
    const division = String(req.query.division || "").trim();
    const ward = String(req.query.ward || "").trim();
    const union = String(req.query.union || "").trim() || undefined;
    const item = String(req.query.item || "").trim() || undefined;

    if (!division || !ward) {
      return res.status(400).json({
        success: false,
        message: "division এবং ward একসাথে প্রদান করা বাধ্যতামূলক",
        code: "VALIDATION_ERROR",
      });
    }

    const data = await getStockSuggestion(division, ward, union, item);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("wardSuggestion error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function systemSuggestion(req, res) {
  try {
    const item = String(req.query.item || "").trim() || undefined;
    const data = await getSystemWideStockSuggestion(item);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("systemSuggestion error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function simpleSystemSuggestion(req, res) {
  try {
    const item = String(req.query.item || "").trim() || undefined;
    const data = await getSystemStockSuggestionSimple(item);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("simpleSystemSuggestion error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

module.exports = {
  wardSuggestion,
  systemSuggestion,
  simpleSystemSuggestion,
};
