const router = require("express").Router();
const { protectIotDevice } = require("../middleware/iotAuth");
const {
  handleWeightReading,
  getWeightThreshold,
} = require("../controllers/iot.controller");

router.use(protectIotDevice);

router.post("/weight-reading", handleWeightReading);
router.get("/weight-threshold", getWeightThreshold);

module.exports = router;
