const Anthropic = require('@anthropic-ai/sdk');

class ClaudeAIProvider {
  constructor(options = {}) {
    this.name = options.name || 'claude-ai';
    this.model = options.model || process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';

    if (!options.apiKey && !process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required for Claude provider');
    }

    this.client = new Anthropic({
      apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  buildPrompt({ topic, difficulty }) {
    return [
      'Generate exactly one multiple-choice quiz question and return JSON only.',
      'JSON schema:',
      '{"question": string, "options": [string,string,string,string], "answer": number}',
      `Topic: ${topic}`,
      `Difficulty: ${difficulty}`,
      'Rules:',
      '- options must contain exactly 4 choices',
      '- answer must be 0-3 and correspond to correct option',
      '- no markdown, no explanations, only valid JSON',
    ].join('\n');
  }

  extractTextContent(response) {
    const block = response.content?.find((item) => item.type === 'text');
    return block?.text || '';
  }

  parseJson(text) {
    const trimmed = text.trim();
    const jsonStart = trimmed.indexOf('{');
    const jsonEnd = trimmed.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      throw new Error('Claude response did not include JSON object');
    }

    return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
  }

  validateOutput(parsed) {
    if (!parsed || typeof parsed.question !== 'string') {
      throw new Error('Claude output missing valid question field');
    }

    if (!Array.isArray(parsed.options) || parsed.options.length !== 4) {
      throw new Error('Claude output must include exactly 4 options');
    }

    if (!Number.isInteger(parsed.answer) || parsed.answer < 0 || parsed.answer > 3) {
      throw new Error('Claude output answer index must be an integer between 0 and 3');
    }
  }

  async generateQuestion({ topic, difficulty }) {
    const startedAt = Date.now();

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 500,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: this.buildPrompt({ topic, difficulty }),
          },
        ],
      });

      const rawText = this.extractTextContent(response);
      const parsed = this.parseJson(rawText);
      this.validateOutput(parsed);

      return {
        topic,
        difficulty,
        question: parsed.question,
        options: parsed.options,
        answer: parsed.answer,
        provider: this.name,
        generatedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (error.status === 429) {
        error.code = 'RATE_LIMIT';
      } else {
        error.code = error.code || 'PROVIDER_ERROR';
      }
      throw error;
    }
  }
}

module.exports = ClaudeAIProvider;
