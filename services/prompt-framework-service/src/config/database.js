const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'quiz_db',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function runMigrations(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS prompt_templates (
      id SERIAL PRIMARY KEY,
      template_key VARCHAR(120) NOT NULL,
      version INTEGER NOT NULL,
      description TEXT,
      template_text TEXT NOT NULL,
      variables JSONB DEFAULT '[]'::jsonb,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(template_key, version)
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_prompt_templates_key_active
    ON prompt_templates(template_key, is_active)
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
