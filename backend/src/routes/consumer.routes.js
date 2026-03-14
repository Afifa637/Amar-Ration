const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
  addConsumer,
  getConsumers,
  getConsumerById,
  updateConsumer,
  deleteConsumer,
  getConsumerStats,
} = require("../controllers/consumer.controller");

router.get(
  "/stats",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  getConsumerStats,
);

router.get(
  "/",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  getConsumers,
);

router.post(
  "/",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  addConsumer,
);

router.get(
  "/:id",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  getConsumerById,
);

router.put(
  "/:id",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  updateConsumer,
);

router.delete(
  "/:id",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  deleteConsumer,
);

module.exports = router;
