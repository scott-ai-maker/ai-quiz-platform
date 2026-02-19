const express = require('express');
const PromptFrameworkService = require('../services/PromptFrameworkService');

const router = express.Router();
const promptService = new PromptFrameworkService();

router.post('/templates', async (req, res, next) => {
  try {
    const template = await promptService.createTemplate(req.body);
    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

router.get('/templates', async (req, res, next) => {
  try {
    const templates = await promptService.listTemplates();
    res.json({ data: templates });
  } catch (error) {
    next(error);
  }
});

router.get('/templates/:key', async (req, res, next) => {
  try {
    const template = await promptService.getTemplateByKey(req.params.key);
    res.json(template);
  } catch (error) {
    next(error);
  }
});

router.post('/render', async (req, res, next) => {
  try {
    const rendered = await promptService.renderTemplate(req.body);
    res.json(rendered);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
