const mongoose = require("mongoose");

const SystemSettingSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true },
    value: { type: Object, required: true }
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

module.exports = mongoose.model("SystemSetting", SystemSettingSchema);
