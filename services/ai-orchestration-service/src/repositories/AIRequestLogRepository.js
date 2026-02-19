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

  async getMetrics(options = {}) {
    const { hours = 24 } = options;

    const summaryQuery = `
      SELECT
        COUNT(*)::int AS total_requests,
        COUNT(*) FILTER (WHERE outcome = 'success')::int AS success_count,
        COUNT(*) FILTER (WHERE outcome = 'fallback')::int AS fallback_count,
        COUNT(*) FILTER (WHERE outcome = 'failed')::int AS failed_count,
        ROUND(AVG(latency_ms)::numeric, 2) AS avg_latency_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)
          AS p95_latency_ms
      FROM ai_request_logs
      WHERE created_at >= NOW() - ($1 || ' hours')::interval
    `;

    const providerBreakdownQuery = `
      SELECT
        provider,
        COUNT(*)::int AS request_count,
        COUNT(*) FILTER (WHERE outcome = 'success')::int AS success_count,
        COUNT(*) FILTER (WHERE outcome = 'fallback')::int AS fallback_count,
        COUNT(*) FILTER (WHERE outcome = 'failed')::int AS failed_count,
        ROUND(AVG(latency_ms)::numeric, 2) AS avg_latency_ms
      FROM ai_request_logs
      WHERE created_at >= NOW() - ($1 || ' hours')::interval
      GROUP BY provider
      ORDER BY request_count DESC
    `;

    const [summaryResult, providerResult] = await Promise.all([
      pool.query(summaryQuery, [hours]),
      pool.query(providerBreakdownQuery, [hours]),
    ]);

    const summary = summaryResult.rows[0] || {
      total_requests: 0,
      success_count: 0,
      fallback_count: 0,
      failed_count: 0,
      avg_latency_ms: null,
      p95_latency_ms: null,
    };

    const total = summary.total_requests || 0;
    const successRate = total > 0 ? Number((summary.success_count / total).toFixed(4)) : 0;
    const fallbackRate = total > 0 ? Number((summary.fallback_count / total).toFixed(4)) : 0;
    const failureRate = total > 0 ? Number((summary.failed_count / total).toFixed(4)) : 0;

    return {
      windowHours: hours,
      totals: {
        totalRequests: summary.total_requests,
        successCount: summary.success_count,
        fallbackCount: summary.fallback_count,
        failedCount: summary.failed_count,
      },
      rates: {
        successRate,
        fallbackRate,
        failureRate,
      },
      latency: {
        averageMs: summary.avg_latency_ms,
        p95Ms: summary.p95_latency_ms,
      },
      providers: providerResult.rows,
    };
  }
}

module.exports = AIRequestLogRepository;
