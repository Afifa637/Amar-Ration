require("dotenv").config();
const mongoose = require("mongoose");

const workingCollections = [
  "users",
  "distributors",
  "families",
  "consumers",
  "qrcodes",
  "omscards",
  "tokens",
  "distributionsessions",
  "distributionrecords",
  "stockledgers",
  "systemsettings",
  "auditlogs",
  "blacklistentries",
  "offlinequeues",
];

const enterpriseTargetCollections = [
  "users",
  "roles",
  "permissions",
  "role_permissions",
  "user_roles",
  "refresh_tokens",
  "login_sessions",

  "distributor_applications",
  "distributors",
  "distributor_assignments",
  "distributor_status_history",
  "distributor_devices",
  "distributor_audit_flags",
  "distributor_performance_daily",

  "divisions",
  "districts",
  "upazilas",
  "unions",
  "wards",
  "dealer_points",

  "families",
  "family_members",
  "consumers",
  "consumer_long_list",
  "verification_cases",
  "verification_visits",
  "consumer_status_history",

  "oms_cards",
  "qr_codes",
  "qr_rotation_batches",
  "qr_scan_events",
  "card_revocation_requests",

  "distribution_sessions",
  "short_list_entries",
  "tokens",
  "token_batches",
  "distribution_records",
  "distribution_slots",
  "distribution_pauses",
  "resource_reconciliations",

  "stock_items",
  "stock_lots",
  "warehouses",
  "stock_balances",
  "stock_ledger",
  "allocation_rules",

  "iot_devices",
  "weight_readings",
  "weight_mismatch_events",

  "fraud_flags",
  "blacklist_entries",
  "audit_logs",
  "notifications",
  "sms_outbox",
  "offline_queue",
  "system_settings",
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

    console.log(`Connected host: ${host}`);
    console.log(`Database name : ${dbName}`);
    console.log(`Collections   : ${names.length}`);

    printSection(
      "Current App Working Collections",
      workingCollections,
      nameSet,
    );
    printSection(
      "Enterprise 35+ Target Collections",
      enterpriseTargetCollections,
      nameSet,
    );

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
