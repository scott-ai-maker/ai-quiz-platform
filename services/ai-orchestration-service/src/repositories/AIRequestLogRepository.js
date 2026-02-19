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

  async listLogs(options = {}) {
    const {
      outcome,
      provider,
      topic,
      page = 1,
      limit = 20,
    } = options;

    const whereClauses = [];
    const values = [];
    let valueIndex = 1;

    if (outcome) {
      whereClauses.push(`outcome = $${valueIndex}`);
      values.push(outcome);
      valueIndex += 1;
    }

    if (provider) {
      whereClauses.push(`provider = $${valueIndex}`);
      values.push(provider);
      valueIndex += 1;
    }

    if (topic) {
      whereClauses.push(`topic ILIKE $${valueIndex}`);
      values.push(`%${topic}%`);
      valueIndex += 1;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const offset = (page - 1) * limit;
    const listValues = [...values, limit, offset];

    const listQuery = `
      SELECT *
      FROM ai_request_logs
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT $${valueIndex}
      OFFSET $${valueIndex + 1}
    `;

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM ai_request_logs
      ${whereSql}
    `;

    const [listResult, countResult] = await Promise.all([
      pool.query(listQuery, listValues),
      pool.query(countQuery, values),
    ]);

    return {
      data: listResult.rows,
      pagination: {
        page,
        limit,
        total: countResult.rows[0]?.total || 0,
      },
    };
  }
}

module.exports = AIRequestLogRepository;
