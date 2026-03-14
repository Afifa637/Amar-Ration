const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getAdminSummary,
  getAdminDistributors,
  updateDistributorStatus,
  getAdminCardsSummary,
  getAdminDistributionMonitoring,
  getAdminConsumerReview,
} = require("../controllers/admin.controller");

router.use(protect, authorize("Admin"));

router.get("/summary", getAdminSummary);
router.get("/distributors", getAdminDistributors);
router.patch("/distributors/:userId/status", updateDistributorStatus);
router.get("/cards/summary", getAdminCardsSummary);
router.get("/distribution/monitoring", getAdminDistributionMonitoring);
router.get("/consumers/review", getAdminConsumerReview);

module.exports = router;
