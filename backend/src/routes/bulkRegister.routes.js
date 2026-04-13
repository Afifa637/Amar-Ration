"use strict";

const router = require("express").Router();
const multer = require("multer");

const { protect, authorize } = require("../middleware/auth");
const {
  uploadBulkRegister,
} = require("../controllers/bulkRegister.controller");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype === "text/csv" ||
      file.originalname.toLowerCase().endsWith(".csv") ||
      file.mimetype === "application/vnd.ms-excel";
    if (!ok) return cb(new Error("Only CSV files are allowed"));
    return cb(null, true);
  },
});

router.post(
  "/upload",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  upload.single("file"),
  uploadBulkRegister,
);

module.exports = router;
