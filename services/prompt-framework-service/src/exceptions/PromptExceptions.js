class PromptFrameworkError extends Error {
  constructor(message, errorCode = 'PROMPT_FRAMEWORK_ERROR', statusCode = 500) {
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

class ValidationError extends PromptFrameworkError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

class TemplateNotFoundError extends PromptFrameworkError {
  constructor(key) {
    super(`Template not found for key: ${key}`, 'TEMPLATE_NOT_FOUND', 404);
    this.key = key;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      key: this.key,
    };
  }
}

module.exports = {
  PromptFrameworkError,
  ValidationError,
  TemplateNotFoundError,
};
