const BASE_URL = process.env.QGEN_BASE_URL || 'http://localhost:3008';
const PROMPT_URL = process.env.PROMPT_BASE_URL || 'http://localhost:3007';
const AI_URL = process.env.AI_BASE_URL || 'http://localhost:3006';

async function getJson(url) {
	const response = await fetch(url);
	let data = {};
	try {
		data = await response.json();
	} catch (error) {
		data = {};
	}
	return { status: response.status, data };
}

async function postJson(url, body) {
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
		},
		body: JSON.stringify(body),
	});
	const data = await response.json();
	return { status: response.status, data };
}

async function postJsonWithHeaders(url, body, headers = {}) {
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			...headers,
		},
		body: JSON.stringify(body),
	});
	const data = await response.json();
	return { status: response.status, data };
}

async function waitForJobCompletion(jobId, maxAttempts = 20, waitMs = 500) {
	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		const statusResponse = await getJson(`${BASE_URL}/api/questions/jobs/${jobId}`);
		const status = statusResponse.data.status;

		if (status === 'completed' || status === 'failed') {
			return statusResponse;
		}

		await new Promise((resolve) => setTimeout(resolve, waitMs));
	}

	throw new Error('Timed out waiting for async job completion');
}

describe('Question Routes Live Integration', () => {
	jest.setTimeout(30000);

	let dependenciesReady = false;

	beforeAll(async () => {
		const [qgenHealth, promptHealth, aiHealth] = await Promise.all([
			getJson(`${BASE_URL}/health`),
			getJson(`${PROMPT_URL}/health`),
			getJson(`${AI_URL}/health`),
		]);

		dependenciesReady =
			qgenHealth.status === 200 &&
			promptHealth.status === 200 &&
			aiHealth.status === 200;
	});

	test('creates async question job and returns 202', async () => {
		const response = await postJson(`${BASE_URL}/api/questions/jobs`, {
			topic: 'Load shedding',
			difficulty: 'intermediate',
			question_count: 2,
		});

		expect(response.status).toBe(202);
		expect(response.data.job_id).toBeDefined();
		expect(response.data.status).toBe('queued');
	});

	test('produces non-fallback provider output when dependencies are up', async () => {
		if (!dependenciesReady) {
			console.warn(
				'Skipping provider assertion because one or more dependencies are unavailable.'
			);
			return;
		}

		const createResponse = await postJson(`${BASE_URL}/api/questions/jobs`, {
			topic: 'Event loops',
			difficulty: 'intermediate',
			question_count: 2,
		});

		expect(createResponse.status).toBe(202);
		expect(createResponse.data.job_id).toBeDefined();

		const finalStatus = await waitForJobCompletion(createResponse.data.job_id);
		expect(finalStatus.status).toBe(200);
		expect(finalStatus.data.status).toBe('completed');

		const questions = finalStatus.data.result?.questions || [];
		expect(questions.length).toBeGreaterThan(0);

		for (const question of questions) {
			expect(question.provider).toBe('mock-ai-v1');
			expect(question.fallback).toBe(false);
			expect(typeof question.prompt).toBe('string');
			expect(Array.isArray(question.options)).toBe(true);
		}
	});

	test('returns same job for repeated requests with same x-idempotency-key', async () => {
		const idempotencyKey = `it-idem-${Date.now()}`;
		const payload = {
			topic: 'Idempotent consumers',
			difficulty: 'easy',
			question_count: 2,
		};

		const first = await postJsonWithHeaders(
			`${BASE_URL}/api/questions/jobs`,
			payload,
			{
				'x-idempotency-key': idempotencyKey,
			}
		);

		const second = await postJsonWithHeaders(
			`${BASE_URL}/api/questions/jobs`,
			payload,
			{
				'x-idempotency-key': idempotencyKey,
			}
		);

		expect(first.status).toBe(202);
		expect(second.status).toBe(202);
		expect(first.data.job_id).toBeDefined();
		expect(second.data.job_id).toBe(first.data.job_id);
		expect(first.data.is_duplicate).toBe(false);
		expect(second.data.is_duplicate).toBe(true);
	});

	test('lists jobs with pagination and topic filtering', async () => {
		const uniqueTopic = `ListFilter-${Date.now()}`;

		const createResponse = await postJson(`${BASE_URL}/api/questions/jobs`, {
			topic: uniqueTopic,
			difficulty: 'easy',
			question_count: 1,
		});

		expect(createResponse.status).toBe(202);

		const listResponse = await getJson(
			`${BASE_URL}/api/questions/jobs?page=1&limit=10&topic=${encodeURIComponent(uniqueTopic)}`
		);

		expect(listResponse.status).toBe(200);
		expect(Array.isArray(listResponse.data.data)).toBe(true);
		expect(listResponse.data.pagination.page).toBe(1);
		expect(listResponse.data.pagination.limit).toBe(10);
		expect(listResponse.data.filters.topic).toBe(uniqueTopic);

		const found = listResponse.data.data.some(
			(job) => job.job_id === createResponse.data.job_id
		);
		expect(found).toBe(true);
	});

	test('returns 400 for invalid list query', async () => {
		const response = await getJson(
			`${BASE_URL}/api/questions/jobs?page=0&limit=500`
		);

		expect(response.status).toBe(400);
		expect(response.data.errorCode).toBe('VALIDATION_ERROR');
	});

	test('returns queue and rate metrics for jobs', async () => {
		const response = await getJson(
			`${BASE_URL}/api/questions/jobs/metrics?hours=24`
		);

		expect(response.status).toBe(200);
		expect(response.data.window.hours).toBe(24);
		expect(typeof response.data.job_metrics.total).toBe('number');
		expect(typeof response.data.rate_metrics.success_rate_percent).toBe('number');
		expect(typeof response.data.latency_metrics.avg_completion_latency_ms).toBe(
			'number'
		);
		expect(typeof response.data.queue_depth.waiting).toBe('number');
		expect(typeof response.data.queue_depth.active).toBe('number');
	});

	test('returns 400 for invalid metrics hours query', async () => {
		const response = await getJson(
			`${BASE_URL}/api/questions/jobs/metrics?hours=0`
		);

		expect(response.status).toBe(400);
		expect(response.data.errorCode).toBe('VALIDATION_ERROR');
	});
});
