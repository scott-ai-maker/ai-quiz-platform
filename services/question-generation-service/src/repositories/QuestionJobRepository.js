const { pool } = require('../config/database');

class QuestionJobRepository {
	async createJob(data) {
		const query = `
			INSERT INTO question_generation_jobs
			(id, idempotency_key, topic, difficulty, question_count, status)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING *
		`;

		const values = [
			data.id,
			data.idempotency_key || null,
			data.topic,
			data.difficulty,
			data.question_count,
			data.status,
		];

		const result = await pool.query(query, values);
		return result.rows[0] || null;
	}

	async getJobByIdempotencyKey(idempotencyKey) {
		if (!idempotencyKey) {
			return null;
		}

		const result = await pool.query(
			`SELECT * FROM question_generation_jobs WHERE idempotency_key = $1`,
			[idempotencyKey]
		);

		return result.rows[0] || null;
	}

	async getJobById(jobId) {
		const result = await pool.query(
			`SELECT * FROM question_generation_jobs WHERE id = $1`,
			[jobId]
		);
		return result.rows[0] || null;
	}

	async listJobs(options = {}) {
		const page = options.page || 1;
		const limit = options.limit || 20;
		const offset = (page - 1) * limit;

		const whereConditions = [];
		const values = [];
		let parameterIndex = 1;

		if (options.status) {
			whereConditions.push(`status = $${parameterIndex}`);
			values.push(options.status);
			parameterIndex += 1;
		}

		if (options.topic) {
			whereConditions.push(`topic ILIKE $${parameterIndex}`);
			values.push(`%${options.topic}%`);
			parameterIndex += 1;
		}

		const whereClause =
			whereConditions.length > 0
				? `WHERE ${whereConditions.join(' AND ')}`
				: '';

		const listQuery = `
			SELECT * FROM question_generation_jobs
			${whereClause}
			ORDER BY created_at DESC
			LIMIT $${parameterIndex}
			OFFSET $${parameterIndex + 1}
		`;

		const countQuery = `
			SELECT COUNT(*)::INTEGER AS total
			FROM question_generation_jobs
			${whereClause}
		`;

		const listResult = await pool.query(listQuery, [...values, limit, offset]);
		const countResult = await pool.query(countQuery, values);

		return {
			jobs: listResult.rows,
			total: countResult.rows[0]?.total || 0,
		};
	}

	async markJobProcessing(jobId) {
		const result = await pool.query(
			`
			UPDATE question_generation_jobs
			SET status = 'processing', updated_at = CURRENT_TIMESTAMP
			WHERE id = $1
			RETURNING *
			`,
			[jobId]
		);
		return result.rows[0] || null;
	}

	async markJobCompleted(jobId, resultPayload) {
		const result = await pool.query(
			`
			UPDATE question_generation_jobs
			SET status = 'completed',
				result = $2,
				error_message = NULL,
				updated_at = CURRENT_TIMESTAMP
			WHERE id = $1
			RETURNING *
			`,
			[jobId, JSON.stringify(resultPayload)]
		);
		return result.rows[0] || null;
	}

	async markJobFailed(jobId, errorMessage) {
		const result = await pool.query(
			`
			UPDATE question_generation_jobs
			SET status = 'failed',
				error_message = $2,
				updated_at = CURRENT_TIMESTAMP
			WHERE id = $1
			RETURNING *
			`,
			[jobId, errorMessage]
		);
		return result.rows[0] || null;
	}
}

module.exports = QuestionJobRepository;
