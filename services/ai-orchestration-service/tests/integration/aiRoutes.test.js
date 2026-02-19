const request = require('supertest');

const mockGenerateQuestionWithFallback = jest.fn();

jest.mock('../../src/services/AIOrchestrationService', () => {
  return jest.fn().mockImplementation(() => ({
    generateQuestionWithFallback: mockGenerateQuestionWithFallback,
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
});
