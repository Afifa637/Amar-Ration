const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { allowUserTypes } = require("../middleware/rbac");
const { scanAndIssueToken, completeDistribution } = require("../controllers/distribution.controller");

router.post("/scan", auth, allowUserTypes("Distributor"), scanAndIssueToken);
router.post("/complete", auth, allowUserTypes("Distributor"), completeDistribution);

module.exports = router;
