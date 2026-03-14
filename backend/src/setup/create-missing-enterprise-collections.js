require("dotenv").config();
const mongoose = require("mongoose");

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

(async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing in backend/.env");
    }

    await mongoose.connect(process.env.MONGO_URI);

    const db = mongoose.connection.db;
    const infos = await db.listCollections({}, { nameOnly: true }).toArray();
    const existing = new Set(infos.map((x) => x.name));

    const created = [];
    const alreadyThere = [];

    for (const name of enterpriseTargetCollections) {
      if (existing.has(name)) {
        alreadyThere.push(name);
        continue;
      }

      await db.createCollection(name);
      created.push(name);
    }

    console.log(
      `Connected: ${mongoose.connection.host}/${mongoose.connection.name}`,
    );
    console.log(`Created collections: ${created.length}`);
    for (const name of created) console.log(`+ ${name}`);

    console.log(`Already existed: ${alreadyThere.length}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(
      "create-missing-enterprise-collections failed:",
      error.message,
    );
    process.exit(1);
  }
})();
