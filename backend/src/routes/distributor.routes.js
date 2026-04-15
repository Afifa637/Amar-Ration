const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const multer = require("multer");
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
  downloadAuditReportFile,
} = require("../controllers/audit-report.controller");

const auditUploadsDir = path.resolve(
  process.cwd(),
  process.env.AUDIT_REPORT_UPLOADS_DIR || "./uploads/audit-reports",
);
fs.mkdirSync(auditUploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, auditUploadsDir),
  filename: (req, file, cb) => {
    const safeName = String(file.originalname || "file")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-80);
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const uploadAuditFiles = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
});

router.use(protect, authorize("Distributor", "Admin"));

router.get("/dashboard", getDistributorDashboard);
router.get("/beneficiaries", getBeneficiaries);
router.get("/tokens", getDistributorTokens);
router.get("/audit", getDistributorAudit);
router.get("/reports", getDistributorReports);
router.get("/monitoring", getDistributorMonitoring);
router.get("/settings", getDistributorSettings);
router.get("/audit-requests", listMyAuditReportRequests);
router.post(
  "/audit-requests/:id/submit",
  uploadAuditFiles.array("files", 10),
  submitAuditReport,
);
router.get("/audit-requests/:id/files/:fileId", downloadAuditReportFile);

// FieldUser approval routes
router.get("/field-users/pending", getPendingFieldUsers);
router.post("/field-users/:id/approve", approveFieldUser);
router.post("/field-users/:id/reject", rejectFieldUser);

module.exports = router;
