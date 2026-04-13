"use strict";

const { validateConsumerPayload } = require("../utils/validators");

function validateConsumer(req, res, next) {
  const result = validateConsumerPayload(req.body || {});
  if (!result.valid) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      errors: result.errors,
    });
  }

  req.cleanedBody = result.cleaned;
  return next();
}

module.exports = { validateConsumer };
