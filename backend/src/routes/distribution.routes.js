const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { allowUserTypes } = require("../middleware/rbac");
const { scanAndIssueToken } = require("../controllers/distribution.controller");

router.post("/scan", auth, allowUserTypes("Distributor"), scanAndIssueToken);

module.exports = router;
