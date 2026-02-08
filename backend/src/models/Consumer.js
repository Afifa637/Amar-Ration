const mongoose = require("mongoose");

const ConsumerSchema = new mongoose.Schema(
  {
    consumerCode: { type: String, unique: true, required: true }, // C0001
    name: { type: String, required: true },
    nidLast4: { type: String, required: true },
    status: { type: String, enum: ["Active", "Inactive", "Revoked"], default: "Inactive" },
    category: { type: String, enum: ["A", "B", "C"], default: "A" },

    familyId: { type: mongoose.Schema.Types.ObjectId, ref: "Family" },
    createdByDistributor: { type: mongoose.Schema.Types.ObjectId, ref: "Distributor" },

    division: String,
    district: String,
    upazila: String,
    unionName: String,
    ward: String,

    blacklistStatus: { type: String, enum: ["None", "Temp", "Permanent"], default: "None" }
  },
  { timestamps: true }
);

ConsumerSchema.index({ division: 1, district: 1, upazila: 1, unionName: 1, ward: 1 });

module.exports = mongoose.model("Consumer", ConsumerSchema);
