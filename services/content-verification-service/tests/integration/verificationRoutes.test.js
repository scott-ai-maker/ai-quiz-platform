const request = require('supertest');
const { app } = require('../../src/server');
const { initializeDatabase, closeDatabase } = require('../../src/config/database');
const { startVerificationWorker } = require('../../src/workers/verificationWorker');
const { closeQueues } = require('../../src/queue/queues');

describe('Content Verification Routes', () => {
  let worker;

  beforeAll(async () => {
    await initializeDatabase();
    worker = startVerificationWorker();
  });

  afterAll(async () => {
    if (worker) {
      await worker.close();
    }
    await closeQueues();
    await closeDatabase();
  });

  async function waitForTerminalStatus(jobId, attempts = 20, delayMs = 300) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const response = await request(app).get(`/api/verification/jobs/${jobId}`);
      if (
        response.body.status === 'completed' ||
        response.body.status === 'failed'
      ) {
        return response;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Error('Timed out waiting for async verification job');
  }

  it('returns healthy service status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.service).toBe('content-verification-service');
  });

  it('verifies valid content and returns structured decision', async () => {
    const response = await request(app)
      .post('/api/verification/verify')
      .send({
        topic: 'JavaScript closures',
        difficulty: 'intermediate',
        question:
          'Which statement best explains how JavaScript closures preserve lexical scope?',
        options: [
          'Closures keep references to outer variables',
          'Closures remove scope chains',
          'Closures disable garbage collection',
          'Closures only work in strict mode',
        ],
        answer: 0,
      });

    expect(response.status).toBe(200);
    expect(['approve', 'flag', 'reject']).toContain(response.body.decision);
    expect(typeof response.body.overall_score).toBe('number');
    expect(response.body.quality_breakdown).toBeDefined();
    expect(Array.isArray(response.body.findings)).toBe(true);
  });

  it('returns 400 for invalid payload', async () => {
    const response = await request(app).post('/api/verification/verify').send({
      topic: 'Node.js',
      difficulty: 'easy',
      question: 'Too short?',
      options: ['A'],
      answer: 0,
    });

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('submits async verification job and completes processing', async () => {
    const createResponse = await request(app)
      .post('/api/verification/verify/async')
      .send({
        topic: 'CAP theorem',
        difficulty: 'intermediate',
        question:
          'Which statement best explains the CAP theorem tradeoff in distributed systems?',
        options: [
          'Consistency, availability, and partition tolerance cannot all be guaranteed simultaneously',
          'CAP theorem applies only to SQL databases',
          'CAP theorem means you should avoid replication',
          'CAP theorem guarantees zero latency',
        ],
        answer: 0,
      });

    expect(createResponse.status).toBe(202);
    expect(createResponse.body.job_id).toBeDefined();
    expect(createResponse.body.status).toBe('queued');

    const finalResponse = await waitForTerminalStatus(createResponse.body.job_id);

    expect(finalResponse.status).toBe(200);
    expect(finalResponse.body.status).toBe('completed');
    expect(finalResponse.body.verification_result).toBeDefined();
    expect(finalResponse.body.verification_result.decision).toBeDefined();
  });
});
