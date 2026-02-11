const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const { getMonitoringSummary } = require("../controllers/monitoring.controller");

router.get("/summary", protect, authorize("Admin", "Distributor"), getMonitoringSummary);

module.exports = router;
