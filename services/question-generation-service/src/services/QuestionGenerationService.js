const { randomUUID } = require('crypto');
const QuestionJobRepository = require('../repositories/QuestionJobRepository');
const { questionGenerationQueue } = require('../queue/queues');

class QuestionGenerationService {
	constructor() {
		this.repository = new QuestionJobRepository();
	}

	validateCreateJobPayload(payload) {
		if (!payload || typeof payload !== 'object') {
			throw new Error('Request body is required');
		}

		if (!payload.topic || typeof payload.topic !== 'string') {
			throw new Error('topic is required and must be a string');
		}

		if (
			payload.question_count !== undefined &&
			(!Number.isInteger(payload.question_count) || payload.question_count < 1)
		) {
			throw new Error('question_count must be a positive integer');
		}

		const allowedDifficulties = ['easy', 'intermediate', 'hard'];
		if (
			payload.difficulty !== undefined &&
			!allowedDifficulties.includes(payload.difficulty)
		) {
			throw new Error('difficulty must be one of: easy, intermediate, hard');
		}
	}

	async createJob(payload) {
		this.validateCreateJobPayload(payload);

		const newJob = await this.repository.createJob({
			id: randomUUID(),
			topic: payload.topic.trim(),
			difficulty: payload.difficulty || 'intermediate',
			question_count: payload.question_count || 5,
			status: 'queued',
		});

		await questionGenerationQueue.add(
			'generate-questions',
			{
				job_id: newJob.id,
				topic: newJob.topic,
				difficulty: newJob.difficulty,
				question_count: newJob.question_count,
			},
			{
				jobId: newJob.id,
				attempts: 3,
				backoff: {
					type: 'exponential',
					delay: 1000,
				},
				removeOnComplete: 100,
				removeOnFail: 100,
			}
		);

		return {
			job_id: newJob.id,
			status: newJob.status,
			topic: newJob.topic,
			difficulty: newJob.difficulty,
			question_count: newJob.question_count,
			created_at: newJob.created_at,
		};
	}
}

module.exports = QuestionGenerationService;
