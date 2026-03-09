const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { allowUserTypes } = require("../middleware/rbac");
const {
  getDistributorDashboard,
  getBeneficiaries,
  getDistributorTokens,
  getDistributorAudit,
  getDistributorReports,
  getDistributorMonitoring,
  getDistributorSettings,
} = require("../controllers/distributor.controller");

router.use(auth, allowUserTypes("Distributor", "Admin"));

router.get("/dashboard", getDistributorDashboard);
router.get("/beneficiaries", getBeneficiaries);
router.get("/tokens", getDistributorTokens);
router.get("/audit", getDistributorAudit);
router.get("/reports", getDistributorReports);
router.get("/monitoring", getDistributorMonitoring);
router.get("/settings", getDistributorSettings);

module.exports = router;