"use strict";

const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
  streamReceiptByTokenCode,
  generateReceiptByTokenId,
} = require("../controllers/receipt.controller");

router.get(
  "/:tokenCode",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  streamReceiptByTokenCode,
);
router.post(
  "/generate/:tokenId",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  generateReceiptByTokenId,
);

module.exports = router;
