"use strict";

const fs = require("fs");
const {
  generateReceipt,
  getOrGenerateReceipt,
} = require("../services/receipt.service");
const { assertTokenAccess } = require("../services/access-control.service");

async function streamReceiptByTokenCode(req, res) {
  try {
    await assertTokenAccess(req.user, { tokenCode: req.params.tokenCode });
    const filePath = await getOrGenerateReceipt(req.params.tokenCode);
    res.setHeader("Content-Type", "application/pdf");
    return fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    if (error?.status) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message, code: error.code });
    }
    console.error("streamReceiptByTokenCode error:", error);
    if (error.code === "NOT_FOUND") {
      return res.status(404).json({
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
    const token = await assertTokenAccess(req.user, {
      _id: req.params.tokenId,
    });

    const filePath = await generateReceipt(token._id);
    return res.json({
      success: true,
      data: { filePath, tokenCode: token.tokenCode },
    });
  } catch (error) {
    if (error?.status) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message, code: error.code });
    }
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
