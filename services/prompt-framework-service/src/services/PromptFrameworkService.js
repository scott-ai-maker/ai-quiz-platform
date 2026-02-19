const PromptTemplateRepository = require('../repositories/PromptTemplateRepository');
const {
  ValidationError,
  TemplateNotFoundError,
} = require('../exceptions/PromptExceptions');

class PromptFrameworkService {
  constructor() {
    this.repository = new PromptTemplateRepository();
  }

  validateCreatePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new ValidationError('Request body is required');
    }

    if (!payload.template_key || typeof payload.template_key !== 'string') {
      throw new ValidationError('template_key is required and must be a string');
    }

    if (!payload.template_text || typeof payload.template_text !== 'string') {
      throw new ValidationError('template_text is required and must be a string');
    }

    if (!Number.isInteger(payload.version) || payload.version < 1) {
      throw new ValidationError('version must be a positive integer');
    }

    if (payload.variables && !Array.isArray(payload.variables)) {
      throw new ValidationError('variables must be an array');
    }
  }

  extractVariables(templateText) {
    const matches = templateText.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || [];
    const cleaned = matches.map((m) => m.replace(/\{|\}|\s/g, ''));
    return [...new Set(cleaned)];
  }

  async createTemplate(payload) {
    this.validateCreatePayload(payload);

    const inferredVariables = this.extractVariables(payload.template_text);

    return this.repository.createTemplate({
      ...payload,
      variables: payload.variables || inferredVariables,
      is_active: payload.is_active ?? true,
    });
  }

  async listTemplates() {
    return this.repository.listTemplates();
  }

  async getTemplateByKey(templateKey) {
    const template = await this.repository.getActiveTemplateByKey(templateKey);
    if (!template) {
      throw new TemplateNotFoundError(templateKey);
    }
    return template;
  }

  async renderTemplate(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new ValidationError('Request body is required');
    }

    if (!payload.template_key || typeof payload.template_key !== 'string') {
      throw new ValidationError('template_key is required and must be a string');
    }

    if (!payload.variables || typeof payload.variables !== 'object') {
      throw new ValidationError('variables is required and must be an object');
    }

    const template = await this.getTemplateByKey(payload.template_key);

    let rendered = template.template_text;
    for (const [key, value] of Object.entries(payload.variables)) {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      rendered = rendered.replace(pattern, String(value));
    }

    const unresolved = rendered.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g);
    if (unresolved && unresolved.length > 0) {
      throw new ValidationError(
        `Missing variable values for: ${unresolved.join(', ')}`
      );
    }

    return {
      template_key: template.template_key,
      version: template.version,
      rendered_prompt: rendered,
    };
  }
}

module.exports = PromptFrameworkService;
