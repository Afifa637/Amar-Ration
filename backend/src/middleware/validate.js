"use strict";

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      const first = errors[0];
      const message = first
        ? `Validation failed: ${first.field || "field"} - ${first.message}`
        : "Validation failed";

      return res.status(400).json({
        success: false,
        message,
        errors,
      });
    }

    req.body = result.data;
    next();
  };
}

module.exports = { validate };
