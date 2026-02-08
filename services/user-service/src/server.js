// User Service - Port 3001
// Handles: User registration, login, and profile management

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const SERVICE_NAME = process.env.SERVICE_NAME || 'user-service';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint - Required for load balancers and monitoring
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: SERVICE_NAME,
        timestamp: new Date().toISOString()
    });
});

// Service info endpoint - Provides basic information about the service
app.get('/api/info', (req, res) => {
    res.json({
        message: "User Service API",
        version: "1.0.0",
        service: SERVICE_NAME,
        port: PORT,
        endpoints: {
            health: '/health',
            register: 'POST /api/users/register',
            login: 'POST /api/users/login',
            profile: 'GET /api/users/profile'
        }
    });
});

// In-memory user storage (replace with database later)
const users = [];
let userIdCounter = 1;

// Register endpoint
app.post('/api/users/register', (req, res) => {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
        return res.status(400).json({
            error: 'Missing required fields',
            required: ['email', 'password', 'name']
        });
    }

    // Check if user already exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
        return res.status(409).json({
            error: 'User already exists',
            email
        });
    }

    // Create new user (in production, hash the password!)
    const newUser = {
        id: userIdCounter++,
        email,
        password, // WARNING: Store hashed passwords in production!
        name,
        createdAt: new Date().toISOString()
    };

    users.push(newUser);

    // Return user without password
    const { password: _, ...userResponse } = newUser;
    res.status(201).json({
        message: 'User registered successfully',
        user: userResponse
    });
});

// Login endpoint
app.post('/api/users/login', (req, res) => {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
        return res.status(400).json({
            error: 'Missing required fields',
            required: ['email', 'password']
        });
    }

    // Find user
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
        return res.status(401).json({
            error: 'Invalid credentials'
        });
    }

    // Generate simple token (in production, use JWT!)
    const token = `token_${user.id}_${Date.now()}`;

    // Return user without password
    const { password: _, ...userResponse } = user;
    res.json({
        message: 'Login successful',
        token,
        user: userResponse
    });
});

// Get user profile endpoint
app.get('/api/users/profile', (req, res) => {
    // In production, extract userId from JWT token
    const userId = req.query.userId || req.headers['x-user-id'];

    if (!userId) {
        return res.status(400).json({
            error: 'User ID required',
            hint: 'Pass userId as query parameter or x-user-id header'
        });
    }

    const user = users.find(u => u.id === parseInt(userId));
    if (!user) {
        return res.status(404).json({
            error: 'User not found'
        });
    }

    // Return user without password
    const { password: _, ...userResponse } = user;
    res.json({
        user: userResponse
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.path,
        method: req.method
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`🔐 User Service running on port ${PORT}`);
    console.log(`📝 Service: ${SERVICE_NAME}`);
    console.log(`🌐 Visit http://localhost:${PORT}/health to verify`);
});

module.exports = app;