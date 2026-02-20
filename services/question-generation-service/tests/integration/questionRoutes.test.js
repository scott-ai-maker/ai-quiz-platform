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
});
