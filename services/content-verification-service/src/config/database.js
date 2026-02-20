const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB || 'quiz_db',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function runMigrations(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS content_verification_jobs (
      id UUID PRIMARY KEY,
      status VARCHAR(30) NOT NULL,
      payload JSONB NOT NULL,
      verification_result JSONB,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_content_verification_jobs_status
    ON content_verification_jobs(status, created_at DESC)
  `);
}

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await runMigrations(client);
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
