function protectIotDevice(req, res, next) {
  const providedKey = String(req.headers["x-iot-api-key"] || "").trim();
  const expectedKey = String(process.env.IOT_API_KEY || "").trim();

  if (!expectedKey) {
    return res.status(503).json({
      success: false,
      message: "IoT device key is not configured",
    });
  }

  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({
      success: false,
      message: "Invalid device key",
    });
  }

  return next();
}

module.exports = {
  protectIotDevice,
};
