class MockAIProvider {
  constructor(name = 'mock-provider') {
    this.name = name;
  }

  async generateQuestion({ topic, difficulty }) {
    const random = Math.random();

    // Simulate variable latency (200ms - 1500ms)
    const latencyMs = 200 + Math.floor(Math.random() * 1300);
    await new Promise((resolve) => setTimeout(resolve, latencyMs));

    // Simulate intermittent provider failures
    if (random < 0.15) {
      const error = new Error('Provider rate limit exceeded');
      error.code = 'RATE_LIMIT';
      throw error;
    }

    if (random < 0.25) {
      const error = new Error('Provider internal error');
      error.code = 'PROVIDER_ERROR';
      throw error;
    }

    return {
      topic,
      difficulty,
      question: `What is the key concept of ${topic}?`,
      options: [
        'It enables asynchronous control flow',
        'It replaces all database queries',
        'It disables error handling',
        'It only works in frontend code',
      ],
      answer: 0,
      provider: this.name,
      generatedAt: new Date().toISOString(),
      latencyMs,
    };
  }
}

module.exports = MockAIProvider;
