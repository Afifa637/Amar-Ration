const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { allowUserTypes } = require("../middleware/rbac");
const { getMonitoringSummary } = require("../controllers/monitoring.controller");

router.get("/summary", auth, allowUserTypes("Admin", "Distributor"), getMonitoringSummary);

module.exports = router;
