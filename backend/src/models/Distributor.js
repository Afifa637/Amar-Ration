const mongoose = require("mongoose");

const DistributorSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true },
    division: String,
    district: String,
    upazila: String,
    unionName: String,
    ward: String,
    authorityStatus: { type: String, enum: ["Active", "Revoked", "Suspended"], default: "Active" },
    authorityFrom: { type: Date, default: Date.now },
    authorityTo: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Distributor", DistributorSchema);
