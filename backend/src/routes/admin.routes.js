const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { createDistributorSchema } = require("../validation/schemas");
const {
  getAdminSummary,
  getAdminDistributors,
  updateDistributorStatus,
  deleteDistributor,
  createDistributor,
  adminResetDistributorPassword,
  getAdminCardsSummary,
  getAdminDistributionMonitoring,
  getAdminConsumerReview,
  getAdminAuditLogs,
  getAdminAuditDetail,
  forceCloseSession,
  applyAdminAlertAction,
} = require("../controllers/admin.controller");
const {
  listAuditReportRequests,
  requestAuditReport,
  reviewAuditReportRequest,
  downloadAuditReportFile,
} = require("../controllers/audit-report.controller");

router.use(protect, authorize("Admin"));

router.get("/summary", getAdminSummary);
router.get("/distributors", getAdminDistributors);
router.patch("/distributors/:userId/status", updateDistributorStatus);
router.delete("/distributors/:userId", deleteDistributor);
router.post(
  "/distributors/create",
  validate(createDistributorSchema),
  createDistributor,
);
router.patch(
  "/distributors/:userId/reset-password",
  adminResetDistributorPassword,
);
router.get("/cards/summary", getAdminCardsSummary);
router.get("/distribution/monitoring", getAdminDistributionMonitoring);
router.patch("/distribution/session/:sessionId/force-close", forceCloseSession);
router.get("/consumers/review", getAdminConsumerReview);
router.get("/audit", getAdminAuditLogs);
router.get("/audit/:id/detail", getAdminAuditDetail);
router.patch("/alerts/:id/action", applyAdminAlertAction);
router.get("/audit/requests", listAuditReportRequests);
router.post("/audit/requests", requestAuditReport);
router.patch("/audit/requests/:id/review", reviewAuditReportRequest);
router.get("/audit/requests/:id/files/:fileId", downloadAuditReportFile);

module.exports = router;
