const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { allowUserTypes } = require("../middleware/rbac");
const { reportSummary } = require("../controllers/reports.controller");

router.get("/summary", auth, allowUserTypes("Admin", "Distributor"), reportSummary);

module.exports = router;
