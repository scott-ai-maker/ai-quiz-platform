const request = require('supertest');

const mockCreateSession = jest.fn();
const mockGetSession = jest.fn();
const mockUpdateProgress = jest.fn();
const mockCompleteSession = jest.fn();

jest.mock('../../src/services/SessionService', () => {
  return jest.fn().mockImplementation(() => ({
    createSession: mockCreateSession,
    getSession: mockGetSession,
    updateProgress: mockUpdateProgress,
    completeSession: mockCompleteSession,
  }));
});

const {
  SessionNotFoundError,
  SessionConflictError,
  SessionExpiredError,
} = require('../../src/exceptions/SessionExceptions');

const { app } = require('../../src/server');

describe('Session Routes Integration', () => {
  const validSessionId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 404 when session is not found', async () => {
    mockGetSession.mockRejectedValueOnce(new SessionNotFoundError(validSessionId));

    const response = await request(app).get(`/api/sessions/${validSessionId}`);

    expect(response.status).toBe(404);
    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.body.errorCode).toBe('SESSION_NOT_FOUND');
    expect(response.body.requestId).toBeDefined();
    expect(response.body.sessionId).toBe(validSessionId);
  });

  it('returns 409 on optimistic locking conflict', async () => {
    mockUpdateProgress.mockRejectedValueOnce(
      new SessionConflictError(validSessionId)
    );

    const response = await request(app)
      .put(`/api/sessions/${validSessionId}/progress`)
      .send({ question_id: 2, answer: 'B' });

    expect(response.status).toBe(409);
    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.headers['retry-after']).toBe('1');
    expect(response.body.errorCode).toBe('SESSION_CONFLICT');
    expect(response.body.requestId).toBeDefined();
    expect(response.body.retryable).toBe(true);
    expect(response.body.retryAfterSeconds).toBe(1);
    expect(response.body.sessionId).toBe(validSessionId);
  });

  it('returns 410 when session is expired', async () => {
    mockGetSession.mockRejectedValueOnce(new SessionExpiredError(validSessionId));

    const response = await request(app).get(`/api/sessions/${validSessionId}`);

    expect(response.status).toBe(410);
    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.body.errorCode).toBe('SESSION_EXPIRED');
    expect(response.body.requestId).toBeDefined();
    expect(response.body.sessionId).toBe(validSessionId);
  });

  it('returns 400 for malformed JSON request body', async () => {
    const response = await request(app)
      .post('/api/sessions/start')
      .set('Content-Type', 'application/json')
      .send('{"user_id":"abc"');

    expect(response.status).toBe(400);
    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    expect(response.body.requestId).toBeDefined();
    expect(response.body.message).toBe('Malformed JSON request body');
  });
});
