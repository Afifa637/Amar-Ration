require("dotenv").config();
const { connectDB } = require("../config/db");

const User = require("../models/User");
const Distributor = require("../models/Distributor");
const Token = require("../models/Token");
const QRCode = require("../models/QRCode");
const OMSCard = require("../models/OMSCard");
const DistributionSession = require("../models/DistributionSession");
const Consumer = require("../models/Consumer");
const AuditLog = require("../models/AuditLog");
const BlacklistEntry = require("../models/BlacklistEntry");
const StockLedger = require("../models/StockLedger");

(async () => {
  try {
    await connectDB();

    console.log("➡️  Ensuring all indexes...");

    // Drop the old distributor compound index if it exists (to force recreation with $nin)
    try {
      await Distributor.collection.dropIndex(
        "unique_distributor_per_ward_per_division",
      );
      console.log("  Dropped old distributor ward+division index for rebuild.");
    } catch (_) {
      // Index may not exist yet — ignore
    }

    await Promise.all([
      User.syncIndexes(),
      Distributor.syncIndexes(),
      Token.syncIndexes(),
      QRCode.syncIndexes(),
      OMSCard.syncIndexes(),
      DistributionSession.syncIndexes(),
      Consumer.syncIndexes(),
      AuditLog.syncIndexes(),
      BlacklistEntry.syncIndexes(),
      StockLedger.syncIndexes(),
    ]);

    console.log("✅ All indexes synchronized successfully.");
    console.log("   Key indexes created:");
    console.log("   - Distributor: unique (division, wardNo)");
    console.log("   - User: unique (division, wardNo) for Distributor type");
    console.log("   - Token: unique (consumerId, sessionId)");
    console.log("   - Consumer: indexed nidHash, fatherNidHash, motherNidHash");
    process.exit(0);
  } catch (err) {
    console.error("❌ Index sync failed:", err.message);
    process.exit(1);
  }
})();
