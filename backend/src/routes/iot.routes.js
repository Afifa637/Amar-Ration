const router = require("express").Router();
const { protectIotDevice } = require("../middleware/iotAuth");
const {
  handleWeightReading,
  getWeightThreshold,
  getProductTargets,
} = require("../controllers/iot.controller");

router.use(protectIotDevice);

router.post("/weight-reading", handleWeightReading);
router.get("/weight-threshold", getWeightThreshold);
router.get("/product-targets", getProductTargets);

module.exports = router;
