function validateVerificationPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Request body is required');
  }

  const { question, options, answer, topic, difficulty } = payload;

  if (!question || typeof question !== 'string') {
    throw new Error('question is required and must be a string');
  }

  if (!Array.isArray(options) || options.length < 2) {
    throw new Error('options must be an array with at least 2 entries');
  }

  const invalidOption = options.some((option) => typeof option !== 'string');
  if (invalidOption) {
    throw new Error('all options must be strings');
  }

  if (
    answer === undefined ||
    answer === null ||
    (!Number.isInteger(answer) && typeof answer !== 'string')
  ) {
    throw new Error('answer is required and must be an index or string value');
  }

  if (!topic || typeof topic !== 'string') {
    throw new Error('topic is required and must be a string');
  }

  if (!difficulty || typeof difficulty !== 'string') {
    throw new Error('difficulty is required and must be a string');
  }
}

module.exports = {
  validateVerificationPayload,
};
