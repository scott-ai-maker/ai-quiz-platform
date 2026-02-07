// Import mongoose library for MongoDB connection
const mongoose = require("mongoose");

// Load environment variables from the .env file
require("dotenv").config();

// Async function to establish database connection
const connectDB = async () => {
  try {
    // Connect to MongoDB using connection string from environment variables
    // No options needed in Mongoose 6+ (they're now defaults)
    await mongoose.connect(process.env.MONGODB_URI);

    // Log success message with emoji
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    // Log error message with emoji
    console.error("❌ MongoDB connection failed:", error.message);

    // Exit process with failure code (1 = error, 0 = success)
    process.exit(1);
  }
};

// Export the function so other files can see it
module.exports = connectDB;
