function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(operation, options = {}) {
  const {
    maxRetries = 2,
    baseDelayMs = 250,
    shouldRetry = () => true,
  } = options;

  let attempt = 0;
  let lastError;

  while (attempt <= maxRetries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      const backoffMs = baseDelayMs * Math.pow(2, attempt);
      await sleep(backoffMs);
      attempt += 1;
    }
  }

  throw lastError;
}

module.exports = { withRetry };
