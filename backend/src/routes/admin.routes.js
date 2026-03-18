const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getAdminSummary,
  getAdminDistributors,
  updateDistributorStatus,
  getAdminCardsSummary,
  getAdminDistributionMonitoring,
  getAdminConsumerReview,
  getAdminAuditDetail,
} = require("../controllers/admin.controller");
const {
  listAuditReportRequests,
  requestAuditReport,
  reviewAuditReportRequest,
} = require("../controllers/audit-report.controller");

router.use(protect, authorize("Admin"));

router.get("/summary", getAdminSummary);
router.get("/distributors", getAdminDistributors);
router.patch("/distributors/:userId/status", updateDistributorStatus);
router.get("/cards/summary", getAdminCardsSummary);
router.get("/distribution/monitoring", getAdminDistributionMonitoring);
router.get("/consumers/review", getAdminConsumerReview);
router.get("/audit/:id/detail", getAdminAuditDetail);
router.get("/audit/requests", listAuditReportRequests);
router.post("/audit/requests", requestAuditReport);
router.patch("/audit/requests/:id/review", reviewAuditReportRequest);

module.exports = router;
