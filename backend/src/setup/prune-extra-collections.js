require("dotenv").config();
const mongoose = require("mongoose");

const requiredCollections = [
  "users",
  "distributors",
  "consumers",
  "families",
  "omscards",
  "qrcodes",
  "tokens",
  "distributionsessions",
  "distributionrecords",
  "stockledgers",
  "auditlogs",
  "auditreportrequests",
  "blacklistentries",
  "offlinequeues",
  "notifications",
  "smsoutboxes",
  "refreshtokens",
  "systemsettings",
  "complaints",
  "blacklistappeals",
];

(async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing in backend/.env");
    }

    await mongoose.connect(process.env.MONGO_URI);

    const db = mongoose.connection.db;
    const infos = await db.listCollections({}, { nameOnly: true }).toArray();
    const existing = infos.map((x) => x.name);
    const extras = existing.filter(
      (name) => !requiredCollections.includes(name),
    );

    console.log(
      `Connected: ${mongoose.connection.host}/${mongoose.connection.name}`,
    );
    console.log(`Required collections: ${requiredCollections.length}`);

    if (!extras.length) {
      console.log("✅ No extra collections found.");
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log("Extra collections:");
    for (const name of extras) {
      console.log(`- ${name}`);
    }

    const confirm = String(process.env.CONFIRM_DROP || "").toLowerCase();
    if (confirm !== "yes") {
      console.log(
        "\nDry-run only. To actually drop these collections, run with CONFIRM_DROP=yes",
      );
      await mongoose.disconnect();
      process.exit(0);
    }

    for (const name of extras) {
      await db.dropCollection(name);
      console.log(`Dropped: ${name}`);
    }

    console.log("✅ Extra collections removed.");
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("prune-extra-collections failed:", error.message);
    process.exit(1);
  }
})();
