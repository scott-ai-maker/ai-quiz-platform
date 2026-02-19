class AIOrchestrationError extends Error {
  constructor(message, errorCode = 'AI_ORCHESTRATION_ERROR', statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      errorCode: this.errorCode,
      statusCode: this.statusCode,
    };
  }
}

class ValidationError extends AIOrchestrationError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

class AIProviderTimeoutError extends AIOrchestrationError {
  constructor(providerName, timeoutMs) {
    super(
      `Provider ${providerName} timed out after ${timeoutMs}ms`,
      'AI_PROVIDER_TIMEOUT',
      504
    );
    this.providerName = providerName;
    this.timeoutMs = timeoutMs;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      providerName: this.providerName,
      timeoutMs: this.timeoutMs,
    };
  }
}

class AIProviderUnavailableError extends AIOrchestrationError {
  constructor(providerName) {
    super(`Provider ${providerName} is unavailable`, 'AI_PROVIDER_UNAVAILABLE', 503);
    this.providerName = providerName;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      providerName: this.providerName,
    };
  }
}

class AICircuitOpenError extends AIOrchestrationError {
  constructor(providerName) {
    super(
      `Circuit breaker is open for provider ${providerName}`,
      'AI_CIRCUIT_OPEN',
      503
    );
    this.providerName = providerName;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      providerName: this.providerName,
    };
  }
}

module.exports = {
  AIOrchestrationError,
  ValidationError,
  AIProviderTimeoutError,
  AIProviderUnavailableError,
  AICircuitOpenError,
};
