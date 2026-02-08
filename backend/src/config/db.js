const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI missing");

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri, {
    autoIndex: false
  });

  console.log("✅ MongoDB connected");
}

module.exports = { connectDB };
