"use strict";

const fs = require("fs");
const path = require("path");
const multer = require("multer");
const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const {
  createAppeal,
  downloadAppealFile,
  listAppeals,
  reviewAppeal,
} = require("../controllers/blacklistAppeal.controller");

const appealUploadsDir = path.resolve(
  process.cwd(),
  process.env.APPEAL_UPLOADS_DIR || "./uploads/appeals",
);
fs.mkdirSync(appealUploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, appealUploadsDir),
  filename: (req, file, cb) => {
    const safeName = String(file.originalname || "file")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 60);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new Error("Only PDF/DOC/DOCX files are allowed"));
  },
});

router.post(
  "/",
  protect,
  authorize("Distributor"),
  upload.array("attachments", 5),
  createAppeal,
);
router.get("/", protect, authorize("Admin"), listAppeals);
router.get(
  "/:appealId/files/:fileId",
  protect,
  authorize("Admin", "Distributor"),
  downloadAppealFile,
);
router.patch("/:appealId/review", protect, authorize("Admin"), reviewAppeal);

module.exports = router;
