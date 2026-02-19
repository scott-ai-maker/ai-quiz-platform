const { pool } = require('../config/database');

class AIRequestLogRepository {
  async createLog(logData) {
    const query = `
      INSERT INTO ai_request_logs
      (request_id, topic, difficulty, provider, fallback_used, outcome, latency_ms, error_code)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      logData.request_id || null,
      logData.topic,
      logData.difficulty,
      logData.provider,
      !!logData.fallback_used,
      logData.outcome,
      logData.latency_ms ?? null,
      logData.error_code || null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }
}

module.exports = AIRequestLogRepository;
