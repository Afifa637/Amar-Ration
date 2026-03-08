const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    userType: { type: String, enum: ["Admin", "Distributor", "FieldUser", "Consumer"], required: true },
    name: { type: String, required: true },
    phone: { type: String, unique: true, sparse: true },
    email: { type: String, unique: true, sparse: true },
    passwordHash: { type: String, required: true },
    status: { type: String, enum: ["Active", "Inactive", "Suspended"], default: "Active" },
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
    authorityStatus: { type: String, enum: ["Active", "Revoked", "Suspended"] },
    authorityFrom: { type: Date },
    authorityTo: { type: Date }
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 });
UserSchema.index({ phone: 1 });
UserSchema.index({ consumerCode: 1 });

module.exports = mongoose.model("User", UserSchema);
