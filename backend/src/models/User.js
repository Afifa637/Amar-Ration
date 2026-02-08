const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    userType: { type: String, enum: ["Admin", "Distributor"], required: true },
    name: { type: String, required: true },
    phone: { type: String, unique: true, sparse: true },
    email: { type: String, unique: true, sparse: true },
    passwordHash: { type: String, required: true },
    status: { type: String, enum: ["Active", "Inactive", "Suspended"], default: "Active" },
    lastLoginAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
