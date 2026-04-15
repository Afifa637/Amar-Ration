"use strict";

const DistributionSession = require("../models/DistributionSession");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { assertSessionAccess } = require("../services/access-control.service");

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function setExpectedLocation(req, res) {
  try {
    await assertSessionAccess(req.user, req.params.sessionId);
    const { latitude, longitude } = req.body || {};
    if (
      !Number.isFinite(Number(latitude)) ||
      !Number.isFinite(Number(longitude))
    ) {
      return res.status(400).json({
        success: false,
        message: "latitude and longitude are required",
        code: "VALIDATION_ERROR",
      });
    }

    const session = await DistributionSession.findByIdAndUpdate(
      req.params.sessionId,
      {
        $set: {
          expectedLatitude: Number(latitude),
          expectedLongitude: Number(longitude),
        },
      },
      { new: true },
    ).lean();

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
        code: "NOT_FOUND",
      });
    }

    return res.json({ success: true, data: session });
  } catch (error) {
    if (error?.status) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message, code: error.code });
    }
    console.error("setExpectedLocation error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function logLocation(req, res) {
  try {
    await assertSessionAccess(req.user, req.params.sessionId);
    const { latitude, longitude } = req.body || {};
    if (
      !Number.isFinite(Number(latitude)) ||
      !Number.isFinite(Number(longitude))
    ) {
      return res.status(400).json({
        success: false,
        message: "latitude and longitude are required",
        code: "VALIDATION_ERROR",
      });
    }

    const session = await DistributionSession.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
        code: "NOT_FOUND",
      });
    }

    session.actualLatitude = Number(latitude);
    session.actualLongitude = Number(longitude);

    if (
      Number.isFinite(Number(session.expectedLatitude)) &&
      Number.isFinite(Number(session.expectedLongitude))
    ) {
      const dist = haversineDistanceMeters(
        Number(session.expectedLatitude),
        Number(session.expectedLongitude),
        Number(latitude),
        Number(longitude),
      );
      const tolerance =
        Number.parseInt(
          process.env.SESSION_GPS_TOLERANCE_METERS || "500",
          10,
        ) || 500;

      if (dist > tolerance) {
        session.locationAnomalyFlagged = true;

        const admins = await User.find({ userType: "Admin" })
          .select("_id")
          .lean();
        await Notification.insertMany(
          admins.map((admin) => ({
            userId: admin._id,
            channel: "App",
            title: "Location anomaly",
            message: `সেশন ${session._id}: বিতরণ কেন্দ্র থেকে ${Math.round(dist)}m দূরে`,
            meta: {
              type: "location_anomaly",
              severity: "high",
              sessionId: String(session._id),
              distanceMeters: Math.round(dist),
            },
          })),
        );
      } else {
        session.locationVerified = true;
      }
    }

    await session.save();

    return res.json({
      success: true,
      data: {
        sessionId: String(session._id),
        expectedLatitude: session.expectedLatitude,
        expectedLongitude: session.expectedLongitude,
        actualLatitude: session.actualLatitude,
        actualLongitude: session.actualLongitude,
        locationVerified: session.locationVerified,
        locationAnomalyFlagged: session.locationAnomalyFlagged,
      },
    });
  } catch (error) {
    if (error?.status) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message, code: error.code });
    }
    console.error("logLocation error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

module.exports = {
  haversineDistanceMeters,
  setExpectedLocation,
  logLocation,
};
