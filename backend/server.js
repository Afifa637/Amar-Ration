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
  await connectDB();

  [process.env.RECEIPTS_DIR, process.env.PHOTOS_DIR].forEach((dir) => {
    if (!dir) return;
    fs.mkdirSync(path.resolve(process.cwd(), dir), { recursive: true });
  });

  app.listen(PORT, () => {
    console.log(`✅ Backend running http://localhost:${PORT}`);
    if (process.env.NODE_ENV !== "test") {
      startCronJobs();
      initQRRotationCron();
      initEligibilityCron();
    }
  });
})();
