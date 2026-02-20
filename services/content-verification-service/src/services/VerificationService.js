const { validateVerificationPayload } = require('../validators/contentValidator');
const DecisionEngine = require('./DecisionEngine');
const VerificationJobRepository = require('../repositories/VerificationJobRepository');
const { verificationQueue } = require('../queue/queues');
const { randomUUID } = require('crypto');
const AccuracyValidator = require('./AccuracyValidator');
const RetryHandler = require('./RetryHandler');

class VerificationService {
  constructor() {
    this.decisionEngine = new DecisionEngine();
    this.jobRepository = new VerificationJobRepository();
    this.accuracyValidator = new AccuracyValidator();
    this.retryAttempts = Number(process.env.VERIFICATION_RETRY_ATTEMPTS || 3);
    this.retryBaseDelayMs = Number(process.env.VERIFICATION_RETRY_BASE_DELAY_MS || 250);
  }

  scoreFormat(payload) {
    let score = 100;
    const reasons = [];

    if (payload.question.trim().length < 15) {
      score -= 20;
      reasons.push('Question text is too short');
    }

    if (payload.options.length < 4) {
      score -= 15;
      reasons.push('Question has fewer than 4 options');
    }

    const uniqueOptions = new Set(payload.options.map((option) => option.trim()));
    if (uniqueOptions.size !== payload.options.length) {
      score -= 20;
      reasons.push('Duplicate options found');
    }

    const normalizedQuestion = payload.question.toLowerCase();
    if (!normalizedQuestion.includes(payload.topic.toLowerCase())) {
      score -= 15;
      reasons.push('Question may not align with specified topic');
    }

    return {
      score: Math.max(0, score),
      reasons,
    };
  }

  async scoreAccuracy(payload) {
    return RetryHandler.execute(
      async () => this.accuracyValidator.validate(payload),
      {
        maxAttempts: this.retryAttempts,
        baseDelayMs: this.retryBaseDelayMs,
        shouldRetry: (error) =>
          error.code === 'RATE_LIMIT' ||
          error.code === 'PROVIDER_ERROR' ||
          String(error.message || '').toLowerCase().includes('timeout'),
      }
    );
  }

  async verify(payload) {
    validateVerificationPayload(payload);

    const formatResult = this.scoreFormat(payload);
    let accuracyResult;

    try {
      accuracyResult = await this.scoreAccuracy(payload);
    } catch (error) {
      const fallbackResult = this.accuracyValidator.localHeuristic(payload);
      accuracyResult = {
        ...fallbackResult,
        reasons: [
          ...fallbackResult.reasons,
          `Accuracy validation provider unavailable: ${error.message}`,
        ],
        source: `${fallbackResult.source}-fallback`,
      };
    }

    const overallScore = Math.round(
      formatResult.score * 0.6 + accuracyResult.score * 0.4
    );

    const decision = this.decisionEngine.decide(overallScore);

    return {
      decision,
      overall_score: overallScore,
      quality_breakdown: {
        format_score: formatResult.score,
        accuracy_score: accuracyResult.score,
      },
      confidence: accuracyResult.confidence,
      accuracy_source: accuracyResult.source,
      findings: [...formatResult.reasons, ...accuracyResult.reasons],
      verified_at: new Date().toISOString(),
    };
  }

  validateMetricsQuery(query = {}) {
    const hours = query.hours === undefined ? 24 : Number(query.hours);

    if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
      throw new Error('hours must be an integer between 1 and 168');
    }

    return { hours };
  }

  async submitAsyncVerification(payload) {
    validateVerificationPayload(payload);

    const createdJob = await this.jobRepository.createJob({
      id: randomUUID(),
      status: 'queued',
      payload,
    });

    await verificationQueue.add(
      'verify-content',
      {
        job_id: createdJob.id,
        payload,
      },
      {
        jobId: createdJob.id,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      }
    );

    return {
      job_id: createdJob.id,
      status: createdJob.status,
      created_at: createdJob.created_at,
    };
  }

  async getAsyncVerificationJob(jobId) {
    const job = await this.jobRepository.getJobById(jobId);
    if (!job) {
      return null;
    }

    return {
      job_id: job.id,
      status: job.status,
      payload: job.payload,
      verification_result: job.verification_result,
      error_message: job.error_message,
      created_at: job.created_at,
      updated_at: job.updated_at,
    };
  }

  async getMetrics(query = {}) {
    const validatedQuery = this.validateMetricsQuery(query);
    const dbMetrics = await this.jobRepository.getMetrics(validatedQuery);

    const queueCounts = await verificationQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused'
    );

    const completed = dbMetrics.completed_jobs || 0;
    const failed = dbMetrics.failed_jobs || 0;
    const terminal = completed + failed;

    const successRate = terminal > 0 ? Number(((completed / terminal) * 100).toFixed(2)) : 0;
    const failureRate = terminal > 0 ? Number(((failed / terminal) * 100).toFixed(2)) : 0;

    return {
      window: {
        hours: validatedQuery.hours,
      },
      job_metrics: {
        total: dbMetrics.total_jobs || 0,
        queued: dbMetrics.queued_jobs || 0,
        processing: dbMetrics.processing_jobs || 0,
        completed,
        failed,
      },
      rate_metrics: {
        success_rate_percent: successRate,
        failure_rate_percent: failureRate,
      },
      latency_metrics: {
        avg_completion_latency_ms: dbMetrics.avg_completion_latency_ms || 0,
      },
      queue_depth: {
        waiting: queueCounts.waiting || 0,
        active: queueCounts.active || 0,
        delayed: queueCounts.delayed || 0,
        paused: queueCounts.paused || 0,
      },
      queue_history: {
        completed: queueCounts.completed || 0,
        failed: queueCounts.failed || 0,
      },
    };
  }
}

module.exports = VerificationService;
