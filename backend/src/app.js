const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const { notFound, errorHandler } = require("./middleware/error");

const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const distributionRoutes = require("./routes/distribution.routes");
const monitoringRoutes = require("./routes/monitoring.routes");
const reportsRoutes = require("./routes/reports.routes");
const settingsRoutes = require("./routes/settings.routes");

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/", (req, res) => res.json({ ok: true, name: "Amar-Ration Backend (MongoDB)" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/distribution", distributionRoutes);
app.use("/api/monitoring", monitoringRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/settings", settingsRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
