const express = require("express");
const router = express.Router();
const consumerController = require("../controllers/consumer.controller");
const { protect } = require("../middleware/auth");

// All routes require authentication
router.use(protect);

// Consumer CRUD routes
router.post("/", consumerController.addConsumer);
router.get("/", consumerController.getConsumers);
router.get("/stats", consumerController.getConsumerStats);
router.get("/:id", consumerController.getConsumerById);
router.put("/:id", consumerController.updateConsumer);
router.delete("/:id", consumerController.deleteConsumer);

module.exports = router;
