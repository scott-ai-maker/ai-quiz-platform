const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { initializeDatabase, closeDatabase } = require('./config/database');
const UserService = require('./services/UserService');
const {
  UserNotFoundError,
  EmailAlreadyExistsError,
  UsernameTakenError,
  WeakPasswordError,
  ProfileUpdateLimitError,
  ValidationError,
} = require('./exceptions/UserExceptions');

const app = express();
const PORT = process.env.PORT || 3001;
const SERVICE_NAME = process.env.SERVICE_NAME || 'user-service';

const userService = new UserService();

// ========== Middleware ==========
app.use(helmet());
app.use(cors());
app.use(express.json());

// ========== Utility Endpoints ==========

// Health check endpoint - Required for load balancers and monitoring
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
  });
});

// Service info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    message: 'User Service API',
    version: '2.0.0',
    service: SERVICE_NAME,
    port: PORT,
    endpoints: {
      health: '/health',
      register: 'POST /api/users/register',
      profile: 'GET /api/users/:id',
      updateProfile: 'PUT /api/users/:id',
    },
  });
});

// ========== User Routes ==========

// Register new user
app.post('/api/users/register', async (req, res, next) => {
  try {
    const result = await userService.createUser(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// Get user profile
app.get('/api/users/:id', async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      throw new ValidationError('User ID must be a valid number');
    }
    const user = await userService.getUserProfile(userId);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update user profile
app.put('/api/users/:id', async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      throw new ValidationError('User ID must be a valid number');
    }
    const result = await userService.updateProfile(userId, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Search users (bonus)
app.get('/api/users/search/:query', async (req, res, next) => {
  try {
    const results = await userService.searchUsers(req.params.query);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

// ========== Global Error Handler ==========
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.name, err.message);

  // Map exception types to HTTP status codes
  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  if (err instanceof UserNotFoundError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  if (err instanceof EmailAlreadyExistsError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  if (err instanceof UsernameTakenError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  if (err instanceof WeakPasswordError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  if (err instanceof ProfileUpdateLimitError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Fallback for unexpected errors
  res.status(500).json({
    error: 'InternalServerError',
    message:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'An unexpected error occurred',
    errorCode: 'INTERNAL_SERVER_ERROR',
    statusCode: 500,
  });
});

// ========== Application Startup ==========

async function start() {
  try {
    // Initialize database and create tables
    await initializeDatabase();

    // Start server
    app.listen(PORT, () => {
      console.log(`✅ ${SERVICE_NAME} listening on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`📍 API info: http://localhost:${PORT}/api/info`);
    });
  } catch (error) {
    console.error('❌ Failed to start service:', error);
    process.exit(1);
  }
}

// ========== Graceful Shutdown ==========
process.on('SIGTERM', async () => {
  console.log('⏹️  SIGTERM received, shutting down gracefully');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⏹️  SIGINT received, shutting down gracefully');
  await closeDatabase();
  process.exit(0);
});

// Start the service
start();

module.exports = app;