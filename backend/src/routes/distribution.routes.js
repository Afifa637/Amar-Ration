const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const { scanAndIssueToken, completeDistribution } = require("../controllers/distribution.controller");

router.post("/scan", protect, authorize("Distributor", "FieldUser"), scanAndIssueToken);
router.post("/complete", protect, authorize("Distributor", "FieldUser"), completeDistribution);

module.exports = router;
