const { pool } = require('../config/database');

class QuestionJobRepository {
	async createJob(data) {
		const query = `
			INSERT INTO question_generation_jobs
			(id, topic, difficulty, question_count, status)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING *
		`;

		const values = [
			data.id,
			data.topic,
			data.difficulty,
			data.question_count,
			data.status,
		];

		const result = await pool.query(query, values);
		return result.rows[0] || null;
	}

	async getJobById(jobId) {
		const result = await pool.query(
			`SELECT * FROM question_generation_jobs WHERE id = $1`,
			[jobId]
		);
		return result.rows[0] || null;
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
