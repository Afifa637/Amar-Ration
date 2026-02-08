const mongoose = require("mongoose");

const FamilySchema = new mongoose.Schema(
  {
    familyKey: { type: String, unique: true, required: true },
    fatherNidLast4: String,
    motherNidLast4: String,
    flaggedDuplicate: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Family", FamilySchema);
