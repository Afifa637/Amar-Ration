"use strict";

const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
  wardSuggestion,
  systemSuggestion,
  simpleSystemSuggestion,
} = require("../controllers/stockSuggestion.controller");

router.get("/ward", protect, authorize("Admin"), wardSuggestion);
router.get("/system", protect, authorize("Admin"), systemSuggestion);
router.get("/simple", protect, authorize("Admin"), simpleSystemSuggestion);

module.exports = router;
