const mongoose = require("mongoose");

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in environment variables");
  }

  mongoose.connection.on("error", (error) => {
    console.error("❌ MongoDB connection error:", error.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("⚠️ MongoDB disconnected");
  });

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 20),
  });

  const { host, name } = mongoose.connection;
  console.log(`✅ MongoDB connected | host: ${host} | database: ${name}`);
};

module.exports = { connectDB };
