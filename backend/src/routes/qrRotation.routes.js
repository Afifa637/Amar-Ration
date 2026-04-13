"use strict";

const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
  triggerRotation,
  regenerateOne,
  forceResetAll,
} = require("../controllers/qrRotation.controller");

router.post("/trigger", protect, authorize("Admin"), triggerRotation);
router.post("/force-reset-all", protect, authorize("Admin"), forceResetAll);
router.post(
  "/regenerate/:consumerId",
  protect,
  authorize("Admin"),
  regenerateOne,
);

module.exports = router;
