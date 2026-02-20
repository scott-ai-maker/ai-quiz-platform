const express = require('express');
const VerificationService = require('../services/VerificationService');

const router = express.Router();
const verificationService = new VerificationService();

router.post('/verify', async (req, res, next) => {
  try {
    const result = verificationService.verify(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/verify/async', async (req, res, next) => {
  try {
    const result = await verificationService.submitAsyncVerification(req.body);
    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/jobs/metrics', async (req, res, next) => {
  try {
    const result = await verificationService.getMetrics(req.query);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.get('/jobs/:jobId', async (req, res, next) => {
  try {
    const job = await verificationService.getAsyncVerificationJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Verification job not found: ${req.params.jobId}`,
        errorCode: 'JOB_NOT_FOUND',
        requestId: req.requestId,
        statusCode: 404,
      });
    }

    return res.json(job);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
