// Database Configuration for User Service
const { Pool } = require('pg');
const redis = require('redis');
require('dotenv').config();

// PostgreSQL Pool Configuration
const pgConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'user_db',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create PostgreSQL connection pool
const pool = new Pool(pgConfig);

// Pool event handlers
pool.on('connect', () => {
  console.log('📊 Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected PostgreSQL error:', err);
  process.exit(-1);
});

// Redis Client Configuration
const redisConfig = {
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  },
  password: process.env.REDIS_PASSWORD || undefined,
};

let redisClient = null;

// Initialize Redis connection
async function initializeRedis() {
  if (!redisClient) {
    redisClient = redis.createClient(redisConfig);

    redisClient.on('error', (err) => {
      console.error('❌ Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('🔴 Connected to Redis cache');
    });

    await redisClient.connect();
  }
  return redisClient;
}

// Database initialization function
async function initializeDatabase() {
  try {
    // Test PostgreSQL connection
    const client = await pool.connect();
    console.log('✅ PostgreSQL connection pool ready');

    // Run migrations (create tables if they don't exist)
    await runMigrations(client);

    client.release();

    // Initialize Redis
    await initializeRedis();

    console.log('✅ Database initialization complete');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Database migrations
async function runMigrations(client) {
  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        bio TEXT,
        avatar_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create user_update_log table for rate limiting
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_update_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email 
      ON users(email)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username 
      ON users(username)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_update_log_user_id 
      ON user_update_log(user_id, updated_at DESC)
    `);

    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  }
}

// Graceful shutdown
async function closeDatabase() {
  try {
    await pool.end();
    if (redisClient) {
      await redisClient.quit();
    }
    console.log('👋 Database connections closed');
  } catch (error) {
    console.error('❌ Error closing database:', error);
  }
}

module.exports = {
  pool,
  getRedisClient: () => redisClient,
  initializeDatabase,
  initializeRedis,
  closeDatabase,
};
