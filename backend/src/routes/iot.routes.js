const router = require("express").Router();
const { protectIotDevice } = require("../middleware/iotAuth");
const {
  handleWeightReading,
  getWeightThreshold,
  getPendingToken,
  getProductTargets,
  receiveWeightAlert,
  receiveCollectedData,
} = require("../controllers/iot.controller");

router.use(protectIotDevice);

router.post("/weight-reading", handleWeightReading);
router.get("/weight-threshold", getWeightThreshold);
router.get("/pending-token", getPendingToken);
router.get("/product-targets", getProductTargets);
router.post("/weight-alert", receiveWeightAlert);
router.post("/collected-data", receiveCollectedData);

module.exports = router;
