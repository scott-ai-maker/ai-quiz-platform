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

	validateIdempotencyKey(idempotencyKey) {
		if (idempotencyKey === undefined || idempotencyKey === null) {
			return;
		}

		if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
			throw new Error('x-idempotency-key must be a non-empty string');
		}

		if (idempotencyKey.length > 120) {
			throw new Error('x-idempotency-key must be 120 characters or fewer');
		}
	}

	async enqueueJob(job) {
		try {
			await questionGenerationQueue.add(
				'generate-questions',
				{
					job_id: job.id,
					topic: job.topic,
					difficulty: job.difficulty,
					question_count: job.question_count,
				},
				{
					jobId: job.id,
					attempts: 3,
					backoff: {
						type: 'exponential',
						delay: 1000,
					},
					removeOnComplete: 100,
					removeOnFail: 100,
				}
			);
		} catch (error) {
			if (error.message && error.message.includes('Job') && error.message.includes('already exists')) {
				return;
			}
			throw error;
		}
	}

	async createJob(payload, options = {}) {
		this.validateCreateJobPayload(payload);
		this.validateIdempotencyKey(options.idempotencyKey);

		const normalizedIdempotencyKey = options.idempotencyKey
			? options.idempotencyKey.trim()
			: null;

		if (normalizedIdempotencyKey) {
			const existingJob = await this.repository.getJobByIdempotencyKey(
				normalizedIdempotencyKey
			);

			if (existingJob) {
				if (existingJob.status === 'queued') {
					await this.enqueueJob(existingJob);
				}

				return {
					job_id: existingJob.id,
					status: existingJob.status,
					topic: existingJob.topic,
					difficulty: existingJob.difficulty,
					question_count: existingJob.question_count,
					created_at: existingJob.created_at,
					is_duplicate: true,
				};
			}
		}

		let newJob;
		try {
			newJob = await this.repository.createJob({
				id: randomUUID(),
				idempotency_key: normalizedIdempotencyKey,
				topic: payload.topic.trim(),
				difficulty: payload.difficulty || 'intermediate',
				question_count: payload.question_count || 5,
				status: 'queued',
			});
		} catch (error) {
			if (error.code === '23505' && normalizedIdempotencyKey) {
				const existingJob = await this.repository.getJobByIdempotencyKey(
					normalizedIdempotencyKey
				);

				if (existingJob) {
					if (existingJob.status === 'queued') {
						await this.enqueueJob(existingJob);
					}

					return {
						job_id: existingJob.id,
						status: existingJob.status,
						topic: existingJob.topic,
						difficulty: existingJob.difficulty,
						question_count: existingJob.question_count,
						created_at: existingJob.created_at,
						is_duplicate: true,
					};
				}
			}

			throw error;
		}

		await this.enqueueJob(newJob);

		return {
			job_id: newJob.id,
			status: newJob.status,
			topic: newJob.topic,
			difficulty: newJob.difficulty,
			question_count: newJob.question_count,
			created_at: newJob.created_at,
			is_duplicate: false,
		};
	}
}

module.exports = QuestionGenerationService;
