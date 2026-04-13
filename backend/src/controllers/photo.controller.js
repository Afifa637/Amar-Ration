"use strict";

const fs = require("fs");
const path = require("path");

const Consumer = require("../models/Consumer");

function photosDir() {
  return path.resolve(
    process.cwd(),
    process.env.PHOTOS_DIR || "./uploads/photos",
  );
}

function ensureDir() {
  fs.mkdirSync(photosDir(), { recursive: true });
}

function loadSharp() {
  try {
    return require("sharp");
  } catch {
    return null;
  }
}

async function uploadPhoto(req, res) {
  try {
    const consumer = await Consumer.findById(req.params.consumerId)
      .select("consumerCode")
      .lean();
    if (!consumer) {
      return res.status(404).json({
        success: false,
        message: "Consumer not found",
        code: "NOT_FOUND",
      });
    }

    if (!req.file?.path) {
      return res.status(400).json({
        success: false,
        message: "Image file is required",
        code: "VALIDATION_ERROR",
      });
    }

    ensureDir();

    const resizedPath = path.resolve(
      photosDir(),
      `${consumer.consumerCode}-${Date.now()}.jpg`,
    );

    const sharp = loadSharp();
    if (!sharp) {
      return res.status(503).json({
        success: false,
        message: "Photo processing service is unavailable",
        code: "PHOTO_SERVICE_UNAVAILABLE",
      });
    }

    await sharp(req.file.path)
      .resize(300, 300)
      .jpeg({ quality: 80 })
      .toFile(resizedPath);
    fs.unlinkSync(req.file.path);

    await Consumer.findByIdAndUpdate(req.params.consumerId, {
      $set: { photoPath: resizedPath },
    });

    return res.json({
      success: true,
      data: { photoUrl: `/api/photos/${consumer.consumerCode}` },
    });
  } catch (error) {
    console.error("uploadPhoto error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function streamPhotoByConsumerCode(req, res) {
  try {
    const consumer = await Consumer.findOne({
      consumerCode: req.params.consumerCode,
    })
      .select("photoPath")
      .lean();

    if (!consumer?.photoPath || !fs.existsSync(consumer.photoPath)) {
      return res
        .status(404)
        .json({ success: false, message: "ছবি নেই", code: "NOT_FOUND" });
    }

    return res.sendFile(path.resolve(consumer.photoPath));
  } catch (error) {
    console.error("streamPhotoByConsumerCode error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function verifyPhotoInfo(req, res) {
  try {
    const consumer = await Consumer.findById(req.params.consumerId)
      .select("name consumerCode category ward photoPath")
      .lean();

    if (!consumer) {
      return res.status(404).json({
        success: false,
        message: "Consumer not found",
        code: "NOT_FOUND",
      });
    }

    const hasPhoto = Boolean(
      consumer.photoPath && fs.existsSync(consumer.photoPath),
    );

    return res.json({
      success: true,
      data: {
        name: consumer.name,
        consumerCode: consumer.consumerCode,
        category: consumer.category,
        ward: consumer.ward,
        photoUrl: hasPhoto ? `/api/photos/${consumer.consumerCode}` : null,
        hasPhoto,
      },
    });
  } catch (error) {
    console.error("verifyPhotoInfo error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

module.exports = {
  uploadPhoto,
  streamPhotoByConsumerCode,
  verifyPhotoInfo,
};
