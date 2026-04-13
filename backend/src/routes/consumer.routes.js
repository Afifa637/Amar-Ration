const express = require("express");
const router = express.Router();
const consumerController = require("../controllers/consumer.controller");
const { protect, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { registerConsumerSchema } = require("../validation/schemas");

// All routes require authentication
router.use(protect);

// Consumer CRUD routes
router.post(
  "/",
  authorize("Distributor", "FieldUser"),
  validate(registerConsumerSchema),
  consumerController.addConsumer,
);
router.get("/", consumerController.getConsumers);
router.get("/stats", consumerController.getConsumerStats);
router.get("/cards", consumerController.listConsumerCards);
router.get("/:id/card", consumerController.getConsumerCard);
router.delete(
  "/:id/card",
  authorize("Admin"),
  consumerController.deleteConsumerCard,
);
router.get("/:id", consumerController.getConsumerById);
router.put("/:id", consumerController.updateConsumer);
router.post("/:id/card/reissue", consumerController.reissueConsumerCard);
router.delete("/:id", consumerController.deleteConsumer);

module.exports = router;
