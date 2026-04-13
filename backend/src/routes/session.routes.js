"use strict";

const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
  setExpectedLocation,
  logLocation,
} = require("../controllers/session.controller");

router.patch(
  "/:sessionId/log-location",
  protect,
  authorize("Distributor", "FieldUser"),
  logLocation,
);
router.post(
  "/:sessionId/set-expected-location",
  protect,
  authorize("Admin"),
  setExpectedLocation,
);

module.exports = router;
