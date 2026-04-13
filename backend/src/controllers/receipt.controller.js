"use strict";

const fs = require("fs");
const {
  generateReceipt,
  getOrGenerateReceipt,
} = require("../services/receipt.service");
const Token = require("../models/Token");

async function streamReceiptByTokenCode(req, res) {
  try {
    const filePath = await getOrGenerateReceipt(req.params.tokenCode);
    res.setHeader("Content-Type", "application/pdf");
    return fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error("streamReceiptByTokenCode error:", error);
    if (error.code === "NOT_FOUND") {
      return res
        .status(404)
        .json({
          success: false,
          message: "Receipt না পাওয়া গেছে",
          code: "NOT_FOUND",
        });
    }
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function generateReceiptByTokenId(req, res) {
  try {
    const token = await Token.findById(req.params.tokenId)
      .select("tokenCode")
      .lean();
    if (!token) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Token not found",
          code: "NOT_FOUND",
        });
    }

    const filePath = await generateReceipt(token._id);
    return res.json({
      success: true,
      data: { filePath, tokenCode: token.tokenCode },
    });
  } catch (error) {
    console.error("generateReceiptByTokenId error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

module.exports = {
  streamReceiptByTokenCode,
  generateReceiptByTokenId,
};
