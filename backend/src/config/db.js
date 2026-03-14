const mongoose = require("mongoose");

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in environment variables");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const { host, name } = mongoose.connection;
  console.log(`✅ MongoDB connected | host: ${host} | database: ${name}`);
};

module.exports = { connectDB };
