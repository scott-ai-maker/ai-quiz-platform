const { validateVerificationPayload } = require('../validators/contentValidator');
const DecisionEngine = require('./DecisionEngine');
const VerificationJobRepository = require('../repositories/VerificationJobRepository');
const { verificationQueue } = require('../queue/queues');
const { randomUUID } = require('crypto');

class VerificationService {
  constructor() {
    this.decisionEngine = new DecisionEngine();
    this.jobRepository = new VerificationJobRepository();
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

  scoreAccuracy(payload) {
    let score = 100;
    const reasons = [];

    const hasAnswerIndex = Number.isInteger(payload.answer);
    if (hasAnswerIndex) {
      if (payload.answer < 0 || payload.answer >= payload.options.length) {
        score -= 40;
        reasons.push('Answer index is out of option range');
      }
    } else {
      const answerExists = payload.options.includes(payload.answer);
      if (!answerExists) {
        score -= 40;
        reasons.push('Answer text does not match any option');
      }
    }

    return {
      score: Math.max(0, score),
      reasons,
    };
  }

  verify(payload) {
    validateVerificationPayload(payload);

    const formatResult = this.scoreFormat(payload);
    const accuracyResult = this.scoreAccuracy(payload);

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
      findings: [...formatResult.reasons, ...accuracyResult.reasons],
      verified_at: new Date().toISOString(),
    };
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
}

module.exports = VerificationService;
