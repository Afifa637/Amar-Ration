require("dotenv").config();
const fs = require("fs");
const path = require("path");
const app = require("./src/app");
const { connectDB } = require("./src/config/db");
const { startCronJobs } = require("./src/jobs/cron.jobs");
const {
  initQRRotationCron,
  initEligibilityCron,
} = require("./src/services/qrRotation.service");

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB();
  } catch (error) {
    console.error("❌ Failed to connect database during startup:", error);
    process.exit(1);
  }

  [
    process.env.RECEIPTS_DIR,
    process.env.PHOTOS_DIR,
    process.env.AUDIT_REPORT_UPLOADS_DIR,
  ].forEach((dir) => {
    if (!dir) return;
    fs.mkdirSync(path.resolve(process.cwd(), dir), { recursive: true });
  });

  const server = app.listen(PORT, () => {
    console.log(`✅ Backend running http://localhost:${PORT}`);
    if (process.env.NODE_ENV !== "test") {
      startCronJobs();
      initQRRotationCron();
      initEligibilityCron();
    }
  });

  const shutdown = (signal) => {
    console.log(`⚠️ Received ${signal}, shutting down server...`);
    server.close(() => {
      console.log("✅ HTTP server closed");
      void (async () => {
        try {
          await require("mongoose").disconnect();
          console.log("✅ MongoDB disconnected");
        } catch (error) {
          console.error("❌ MongoDB disconnect error:", error);
        } finally {
          process.exit(0);
        }
      })();
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
})();
