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
];

function printSection(title, expected, existingSet) {
  console.log(`\n=== ${title} ===`);
  const rows = expected.map((name) => ({
    name,
    exists: existingSet.has(name),
  }));

  for (const row of rows) {
    console.log(`${row.exists ? "✅" : "❌"} ${row.name}`);
  }

  const found = rows.filter((x) => x.exists).length;
  console.log(`Summary: ${found}/${rows.length} present`);
}

(async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing in backend/.env");
    }

    await mongoose.connect(process.env.MONGO_URI);

    const db = mongoose.connection.db;
    const dbName = mongoose.connection.name;
    const host = mongoose.connection.host;

    const infos = await db.listCollections({}, { nameOnly: true }).toArray();
    const names = infos.map((c) => c.name).sort();
    const nameSet = new Set(names);

    const extras = names.filter((name) => !requiredCollections.includes(name));

    console.log(`Connected host: ${host}`);
    console.log(`Database name : ${dbName}`);
    console.log(`Collections   : ${names.length}`);

    printSection("ARREADME required collections", requiredCollections, nameSet);

    console.log("\n=== Extra Collections (candidate for cleanup) ===");
    if (!extras.length) {
      console.log("✅ None");
    } else {
      for (const name of extras) {
        console.log(`- ${name}`);
      }
    }

    console.log("\n=== Existing Collection Names ===");
    for (const name of names) {
      console.log(`- ${name}`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("verify-collections failed:", error.message);
    process.exit(1);
  }
})();
