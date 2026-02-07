// Import the Anthropic SDK
const Anthropic = require("@anthropic-ai/sdk");

// Load environment variables from the .env file
require("dotenv").config();

// Initialize Claude client with API key from environment variables
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// Export the Claude client so other files can use it
module.exports = anthropic;
