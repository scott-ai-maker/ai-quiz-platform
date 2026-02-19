const { Pool } = require('pg');
require('dotenv').config();

const pgConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'quiz_db',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const pool = new Pool(pgConfig);

pool.on('connect', () => {
  console.log('📊 [ai-orchestration-service] Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ [ai-orchestration-service] PostgreSQL error:', err);
});

async function runMigrations(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ai_request_logs (
      id SERIAL PRIMARY KEY,
      request_id VARCHAR(255),
      topic VARCHAR(255) NOT NULL,
      difficulty VARCHAR(50) NOT NULL,
      provider VARCHAR(100) NOT NULL,
      fallback_used BOOLEAN DEFAULT false,
      outcome VARCHAR(50) NOT NULL,
      latency_ms INTEGER,
      error_code VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_ai_logs_request_id
    ON ai_request_logs(request_id)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at
    ON ai_request_logs(created_at DESC)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_ai_logs_outcome
    ON ai_request_logs(outcome)
  `);
}

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await runMigrations(client);
    console.log('✅ [ai-orchestration-service] Database initialization complete');
  } finally {
    client.release();
  }
}

async function closeDatabase() {
  await pool.end();
}

module.exports = {
  pool,
  initializeDatabase,
  closeDatabase,
};
