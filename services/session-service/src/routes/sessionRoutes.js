const express = require('express');
const SessionService = require('../services/SessionService');
const { ValidationError } = require('../exceptions/SessionExceptions');

const router = express.Router();
const sessionService = new SessionService();

function validateSessionId(sessionId) {
  const uuidV4Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidV4Regex.test(sessionId)) {
    throw new ValidationError('Session ID must be a valid UUID');
  }
}

router.post('/start', async (req, res, next) => {
  try {
    const session = await sessionService.createSession(req.body);
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    validateSessionId(req.params.id);
    const session = await sessionService.getSession(req.params.id);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

router.put('/:id/progress', async (req, res, next) => {
  try {
    validateSessionId(req.params.id);
    const updated = await sessionService.updateProgress(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/complete', async (req, res, next) => {
  try {
    validateSessionId(req.params.id);
    const completed = await sessionService.completeSession(req.params.id);
    res.json(completed);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
