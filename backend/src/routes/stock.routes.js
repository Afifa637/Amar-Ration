const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
  addStockIn,
  getStockSummary,
} = require("../controllers/stock.controller");

router.post("/in", protect, authorize("Admin"), addStockIn);
router.get(
  "/summary",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  getStockSummary,
);

module.exports = router;
