// Import the Express app
const app = require('./app');
const connectDB = require('./config/database');
require('dotenv').config();

// Get port from environment or use default
const PORT = process.env.PORT || 3000;

// Start server function
const startServer = async () => {
    try {
        // Connect to database
        await connectDB();
        console.log('🤖 Claude AI API configured successfully');

        // Start listening
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📝 Visit http://localhost:${PORT}/health to verify setup`);

        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Start the server
startServer();