const mongoose = require("mongoose");
const {
  normalizeNid,
  encryptNid,
  decryptNid,
  hashNid,
} = require("../services/nid-security.service");
const { normalizeWardNo: _normConsumerWard } = require("../utils/ward.utils");
const {
  normalizeDivision: _normConsumerDiv,
} = require("../utils/division.utils");

const ConsumerSchema = new mongoose.Schema(
  {
    consumerCode: { type: String, unique: true, required: true }, // C0001
    qrToken: { type: String, unique: true, required: true }, // 64-char hex token for QR scanning
    name: { type: String, required: true },
    nidLast4: { type: String, required: true },
    nidFull: { type: String, required: true },
    fatherNidFull: { type: String, required: true },
    motherNidFull: { type: String, required: true },
    nidHash: { type: String, index: true },
    fatherNidHash: { type: String, index: true },
    motherNidHash: { type: String, index: true },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Revoked"],
      default: "Inactive",
    },
    category: { type: String, enum: ["A", "B", "C"], default: "A" },

    familyId: { type: mongoose.Schema.Types.ObjectId, ref: "Family" },
    createdByDistributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Distributor",
    },

    division: String,
    district: String,
    upazila: String,
    unionName: String,
    ward: String,

    blacklistStatus: {
      type: String,
      enum: ["None", "Temp", "Permanent"],
      default: "None",
    },
  },
  { timestamps: true },
);

ConsumerSchema.index({
  division: 1,
  district: 1,
  upazila: 1,
  unionName: 1,
  ward: 1,
});

ConsumerSchema.pre("validate", function preValidate(next) {
  const nid = normalizeNid(decryptNid(this.nidFull));
  const father = normalizeNid(decryptNid(this.fatherNidFull));
  const mother = normalizeNid(decryptNid(this.motherNidFull));

  if (nid) {
    this.nidFull = encryptNid(nid);
    this.nidHash = hashNid(nid);
    this.nidLast4 = nid.slice(-4);
  }

  if (father) {
    this.fatherNidFull = encryptNid(father);
    this.fatherNidHash = hashNid(father);
  }

  if (mother) {
    this.motherNidFull = encryptNid(mother);
    this.motherNidHash = hashNid(mother);
  }

  next();
});

ConsumerSchema.pre("save", function (next) {
  if (this.ward) this.ward = _normConsumerWard(this.ward) || this.ward;
  if (this.division) {
    this.division = _normConsumerDiv(this.division) || this.division;
  }
  next();
});

ConsumerSchema.pre(
  ["findOneAndUpdate", "updateOne", "updateMany"],
  function (next) {
    const update = this.getUpdate();
    const doc = update?.$set || update;
    if (doc?.ward) doc.ward = _normConsumerWard(doc.ward) || doc.ward;
    if (doc?.division) {
      doc.division = _normConsumerDiv(doc.division) || doc.division;
    }
    next();
  },
);

module.exports = mongoose.model("Consumer", ConsumerSchema);
