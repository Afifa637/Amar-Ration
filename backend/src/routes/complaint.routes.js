"use strict";

const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
  createComplaint,
  listComplaints,
  getComplaintById,
  resolveComplaint,
  complaintStats,
} = require("../controllers/complaint.controller");

router.post("/", createComplaint);
router.get("/", protect, authorize("Admin"), listComplaints);
router.get("/stats", protect, authorize("Admin"), complaintStats);
router.get("/:complaintId", protect, authorize("Admin"), getComplaintById);
router.patch(
  "/:complaintId/resolve",
  protect,
  authorize("Admin"),
  resolveComplaint,
);

module.exports = router;
