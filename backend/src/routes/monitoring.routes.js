const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { allowUserTypes } = require("../middleware/rbac");
const { getMonitoringSummary } = require("../controllers/monitoring.controller");

router.get("/summary", auth, allowUserTypes("Central Admin", "Distributor"), getMonitoringSummary);

module.exports = router;
