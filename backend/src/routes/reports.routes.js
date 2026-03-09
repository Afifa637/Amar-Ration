const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const { reportSummary } = require("../controllers/reports.controller");

router.get("/summary", protect, authorize("Admin", "Distributor"), reportSummary);

module.exports = router;
