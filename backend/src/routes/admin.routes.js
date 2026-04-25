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
  resendDistributorCredentials,
  getAdminCardsSummary,
  getAdminDistributionMonitoring,
  getAdminConsumerReview,
  getAdminAuditLogs,
  getAdminAuditDetail,
  forceCloseSession,
  applyAdminAlertAction,
  getIotProductTargets,
  setIotProductTargets,
  getIotWeightAlerts,
  acknowledgeIotWeightAlert,
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
router.post(
  "/distributors/:userId/resend-credentials",
  resendDistributorCredentials,
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

// IoT product targets & weight alerts (global + per-distributor)
router.get("/iot/product-targets", getIotProductTargets);
router.get("/iot/product-targets/:distributorId", getIotProductTargets);
router.put("/iot/product-targets", setIotProductTargets);
router.put("/iot/product-targets/:distributorId", setIotProductTargets);
router.get("/iot/weight-alerts", getIotWeightAlerts);
router.patch("/iot/weight-alerts/:id/acknowledge", acknowledgeIotWeightAlert);

module.exports = router;
