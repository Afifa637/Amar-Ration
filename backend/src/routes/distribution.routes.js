const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
	scanAndIssueToken,
	completeDistribution,
	listTokens,
	cancelToken,
	getDistributionRecords,
	getDistributionStats,
	getDistributionQuickInfo
} = require("../controllers/distribution.controller");

router.post("/scan", protect, authorize("Distributor", "FieldUser"), scanAndIssueToken);
router.post("/complete", protect, authorize("Distributor", "FieldUser"), completeDistribution);
router.get("/tokens", protect, authorize("Distributor", "FieldUser", "Admin"), listTokens);
router.patch("/tokens/:id/cancel", protect, authorize("Distributor", "FieldUser", "Admin"), cancelToken);
router.get("/records", protect, authorize("Distributor", "FieldUser", "Admin"), getDistributionRecords);
router.get("/stats", protect, authorize("Distributor", "FieldUser", "Admin"), getDistributionStats);
router.get("/quick-info", protect, authorize("Distributor", "FieldUser", "Admin"), getDistributionQuickInfo);

module.exports = router;
