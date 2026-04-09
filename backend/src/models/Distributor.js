const mongoose = require("mongoose");
const { normalizeWardNo } = require("../utils/ward.utils");
const { normalizeDivision } = require("../utils/division.utils");

const DistributorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },
    division: String,
    district: String,
    upazila: String,
    unionName: String,
    wardNo: String,
    ward: String,
    authorityStatus: {
      type: String,
      enum: ["Pending", "Active", "Revoked", "Suspended"],
      default: "Active",
    },
    authorityFrom: { type: Date, default: Date.now },
    authorityTo: { type: Date },
  },
  { timestamps: true },
);

// CRITICAL: Normalize division and ward before every save
// This ensures the unique index on (division, wardNo) works correctly
// regardless of whether Bangla or English input was used
DistributorSchema.pre("save", function (next) {
  if (this.division) {
    this.division = normalizeDivision(this.division) || this.division;
  }
  if (this.wardNo) {
    this.wardNo = normalizeWardNo(this.wardNo) || this.wardNo;
  }
  if (this.ward) {
    this.ward = normalizeWardNo(this.ward) || this.ward;
  }
  next();
});

// Also normalize on findOneAndUpdate / updateOne / updateMany
DistributorSchema.pre(
  ["findOneAndUpdate", "updateOne", "updateMany"],
  function (next) {
    const update = this.getUpdate();
    const doc = update?.$set || update;
    if (doc?.division)
      doc.division = normalizeDivision(doc.division) || doc.division;
    if (doc?.wardNo) doc.wardNo = normalizeWardNo(doc.wardNo) || doc.wardNo;
    if (doc?.ward) doc.ward = normalizeWardNo(doc.ward) || doc.ward;
    next();
  },
);

DistributorSchema.index(
  { division: 1, wardNo: 1 },
  {
    unique: true,
    sparse: false,
    name: "unique_distributor_per_ward_per_division",
    partialFilterExpression: {
      division: { $exists: true, $type: "string", $gt: "" },
      wardNo: { $exists: true, $type: "string", $gt: "" },
    },
  },
);

module.exports = mongoose.model("Distributor", DistributorSchema);
