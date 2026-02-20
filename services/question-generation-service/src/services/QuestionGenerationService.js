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

	validateListJobsQuery(query = {}) {
		const page = query.page === undefined ? 1 : Number(query.page);
		const limit = query.limit === undefined ? 20 : Number(query.limit);

		if (!Number.isInteger(page) || page < 1) {
			throw new Error('page must be a positive integer');
		}

		if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
			throw new Error('limit must be an integer between 1 and 100');
		}

		if (query.status) {
			const allowedStatuses = ['queued', 'processing', 'completed', 'failed'];
			if (!allowedStatuses.includes(query.status)) {
				throw new Error(
					`status must be one of: ${allowedStatuses.join(', ')}`
				);
			}
		}

		if (query.topic !== undefined && typeof query.topic !== 'string') {
			throw new Error('topic must be a string when provided');
		}

		return {
			page,
			limit,
			status: query.status,
			topic: query.topic ? query.topic.trim() : undefined,
		};
	}

	validateMetricsQuery(query = {}) {
		const hours = query.hours === undefined ? 24 : Number(query.hours);

		if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
			throw new Error('hours must be an integer between 1 and 168');
		}

		return { hours };
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

	async listJobs(query = {}) {
		const validatedQuery = this.validateListJobsQuery(query);
		const result = await this.repository.listJobs(validatedQuery);

		return {
			data: result.jobs.map((job) => ({
				job_id: job.id,
				status: job.status,
				topic: job.topic,
				difficulty: job.difficulty,
				question_count: job.question_count,
				created_at: job.created_at,
				updated_at: job.updated_at,
			})),
			pagination: {
				page: validatedQuery.page,
				limit: validatedQuery.limit,
				total: result.total,
				totalPages: Math.ceil(result.total / validatedQuery.limit),
			},
			filters: {
				status: validatedQuery.status || null,
				topic: validatedQuery.topic || null,
			},
		};
	}

	async getMetrics(query = {}) {
		const validatedQuery = this.validateMetricsQuery(query);
		const dbMetrics = await this.repository.getMetrics(validatedQuery);

		const queueCounts = await questionGenerationQueue.getJobCounts(
			'waiting',
			'active',
			'completed',
			'failed',
			'delayed',
			'paused'
		);

		const totalJobs = dbMetrics.total_jobs || 0;
		const completedJobs = dbMetrics.completed_jobs || 0;
		const failedJobs = dbMetrics.failed_jobs || 0;
		const terminalJobs = completedJobs + failedJobs;

		const successRate =
			terminalJobs > 0 ? Number(((completedJobs / terminalJobs) * 100).toFixed(2)) : 0;
		const failureRate =
			terminalJobs > 0 ? Number(((failedJobs / terminalJobs) * 100).toFixed(2)) : 0;

		return {
			window: {
				hours: validatedQuery.hours,
			},
			job_metrics: {
				total: totalJobs,
				queued: dbMetrics.queued_jobs || 0,
				processing: dbMetrics.processing_jobs || 0,
				completed: completedJobs,
				failed: failedJobs,
			},
			rate_metrics: {
				success_rate_percent: successRate,
				failure_rate_percent: failureRate,
			},
			latency_metrics: {
				avg_completion_latency_ms: dbMetrics.avg_completion_latency_ms || 0,
			},
			queue_depth: {
				waiting: queueCounts.waiting || 0,
				active: queueCounts.active || 0,
				delayed: queueCounts.delayed || 0,
				paused: queueCounts.paused || 0,
			},
			queue_history: {
				completed: queueCounts.completed || 0,
				failed: queueCounts.failed || 0,
			},
		};
	}
}

module.exports = QuestionGenerationService;
