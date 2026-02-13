// Custom Exception Hierarchy for Quiz Service
// Provides clear, specific error handling that maps to appropriate HTTP status codes

/**
 * Base exception class for all quiz-related errors
 * Provides error code support for programmatic error identification
 */
class QuizServiceError extends Error {
    constructor(message, errorCode = 'QUIZ_ERROR', statusCode = 500) {
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
            statusCode: this.statusCode
        };
    }
}

/**
 * Thrown when validation fails (e.g., invalid data format, missing required fields)
 * Maps to HTTP 400 Bad Request
 */
class ValidationError extends QuizServiceError {
    constructor(message, errors = []) {
        super(message, 'VALIDATION_ERROR', 400);
        this.errors = errors;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            errors: this.errors
        };
    }
}

/**
 * Thrown when a quiz is not found
 * Maps to HTTP 404 Not Found
 */
class QuizNotFoundError extends QuizServiceError {
    constructor(quizId) {
        super(`Quiz with ID ${quizId} not found`, 'QUIZ_NOT_FOUND', 404);
        this.quizId = quizId;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            quizId: this.quizId
        };
    }
}

/**
 * Thrown when user exceeds quiz creation quota
 * Maps to HTTP 429 Too Many Requests
 */
class QuizCreationLimitError extends QuizServiceError {
    constructor(currentCount, maxAllowed) {
        super(
            `Quiz creation limit exceeded. You have ${currentCount} quizzes, maximum allowed is ${maxAllowed}`,
            'QUOTA_EXCEEDED',
            429
        );
        this.currentCount = currentCount;
        this.maxAllowed = maxAllowed;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            currentCount: this.currentCount,
            maxAllowed: this.maxAllowed
        };
    }
}

/**
 * Thrown when user lacks permission for an operation
 * Maps to HTTP 403 Forbidden
 */
class UnauthorizedError extends QuizServiceError {
    constructor(action) {
        super(`You are not authorized to ${action}`, 'UNAUTHORIZED', 403);
        this.action = action;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            action: this.action
        };
    }
}

/**
 * Thrown when difficulty progression rules are violated
 * Maps to HTTP 400 Bad Request
 */
class DifficultyProgressionError extends ValidationError {
    constructor(message, missingDifficulties = [], progression = []) {
        super(message);
        this.errorCode = 'DIFFICULTY_PROGRESSION_ERROR';
        this.missingDifficulties = missingDifficulties;
        this.progression = progression;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            missingDifficulties: this.missingDifficulties,
            progression: this.progression
        };
    }
}

/**
 * Thrown when question type distribution rules are violated
 * Maps to HTTP 400 Bad Request
 */
class QuestionTypeDistributionError extends ValidationError {
    constructor(message, distribution = {}) {
        super(message);
        this.errorCode = 'QUESTION_TYPE_DISTRIBUTION_ERROR';
        this.distribution = distribution;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            distribution: this.distribution
        };
    }
}

/**
 * Thrown when database operations fail
 * Maps to HTTP 500 Internal Server Error
 */
class DatabaseError extends QuizServiceError {
    constructor(message, originalError = null) {
        super(message, 'DATABASE_ERROR', 500);
        this.originalError = originalError;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            // Don't expose internal error details in production
            ...(process.env.NODE_ENV === 'development' && this.originalError && {
                originalError: this.originalError.message
            })
        };
    }
}

/**
 * Thrown when a quiz is in an invalid state for the requested operation
 * Maps to HTTP 409 Conflict
 */
class InvalidStateError extends QuizServiceError {
    constructor(message, currentState, requiredState) {
        super(message, 'INVALID_STATE', 409);
        this.currentState = currentState;
        this.requiredState = requiredState;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            currentState: this.currentState,
            requiredState: this.requiredState
        };
    }
}

module.exports = {
    QuizServiceError,
    ValidationError,
    QuizNotFoundError,
    QuizCreationLimitError,
    UnauthorizedError,
    DifficultyProgressionError,
    QuestionTypeDistributionError,
    DatabaseError,
    InvalidStateError
};
