const request = require('supertest');

const mockGenerateQuestionWithFallback = jest.fn();
const mockListRequestLogs = jest.fn();
const mockGetRequestLogMetrics = jest.fn();

jest.mock('../../src/services/AIOrchestrationService', () => {
  return jest.fn().mockImplementation(() => ({
    generateQuestionWithFallback: mockGenerateQuestionWithFallback,
    listRequestLogs: mockListRequestLogs,
    getRequestLogMetrics: mockGetRequestLogMetrics,
  }));
});

const { ValidationError } = require('../../src/exceptions/AIOrchestrationExceptions');
const { app } = require('../../src/server');

describe('AI Routes Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns generated question response', async () => {
    mockGenerateQuestionWithFallback.mockResolvedValueOnce({
      question: 'What is a Promise in JavaScript?',
      options: ['A', 'B', 'C', 'D'],
      answer: 0,
      provider: 'mock-ai-v1',
      fallback: false,
    });

    const response = await request(app)
      .post('/api/ai/generate-question')
      .send({ topic: 'Promises', difficulty: 'intermediate' });

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.body.provider).toBe('mock-ai-v1');
  });

  it('returns 400 when service validation fails', async () => {
    mockGenerateQuestionWithFallback.mockRejectedValueOnce(
      new ValidationError('topic is required and must be a string')
    );

    const response = await request(app)
      .post('/api/ai/generate-question')
      .send({ difficulty: 'easy' });

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    expect(response.body.requestId).toBeDefined();
  });

  it('returns 400 for malformed JSON', async () => {
    const response = await request(app)
      .post('/api/ai/generate-question')
      .set('Content-Type', 'application/json')
      .send('{"topic":"Promises"');

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    expect(response.body.message).toBe('Malformed JSON request body');
  });

  it('returns paginated request logs', async () => {
    mockListRequestLogs.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          topic: 'Promises',
          difficulty: 'intermediate',
          provider: 'mock-ai-v1',
          outcome: 'success',
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
      },
    });

    const response = await request(app)
      .get('/api/ai/logs?page=1&limit=10&outcome=success');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.body.pagination.total).toBe(1);
    expect(response.body.data[0].provider).toBe('mock-ai-v1');
    expect(mockListRequestLogs).toHaveBeenCalledWith({
      page: '1',
      limit: '10',
      outcome: 'success',
    });
  });

  it('returns 400 for invalid logs query', async () => {
    mockListRequestLogs.mockRejectedValueOnce(
      new ValidationError('page must be a positive integer')
    );

    const response = await request(app).get('/api/ai/logs?page=0');

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    expect(response.body.requestId).toBeDefined();
  });

  it('returns metrics summary for logs', async () => {
    mockGetRequestLogMetrics.mockResolvedValueOnce({
      windowHours: 24,
      totals: {
        totalRequests: 10,
        successCount: 7,
        fallbackCount: 2,
        failedCount: 1,
      },
      rates: {
        successRate: 0.7,
        fallbackRate: 0.2,
        failureRate: 0.1,
      },
      latency: {
        averageMs: 512.4,
        p95Ms: 1210,
      },
      providers: [
        {
          provider: 'mock-ai-v1',
          request_count: 10,
        },
      ],
    });

    const response = await request(app).get('/api/ai/logs/metrics?hours=24');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.body.windowHours).toBe(24);
    expect(response.body.totals.totalRequests).toBe(10);
    expect(mockGetRequestLogMetrics).toHaveBeenCalledWith({ hours: '24' });
  });

  it('returns 400 for invalid metrics query', async () => {
    mockGetRequestLogMetrics.mockRejectedValueOnce(
      new ValidationError('hours must be an integer between 1 and 168')
    );

    const response = await request(app).get('/api/ai/logs/metrics?hours=500');

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    expect(response.body.requestId).toBeDefined();
  });
});
