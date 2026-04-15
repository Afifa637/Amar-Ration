const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getDistributorDashboard,
  getBeneficiaries,
  getDistributorTokens,
  getDistributorAudit,
  getDistributorReports,
  getDistributorMonitoring,
  getDistributorSettings,
  getPendingFieldUsers,
  approveFieldUser,
  rejectFieldUser,
} = require("../controllers/distributor.controller");
const {
  listMyAuditReportRequests,
  submitAuditReport,
} = require("../controllers/audit-report.controller");

router.use(protect, authorize("Distributor", "Admin"));

router.get("/dashboard", getDistributorDashboard);
router.get("/beneficiaries", getBeneficiaries);
router.get("/tokens", getDistributorTokens);
router.get("/audit", getDistributorAudit);
router.get("/reports", getDistributorReports);
router.get("/monitoring", getDistributorMonitoring);
router.get("/settings", getDistributorSettings);
router.get("/audit-requests", listMyAuditReportRequests);
router.post("/audit-requests/:id/submit", submitAuditReport);

// FieldUser approval routes
router.get("/field-users/pending", getPendingFieldUsers);
router.post("/field-users/:id/approve", approveFieldUser);
router.post("/field-users/:id/reject", rejectFieldUser);

module.exports = router;
