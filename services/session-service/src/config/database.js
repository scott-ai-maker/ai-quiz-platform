const { Pool } = require('pg');
const redis = require('redis');
require('dotenv').config();

const pgConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'quiz_db',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const pool = new Pool(pgConfig);

pool.on('connect', () => {
  console.log('📊 [session-service] Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ [session-service] PostgreSQL error:', err);
  process.exit(-1);
});

const redisConfig = {
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  },
  password: process.env.REDIS_PASSWORD || undefined,
};

let redisClient = null;

async function initializeRedis() {
  if (!redisClient) {
    redisClient = redis.createClient(redisConfig);

    redisClient.on('error', (err) => {
      console.error('❌ [session-service] Redis error:', err);
    });

    redisClient.on('connect', () => {
      console.log('🔴 [session-service] Connected to Redis');
    });

    await redisClient.connect();
  }
  return redisClient;
}

async function runMigrations(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS quiz_sessions (
      id UUID PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      quiz_id INTEGER NOT NULL,
      current_question INTEGER DEFAULT 0,
      answers JSONB DEFAULT '{}'::jsonb,
      status VARCHAR(50) DEFAULT 'in_progress',
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      last_saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      version INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id
    ON quiz_sessions(user_id)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_sessions_quiz_id
    ON quiz_sessions(quiz_id)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_sessions_status
    ON quiz_sessions(status)
  `);
}

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    console.log('✅ [session-service] PostgreSQL pool ready');
    await runMigrations(client);
    await initializeRedis();
    console.log('✅ [session-service] Database initialization complete');
  } finally {
    client.release();
  }
}

async function closeDatabase() {
  await pool.end();
  if (redisClient) {
    await redisClient.quit();
  }
}

module.exports = {
  pool,
  getRedisClient: () => redisClient,
  initializeDatabase,
  initializeRedis,
  closeDatabase,
};
