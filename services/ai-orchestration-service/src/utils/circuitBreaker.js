class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 15000;
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.openedAt = null;
  }

  isOpen() {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.openedAt = null;
  }

  recordFailure() {
    this.failureCount += 1;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      openedAt: this.openedAt,
    };
  }
}

module.exports = { CircuitBreaker };
