const { randomUUID } = require('crypto');
const SessionRepository = require('../repositories/SessionRepository');
const {
  SessionNotFoundError,
  SessionConflictError,
  SessionExpiredError,
  ValidationError,
} = require('../exceptions/SessionExceptions');

class SessionService {
  constructor() {
    this.repository = new SessionRepository();
    this.SESSION_TIMEOUT_SECONDS = parseInt(
      process.env.SESSION_TIMEOUT_SECONDS || '1800',
      10
    );
  }

  validateCreatePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new ValidationError('Request body is required');
    }

    if (!payload.user_id || typeof payload.user_id !== 'string') {
      throw new ValidationError('user_id is required and must be a string');
    }

    if (!payload.quiz_id || Number.isNaN(Number(payload.quiz_id))) {
      throw new ValidationError('quiz_id is required and must be numeric');
    }
  }

  async createSession(payload) {
    this.validateCreatePayload(payload);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.SESSION_TIMEOUT_SECONDS * 1000);

    const newSession = {
      id: randomUUID(),
      user_id: payload.user_id,
      quiz_id: Number(payload.quiz_id),
      current_question: 0,
      answers: {},
      status: 'in_progress',
      expires_at: expiresAt.toISOString(),
      version: 1,
    };

    const created = await this.repository.createSession(newSession);
    await this.repository.setCachedSession(created.id, created);

    return created;
  }

  async getSession(sessionId) {
    const cached = await this.repository.getCachedSession(sessionId);
    if (cached) {
      return cached;
    }

    const session = await this.repository.getSessionById(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    if (new Date(session.expires_at) <= new Date()) {
      throw new SessionExpiredError(sessionId);
    }

    await this.repository.setCachedSession(sessionId, session);
    return session;
  }

  normalizeAnswers(answers) {
    if (!answers) {
      return {};
    }

    if (typeof answers === 'string') {
      try {
        return JSON.parse(answers);
      } catch (error) {
        throw new ValidationError('Invalid answers payload format');
      }
    }

    if (typeof answers !== 'object') {
      throw new ValidationError('Invalid answers payload type');
    }

    return answers;
  }

  async updateProgress(sessionId, payload) {
    if (!payload || typeof payload !== 'object') {
      throw new ValidationError('Request body is required');
    }

    if (!Number.isInteger(payload.question_id)) {
      throw new ValidationError('question_id must be an integer');
    }

    if (typeof payload.answer !== 'string' || payload.answer.trim() === '') {
      throw new ValidationError('answer must be a non-empty string');
    }

    const current = await this.repository.getSessionById(sessionId);
    if (!current) {
      throw new SessionNotFoundError(sessionId);
    }

    if (new Date(current.expires_at) <= new Date()) {
      throw new SessionExpiredError(sessionId);
    }

    const answers = this.normalizeAnswers(current.answers);
    answers[String(payload.question_id)] = payload.answer;

    const updated = await this.repository.updateSessionProgressWithVersion(
      sessionId,
      current.version,
      answers,
      payload.question_id,
      current.version + 1
    );

    if (!updated) {
      throw new SessionConflictError(sessionId);
    }

    await this.repository.setCachedSession(sessionId, updated);
    return updated;
  }

  async completeSession(sessionId) {
    const updated = await this.repository.completeSession(sessionId);

    if (!updated) {
      throw new SessionNotFoundError(sessionId);
    }

    await this.repository.deleteCachedSession(sessionId);
    return updated;
  }
}

module.exports = SessionService;
