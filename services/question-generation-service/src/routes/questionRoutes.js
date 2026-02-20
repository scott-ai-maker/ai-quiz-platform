const express = require('express');
const QuestionGenerationService = require('../services/QuestionGenerationService');
const QuestionJobRepository = require('../repositories/QuestionJobRepository');

const router = express.Router();
const questionService = new QuestionGenerationService();
const jobRepository = new QuestionJobRepository();

router.post('/jobs', async (req, res, next) => {
	try {
		const job = await questionService.createJob(req.body);
		res.status(202).json(job);
	} catch (error) {
		next(error);
	}
});

router.get('/jobs/:jobId', async (req, res, next) => {
	try {
		const job = await jobRepository.getJobById(req.params.jobId);
		if (!job) {
			return res.status(404).json({
				error: 'NotFound',
				message: `Job not found: ${req.params.jobId}`,
				errorCode: 'JOB_NOT_FOUND',
				requestId: req.requestId,
				statusCode: 404,
			});
		}

		return res.json({
			job_id: job.id,
			status: job.status,
			topic: job.topic,
			difficulty: job.difficulty,
			question_count: job.question_count,
			result: job.result,
			error_message: job.error_message,
			created_at: job.created_at,
			updated_at: job.updated_at,
		});
	} catch (error) {
		return next(error);
	}
});

module.exports = router;
