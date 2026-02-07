// Import required packages
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Create Express application
const app = express();

// Security middleware - Helmet sets various HTTP headers to help protect your app
app.use(helmet());

// CORS middleware - allows cross-origin requests
app.use(cors());

// Body parser middleware - parses incoming request bodies in a middleware before your handlers, available under the req.body property
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting - prevents too many requests from a single IP address
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// API info endpoint
app.get('/api', (req, res) => {
    res.json({
        message: 'AI Quiz Platform API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            auth: '/api/auth',
            quiz: '/api/quiz'
        }
    });
});

// 404 handler - catches requests to undefined routes
app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.path,
        method: req.method
    });
});

// Global error handler - catches all unhandled errors
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Export the Express app
module.exports = app;