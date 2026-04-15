"use strict";

const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { protect, authorize } = require("../middleware/auth");
const {
  uploadPhoto,
  streamPhotoByConsumerCode,
  verifyPhotoInfo,
} = require("../controllers/photo.controller");

const photosDir = path.resolve(
  process.cwd(),
  process.env.PHOTOS_DIR || "./uploads/photos",
);
fs.mkdirSync(photosDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, photosDir),
  filename: (req, file, cb) => {
    const safePart = String(req.params.consumerId || "consumer").replace(
      /[^a-zA-Z0-9_-]/g,
      "",
    );
    cb(null, `${safePart || "consumer"}-${Date.now()}.jpg`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!["image/jpeg", "image/png"].includes(file.mimetype)) {
      return cb(new Error("Only JPEG/PNG allowed"));
    }
    return cb(null, true);
  },
});

router.post(
  "/upload/:consumerId",
  protect,
  authorize("Distributor", "FieldUser", "Admin"),
  upload.single("photo"),
  uploadPhoto,
);
router.get(
  "/verify/:consumerId",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  verifyPhotoInfo,
);
router.get(
  "/:consumerCode",
  protect,
  authorize("Admin", "Distributor", "FieldUser"),
  streamPhotoByConsumerCode,
);

module.exports = router;
