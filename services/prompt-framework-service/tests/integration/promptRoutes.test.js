const request = require('supertest');

const mockCreateTemplate = jest.fn();
const mockListTemplates = jest.fn();
const mockGetTemplateByKey = jest.fn();
const mockRenderTemplate = jest.fn();

jest.mock('../../src/services/PromptFrameworkService', () => {
  return jest.fn().mockImplementation(() => ({
    createTemplate: mockCreateTemplate,
    listTemplates: mockListTemplates,
    getTemplateByKey: mockGetTemplateByKey,
    renderTemplate: mockRenderTemplate,
  }));
});

const {
  ValidationError,
  TemplateNotFoundError,
} = require('../../src/exceptions/PromptExceptions');
const { app } = require('../../src/server');

describe('Prompt Routes Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a prompt template', async () => {
    mockCreateTemplate.mockResolvedValueOnce({
      id: 1,
      template_key: 'quiz.question.mcq',
      version: 1,
      template_text: 'Create {{difficulty}} question on {{topic}}',
    });

    const response = await request(app)
      .post('/api/prompts/templates')
      .send({
        template_key: 'quiz.question.mcq',
        version: 1,
        template_text: 'Create {{difficulty}} question on {{topic}}',
      });

    expect(response.status).toBe(201);
    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.body.template_key).toBe('quiz.question.mcq');
  });

  it('lists templates', async () => {
    mockListTemplates.mockResolvedValueOnce([
      { id: 1, template_key: 'quiz.question.mcq', version: 1 },
    ]);

    const response = await request(app).get('/api/prompts/templates');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
  });

  it('returns 404 for unknown template key', async () => {
    mockGetTemplateByKey.mockRejectedValueOnce(
      new TemplateNotFoundError('quiz.unknown')
    );

    const response = await request(app).get('/api/prompts/templates/quiz.unknown');

    expect(response.status).toBe(404);
    expect(response.body.errorCode).toBe('TEMPLATE_NOT_FOUND');
  });

  it('renders template with variables', async () => {
    mockRenderTemplate.mockResolvedValueOnce({
      template_key: 'quiz.question.mcq',
      version: 1,
      rendered_prompt: 'Create hard question on JavaScript',
    });

    const response = await request(app)
      .post('/api/prompts/render')
      .send({
        template_key: 'quiz.question.mcq',
        variables: {
          difficulty: 'hard',
          topic: 'JavaScript',
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.rendered_prompt).toContain('hard');
  });

  it('returns 400 for invalid render payload', async () => {
    mockRenderTemplate.mockRejectedValueOnce(
      new ValidationError('variables is required and must be an object')
    );

    const response = await request(app)
      .post('/api/prompts/render')
      .send({
        template_key: 'quiz.question.mcq',
      });

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('VALIDATION_ERROR');
  });
});
