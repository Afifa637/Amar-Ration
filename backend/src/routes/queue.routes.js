"use strict";

const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
  joinQueue,
  queueStatus,
  callNext,
  skipEntry,
  sessionQueue,
} = require("../controllers/queue.controller");

router.post("/join", protect, authorize("Distributor", "FieldUser"), joinQueue);
router.get(
  "/status/:sessionId",
  protect,
  authorize("Distributor", "FieldUser", "Admin"),
  queueStatus,
);
router.patch(
  "/call-next/:sessionId",
  protect,
  authorize("Distributor", "FieldUser"),
  callNext,
);
router.patch(
  "/skip/:queueEntryId",
  protect,
  authorize("Distributor", "FieldUser"),
  skipEntry,
);
router.get("/session/:sessionId", protect, authorize("Admin"), sessionQueue);

module.exports = router;
