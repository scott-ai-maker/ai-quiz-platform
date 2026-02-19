const express = require('express');
const AIOrchestrationService = require('../services/AIOrchestrationService');

const router = express.Router();
const aiService = new AIOrchestrationService();

router.post('/generate-question', async (req, res, next) => {
  try {
    const result = await aiService.generateQuestionWithFallback(req.body, {
      requestId: req.requestId,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
