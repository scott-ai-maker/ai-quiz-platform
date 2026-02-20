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
		CREATE TABLE IF NOT EXISTS question_generation_jobs (
			id UUID PRIMARY KEY,
			idempotency_key VARCHAR(120),
			topic VARCHAR(200) NOT NULL,
			difficulty VARCHAR(30) NOT NULL,
			question_count INTEGER NOT NULL,
			status VARCHAR(30) NOT NULL,
			result JSONB,
			error_message TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`);

	await client.query(`
		ALTER TABLE question_generation_jobs
		ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(120)
	`);

	await client.query(`
		CREATE INDEX IF NOT EXISTS idx_qgen_jobs_status_created
		ON question_generation_jobs(status, created_at DESC)
	`);

	await client.query(`
		CREATE UNIQUE INDEX IF NOT EXISTS uq_qgen_jobs_idempotency_key
		ON question_generation_jobs(idempotency_key)
		WHERE idempotency_key IS NOT NULL
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
