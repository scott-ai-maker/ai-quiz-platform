class RetryHandler {
  static async execute(operation, options = {}) {
    const maxAttempts = options.maxAttempts || 3;
    const baseDelayMs = options.baseDelayMs || 250;
    const shouldRetry =
      options.shouldRetry ||
      (() => true);

    let attempt = 0;
    let lastError;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt >= maxAttempts || !shouldRetry(error)) {
          break;
        }

        const delay = baseDelayMs * 2 ** (attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

module.exports = RetryHandler;
