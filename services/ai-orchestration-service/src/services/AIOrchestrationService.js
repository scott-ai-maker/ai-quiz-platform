const MockAIProvider = require('../providers/mockAIProvider');
const AIRequestLogRepository = require('../repositories/AIRequestLogRepository');
const { withTimeout } = require('../utils/timeout');
const { withRetry } = require('../utils/retry');
const { CircuitBreaker } = require('../utils/circuitBreaker');
const {
  ValidationError,
  AIProviderTimeoutError,
  AIProviderUnavailableError,
  AICircuitOpenError,
} = require('../exceptions/AIOrchestrationExceptions');

class AIOrchestrationService {
  constructor() {
    this.provider = new MockAIProvider('mock-ai-v1');
    this.logRepository = new AIRequestLogRepository();

    this.timeoutMs = parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '3000', 10);
    this.maxRetries = parseInt(process.env.AI_MAX_RETRIES || '2', 10);
    this.baseDelayMs = parseInt(process.env.AI_RETRY_BASE_DELAY_MS || '250', 10);

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: parseInt(
        process.env.AI_CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5',
        10
      ),
      resetTimeoutMs: parseInt(
        process.env.AI_CIRCUIT_BREAKER_RESET_TIMEOUT_MS || '15000',
        10
      ),
    });
  }

  async persistRequestLog(logData) {
    try {
      await this.logRepository.createLog(logData);
    } catch (error) {
      console.error(
        '⚠️ [ai-orchestration-service] Failed to persist request log:',
        error.message
      );
    }
  }

  validateLogsQuery(query = {}) {
    const page = query.page === undefined ? 1 : Number(query.page);
    const limit = query.limit === undefined ? 20 : Number(query.limit);

    if (!Number.isInteger(page) || page < 1) {
      throw new ValidationError('page must be a positive integer');
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new ValidationError('limit must be an integer between 1 and 100');
    }

    if (query.outcome) {
      const allowedOutcomes = ['success', 'fallback', 'failed'];
      if (!allowedOutcomes.includes(query.outcome)) {
        throw new ValidationError(
          `outcome must be one of: ${allowedOutcomes.join(', ')}`
        );
      }
    }

    return {
      page,
      limit,
      outcome: query.outcome,
      provider: query.provider,
      topic: query.topic,
    };
  }

  validateGeneratePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new ValidationError('Request body is required');
    }

    if (!payload.topic || typeof payload.topic !== 'string') {
      throw new ValidationError('topic is required and must be a string');
    }

    if (!payload.difficulty || typeof payload.difficulty !== 'string') {
      throw new ValidationError('difficulty is required and must be a string');
    }
  }

  fallbackQuestion(topic, difficulty) {
    return {
      topic,
      difficulty,
      question: `Fallback question: Which best describes ${topic}?`,
      options: [
        'Core concept explanation',
        'Unrelated database operation',
        'Frontend-only behavior',
        'Networking protocol mismatch',
      ],
      answer: 0,
      provider: 'fallback',
      generatedAt: new Date().toISOString(),
      fallback: true,
      reason: 'AI provider unavailable',
    };
  }

  async generateQuestion(payload) {
    this.validateGeneratePayload(payload);

    if (this.circuitBreaker.isOpen()) {
      throw new AICircuitOpenError(this.provider.name);
    }

    try {
      const result = await withRetry(
        () =>
          withTimeout(
            () => this.provider.generateQuestion(payload),
            this.timeoutMs
          ),
        {
          maxRetries: this.maxRetries,
          baseDelayMs: this.baseDelayMs,
          shouldRetry: (error) => {
            if (error.message.includes('timed out')) {
              return true;
            }
            return error.code === 'RATE_LIMIT' || error.code === 'PROVIDER_ERROR';
          },
        }
      );

      this.circuitBreaker.recordSuccess();
      return {
        ...result,
        resilience: {
          circuitBreaker: this.circuitBreaker.getState(),
          timeoutMs: this.timeoutMs,
          retries: this.maxRetries,
        },
      };
    } catch (error) {
      this.circuitBreaker.recordFailure();

      if (error.message.includes('timed out')) {
        throw new AIProviderTimeoutError(this.provider.name, this.timeoutMs);
      }

      if (error.code === 'RATE_LIMIT' || error.code === 'PROVIDER_ERROR') {
        throw new AIProviderUnavailableError(this.provider.name);
      }

      throw error;
    }
  }

  async generateQuestionWithFallback(payload, metadata = {}) {
    const startedAt = Date.now();

    try {
      const result = await this.generateQuestion(payload);

      await this.persistRequestLog({
        request_id: metadata.requestId,
        topic: payload.topic,
        difficulty: payload.difficulty,
        provider: result.provider || this.provider.name,
        fallback_used: false,
        outcome: 'success',
        latency_ms: Date.now() - startedAt,
        error_code: null,
      });

      return result;
    } catch (error) {
      if (
        error instanceof AICircuitOpenError ||
        error instanceof AIProviderTimeoutError ||
        error instanceof AIProviderUnavailableError
      ) {
        const fallbackResult = {
          ...this.fallbackQuestion(payload.topic, payload.difficulty),
          resilience: {
            fallbackActivated: true,
            reason: error.errorCode,
            circuitBreaker: this.circuitBreaker.getState(),
          },
        };

        await this.persistRequestLog({
          request_id: metadata.requestId,
          topic: payload.topic,
          difficulty: payload.difficulty,
          provider: fallbackResult.provider,
          fallback_used: true,
          outcome: 'fallback',
          latency_ms: Date.now() - startedAt,
          error_code: error.errorCode,
        });

        return fallbackResult;
      }

      await this.persistRequestLog({
        request_id: metadata.requestId,
        topic: payload.topic,
        difficulty: payload.difficulty,
        provider: this.provider.name,
        fallback_used: false,
        outcome: 'failed',
        latency_ms: Date.now() - startedAt,
        error_code: error.errorCode || 'UNEXPECTED_ERROR',
      });

      throw error;
    }
  }

  async listRequestLogs(query = {}) {
    const validatedQuery = this.validateLogsQuery(query);
    return this.logRepository.listLogs(validatedQuery);
  }
}

module.exports = AIOrchestrationService;
