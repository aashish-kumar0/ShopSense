const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // These two options silence deprecation warnings in Mongoose 8
      // serverSelectionTimeoutMS tells Mongoose to give up after 5s
      // instead of hanging forever if Atlas is unreachable
      serverSelectionTimeoutMS: 5000,
    });
    
    console.log(`✅ MongoDB connected`);
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    // Exit the process — no point running a shopping app with no database
    process.exit(1);
  }
};

// Mongoose lifecycle events — good for debugging connection drops
mongoose.connection.on("disconnected", () => {
  console.warn("⚠️  MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  console.log("🔄 MongoDB reconnected");
});

module.exports = connectDB;