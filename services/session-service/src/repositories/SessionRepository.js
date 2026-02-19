const { pool, getRedisClient } = require('../config/database');

class SessionRepository {
  constructor() {
    this.CACHE_PREFIX = 'session:';
    this.CACHE_TTL = parseInt(process.env.SESSION_TIMEOUT_SECONDS || '1800', 10);
  }

  buildCacheKey(sessionId) {
    return `${this.CACHE_PREFIX}${sessionId}`;
  }

  async getCachedSession(sessionId) {
    const redisClient = getRedisClient();
    if (!redisClient) {
      return null;
    }

    const payload = await redisClient.get(this.buildCacheKey(sessionId));
    return payload ? JSON.parse(payload) : null;
  }

  async setCachedSession(sessionId, sessionData) {
    const redisClient = getRedisClient();
    if (!redisClient) {
      return;
    }

    await redisClient.setEx(
      this.buildCacheKey(sessionId),
      this.CACHE_TTL,
      JSON.stringify(sessionData)
    );
  }

  async deleteCachedSession(sessionId) {
    const redisClient = getRedisClient();
    if (!redisClient) {
      return;
    }

    await redisClient.del(this.buildCacheKey(sessionId));
  }

  async createSession(sessionData) {
    const query = `
      INSERT INTO quiz_sessions
      (id, user_id, quiz_id, current_question, answers, status, expires_at, version)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      sessionData.id,
      sessionData.user_id,
      sessionData.quiz_id,
      sessionData.current_question,
      JSON.stringify(sessionData.answers || {}),
      sessionData.status,
      sessionData.expires_at,
      sessionData.version,
    ];

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  async getSessionById(sessionId) {
    const query = 'SELECT * FROM quiz_sessions WHERE id = $1';
    const result = await pool.query(query, [sessionId]);
    return result.rows[0] || null;
  }

  async updateSessionProgressWithVersion(
    sessionId,
    currentVersion,
    updatedAnswers,
    currentQuestion,
    newVersion
  ) {
    const query = `
      UPDATE quiz_sessions
      SET answers = $1,
          current_question = $2,
          version = $3,
          last_saved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND version = $5
      RETURNING *
    `;

    const values = [
      JSON.stringify(updatedAnswers),
      currentQuestion,
      newVersion,
      sessionId,
      currentVersion,
    ];

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  async completeSession(sessionId) {
    const query = `
      UPDATE quiz_sessions
      SET status = 'completed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status != 'completed'
      RETURNING *
    `;

    const result = await pool.query(query, [sessionId]);
    return result.rows[0] || null;
  }
}

module.exports = SessionRepository;
