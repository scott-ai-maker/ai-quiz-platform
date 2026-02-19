class SessionServiceError extends Error {
  constructor(message, errorCode = 'SESSION_SERVICE_ERROR', statusCode = 500) {
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

class SessionNotFoundError extends SessionServiceError {
  constructor(sessionId) {
    super(`Session with ID ${sessionId} not found`, 'SESSION_NOT_FOUND', 404);
    this.sessionId = sessionId;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      sessionId: this.sessionId,
    };
  }
}

class SessionConflictError extends SessionServiceError {
  constructor(sessionId) {
    super(
      `Session update conflict for ${sessionId}. Please retry.`,
      'SESSION_CONFLICT',
      409
    );
    this.sessionId = sessionId;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      sessionId: this.sessionId,
    };
  }
}

class SessionExpiredError extends SessionServiceError {
  constructor(sessionId) {
    super(`Session ${sessionId} has expired`, 'SESSION_EXPIRED', 410);
    this.sessionId = sessionId;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      sessionId: this.sessionId,
    };
  }
}

class ValidationError extends SessionServiceError {
  constructor(message, details = []) {
    super(message, 'VALIDATION_ERROR', 400);
    this.details = details;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      details: this.details,
    };
  }
}

module.exports = {
  SessionServiceError,
  SessionNotFoundError,
  SessionConflictError,
  SessionExpiredError,
  ValidationError,
};
