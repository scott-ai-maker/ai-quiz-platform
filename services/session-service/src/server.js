const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { randomUUID } = require('crypto');
require('dotenv').config();

const { initializeDatabase, closeDatabase } = require('./config/database');
const sessionRoutes = require('./routes/sessionRoutes');
const {
  SessionServiceError,
} = require('./exceptions/SessionExceptions');

const app = express();
const PORT = process.env.PORT || 3005;
const SERVICE_NAME = process.env.SERVICE_NAME || 'session-service';

app.use(helmet());
app.use(cors());

app.use((req, res, next) => {
  const incomingRequestId = req.get('x-request-id');
  req.requestId = incomingRequestId || randomUUID();
  res.setHeader('x-request-id', req.requestId);

  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    console.log(
      `[session-service] ${req.requestId} ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`
    );
  });

  next();
});

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: SERVICE_NAME,
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/sessions', sessionRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: 'NotFound',
    message: 'Route not found',
    errorCode: 'ROUTE_NOT_FOUND',
    requestId: req.requestId,
    statusCode: 404,
  });
});

app.use((err, req, res, next) => {
  console.error(
    `❌ [session-service] Error [${req.requestId}]:`,
    err.name,
    err.message
  );

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Malformed JSON request body',
      errorCode: 'VALIDATION_ERROR',
      requestId: req.requestId,
      statusCode: 400,
    });
  }

  if (err instanceof SessionServiceError) {
    const payload = {
      ...err.toJSON(),
      requestId: req.requestId,
    };

    if (err.errorCode === 'SESSION_CONFLICT') {
      res.setHeader('retry-after', '1');
      payload.retryable = true;
      payload.retryAfterSeconds = 1;
    }

    return res.status(err.statusCode).json(payload);
  }

  res.status(500).json({
    error: 'InternalServerError',
    message:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'An unexpected error occurred',
    errorCode: 'INTERNAL_SERVER_ERROR',
    requestId: req.requestId,
    statusCode: 500,
  });
});

async function start() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`✅ ${SERVICE_NAME} listening on port ${PORT}`);
      console.log(`📍 Health: http://localhost:${PORT}/health`);
      console.log(`📍 API: http://localhost:${PORT}/api/sessions`);
    });
  } catch (error) {
    console.error('❌ Failed to start session-service:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  await closeDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});

if (process.env.NODE_ENV !== 'test') {
  start();
}

module.exports = { app, start };
