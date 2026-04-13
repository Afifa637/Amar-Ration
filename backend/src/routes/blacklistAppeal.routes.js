"use strict";

const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
  createAppeal,
  listAppeals,
  reviewAppeal,
} = require("../controllers/blacklistAppeal.controller");

router.post("/", createAppeal);
router.get("/", protect, authorize("Admin"), listAppeals);
router.patch("/:appealId/review", protect, authorize("Admin"), reviewAppeal);

module.exports = router;
