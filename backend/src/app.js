const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const { notFound, errorHandler } = require("./middleware/error");

const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const distributionRoutes = require("./routes/distribution.routes");
const monitoringRoutes = require("./routes/monitoring.routes");
const reportsRoutes = require("./routes/reports.routes");
const settingsRoutes = require("./routes/settings.routes");
const consumerRoutes = require("./routes/consumer.routes");
const adminRoutes = require("./routes/admin.routes");
const distributorRoutes = require("./routes/distributor.routes");
const stockRoutes = require("./routes/stock.routes");
const notificationRoutes = require("./routes/notification.routes");
const iotRoutes = require("./routes/iot.routes");
const fieldRoutes = require("./routes/field.routes");

// Validate critical environment variables
const requiredEnv = ["MONGO_URI", "JWT_SECRET", "NID_ENCRYPTION_KEY"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}
if (process.env.NID_ENCRYPTION_KEY === process.env.JWT_SECRET) {
  console.error("FATAL: NID_ENCRYPTION_KEY must be different from JWT_SECRET");
  process.exit(1);
}
console.log("✅ Environment validation passed");

const app = express();

app.set("etag", false);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_LOGIN_MAX || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "অনেকবার চেষ্টা করা হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন।",
  },
});

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (mobile apps, curl, Postman in dev)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(helmet());
app.use(globalLimiter);
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

app.get("/", (req, res) =>
  res.json({ ok: true, name: "Amar-Ration Backend (MongoDB)" }),
);

app.use("/api/auth/login", loginLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/distribution", distributionRoutes);
app.use("/api/monitoring", monitoringRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/consumers", consumerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/distributor", distributorRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/iot", iotRoutes);
app.use("/api/field", fieldRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
