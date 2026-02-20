const { pool } = require('../config/database');

class VerificationJobRepository {
  async createJob(data) {
    const result = await pool.query(
      `
      INSERT INTO content_verification_jobs
      (id, status, payload)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [data.id, data.status, JSON.stringify(data.payload)]
    );

    return result.rows[0] || null;
  }

  async getJobById(jobId) {
    const result = await pool.query(
      `SELECT * FROM content_verification_jobs WHERE id = $1`,
      [jobId]
    );

    return result.rows[0] || null;
  }

  async markJobProcessing(jobId) {
    const result = await pool.query(
      `
      UPDATE content_verification_jobs
      SET status = 'processing', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
      `,
      [jobId]
    );

    return result.rows[0] || null;
  }

  async markJobCompleted(jobId, verificationResult) {
    const result = await pool.query(
      `
      UPDATE content_verification_jobs
      SET status = 'completed',
          verification_result = $2,
          error_message = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
      `,
      [jobId, JSON.stringify(verificationResult)]
    );

    return result.rows[0] || null;
  }

  async markJobFailed(jobId, errorMessage) {
    const result = await pool.query(
      `
      UPDATE content_verification_jobs
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

  async getMetrics(options = {}) {
    const hours = options.hours || 24;

    const result = await pool.query(
      `
      SELECT
        COUNT(*)::INTEGER AS total_jobs,
        COUNT(*) FILTER (WHERE status = 'queued')::INTEGER AS queued_jobs,
        COUNT(*) FILTER (WHERE status = 'processing')::INTEGER AS processing_jobs,
        COUNT(*) FILTER (WHERE status = 'completed')::INTEGER AS completed_jobs,
        COUNT(*) FILTER (WHERE status = 'failed')::INTEGER AS failed_jobs,
        COALESCE(
          ROUND(
            AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000)
            FILTER (WHERE status IN ('completed', 'failed'))
          )::INTEGER,
          0
        ) AS avg_completion_latency_ms
      FROM content_verification_jobs
      WHERE created_at >= NOW() - ($1 * INTERVAL '1 hour')
      `,
      [hours]
    );

    return result.rows[0] || null;
  }
}

module.exports = VerificationJobRepository;
