const Anthropic = require('@anthropic-ai/sdk');

class AccuracyValidator {
  constructor() {
    this.provider = (process.env.VERIFICATION_PROVIDER || 'mock').toLowerCase();
    this.model = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';
    this.client = null;

    if (this.provider === 'claude' && process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
  }

  localHeuristic(payload) {
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
      confidence: 0.7,
      source: 'heuristic',
    };
  }

  buildPrompt(payload) {
    return [
      'You are verifying quiz content quality and factual alignment.',
      'Return JSON only using this schema:',
      '{"score": number, "confidence": number, "reasons": [string]}',
      'Scoring scale: 0-100 where 100 is strong factual and conceptual quality.',
      `Topic: ${payload.topic}`,
      `Difficulty: ${payload.difficulty}`,
      `Question: ${payload.question}`,
      `Options: ${JSON.stringify(payload.options)}`,
      `Answer: ${JSON.stringify(payload.answer)}`,
    ].join('\n');
  }

  parseClaudeOutput(text) {
    const trimmed = text.trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
      throw new Error('Claude verification response is not valid JSON');
    }

    const parsed = JSON.parse(trimmed.slice(start, end + 1));

    if (!Number.isFinite(parsed.score)) {
      throw new Error('Claude verification response missing numeric score');
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(parsed.score))),
      confidence: Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.7,
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
      source: 'claude',
    };
  }

  async validateWithClaude(payload) {
    if (!this.client) {
      throw new Error('Claude client is not configured');
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 400,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: this.buildPrompt(payload),
        },
      ],
    });

    const textBlock = response.content?.find((item) => item.type === 'text');
    const rawText = textBlock?.text || '';

    return this.parseClaudeOutput(rawText);
  }

  async validate(payload) {
    if (this.provider === 'claude' && this.client) {
      try {
        return await this.validateWithClaude(payload);
      } catch (error) {
        error.code = error.code || (error.status === 429 ? 'RATE_LIMIT' : 'PROVIDER_ERROR');
        throw error;
      }
    }

    return this.localHeuristic(payload);
  }
}

module.exports = AccuracyValidator;
