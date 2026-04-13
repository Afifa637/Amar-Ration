const mongoose = require("mongoose");
const { normalizeWardNo: _normWard } = require("../utils/ward.utils");
const { normalizeDivision: _normDiv } = require("../utils/division.utils");

const UserSchema = new mongoose.Schema(
  {
    userType: {
      type: String,
      enum: ["Admin", "Distributor", "FieldUser", "Consumer"],
      required: true,
    },
    name: { type: String, required: true },
    phone: { type: String, unique: true, sparse: true },
    email: { type: String, unique: true, sparse: true },
    contactEmail: { type: String, sparse: true },
    passwordHash: { type: String, required: true },
    passwordChangedAt: { type: Date },
    tokenVersion: { type: Number, default: 0 },
    mustChangePassword: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    twoFactorTempSecret: { type: String, select: false },
    twoFactorTempSecretCreatedAt: { type: Date, select: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorBackupCodes: { type: [String], select: false },
    pendingSuspend: { type: Boolean, default: false },
    pendingSuspendAt: { type: Date },
    pendingSuspendReason: { type: String },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Suspended"],
      default: "Active",
    },
    lastLoginAt: { type: Date },

    // Consumer-specific fields (only for userType: "Consumer")
    consumerCode: { type: String, unique: true, sparse: true },
    nidLast4: { type: String },
    category: { type: String, enum: ["A", "B", "C"] },
    qrToken: { type: String, unique: true, sparse: true }, // QR scanning token for consumers

    // Distributor & FieldUser fields
    wardNo: { type: String }, // for Distributor and FieldUser
    officeAddress: { type: String }, // only for Distributor
    division: String,
    district: String,
    upazila: String,
    unionName: String,
    ward: String,
    authorityStatus: {
      type: String,
      enum: ["Pending", "Active", "Revoked", "Suspended"],
    },
    authorityFrom: { type: Date },
    authorityTo: { type: Date },
  },
  { timestamps: true },
);

UserSchema.index(
  { division: 1, wardNo: 1, userType: 1 },
  {
    unique: true,
    sparse: false,
    name: "unique_distributor_user_per_ward_per_division",
    partialFilterExpression: { userType: "Distributor" },
  },
);

UserSchema.pre("save", function (next) {
  if (this.division) {
    this.division = _normDiv(this.division) || this.division;
  }
  if (this.wardNo) {
    this.wardNo = _normWard(this.wardNo) || this.wardNo;
  }
  if (this.ward) {
    this.ward = _normWard(this.ward) || this.ward;
  }
  next();
});

UserSchema.pre(
  ["findOneAndUpdate", "updateOne", "updateMany"],
  function (next) {
    const update = this.getUpdate();
    const doc = update?.$set || update;
    if (doc?.division) doc.division = _normDiv(doc.division) || doc.division;
    if (doc?.wardNo) doc.wardNo = _normWard(doc.wardNo) || doc.wardNo;
    if (doc?.ward) doc.ward = _normWard(doc.ward) || doc.ward;
    next();
  },
);

module.exports = mongoose.model("User", UserSchema);
