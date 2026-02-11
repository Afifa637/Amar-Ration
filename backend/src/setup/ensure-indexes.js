require("dotenv").config();
const { connectDB } = require("../config/db");

const Token = require("../models/Token");
const QRCode = require("../models/QRCode");
const OMSCard = require("../models/OMSCard");
const DistributionSession = require("../models/DistributionSession");
const Consumer = require("../models/Consumer");

(async () => {
  await connectDB();

  console.log("➡️ Ensuring indexes...");

  await Token.syncIndexes();
  await QRCode.syncIndexes();
  await OMSCard.syncIndexes();
  await DistributionSession.syncIndexes();
  await Consumer.syncIndexes();

  console.log("✅ Indexes ensured.");
  process.exit(0);
})();
