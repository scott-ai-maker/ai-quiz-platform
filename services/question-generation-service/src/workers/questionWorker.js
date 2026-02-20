const { Worker } = require('bullmq');
const { createRedisConnection } = require('../queue/redis');
const { QUEUE_NAME } = require('../queue/queues');
const QuestionJobRepository = require('../repositories/QuestionJobRepository');

const AI_ORCHESTRATION_URL =
	process.env.AI_ORCHESTRATION_URL || 'http://localhost:3006';
const PROMPT_FRAMEWORK_URL =
	process.env.PROMPT_FRAMEWORK_URL || 'http://localhost:3007';
const PROMPT_TEMPLATE_KEY =
	process.env.PROMPT_TEMPLATE_KEY || 'quiz.question.generation.v1';

function buildLocalFallbackQuestion(payload, index) {
	return {
		question_number: index,
		question_type: 'multiple_choice',
		prompt: `(${payload.difficulty}) ${payload.topic} - question ${index}`,
		options: ['Option A', 'Option B', 'Option C', 'Option D'],
		answer: 'Option A',
		provider: 'local-fallback',
	};
}

async function postJson(url, body, timeoutMs = 8000) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		});

		const text = await response.text();
		const data = text ? JSON.parse(text) : {};

		if (!response.ok) {
			const message =
				data.message || `HTTP ${response.status} from ${new URL(url).pathname}`;
			throw new Error(message);
		}

		return data;
	} finally {
		clearTimeout(timeout);
	}
}

async function resolvePromptTopic(payload) {
	try {
		const rendered = await postJson(`${PROMPT_FRAMEWORK_URL}/api/prompts/render`, {
			template_key: PROMPT_TEMPLATE_KEY,
			variables: {
				topic: payload.topic,
				difficulty: payload.difficulty,
				question_count: payload.question_count,
			},
		});

		if (rendered && typeof rendered.rendered_prompt === 'string') {
			return rendered.rendered_prompt;
		}
	} catch (error) {
		console.warn(
			`⚠️ Prompt render unavailable, falling back to raw topic: ${error.message}`
		);
	}

	return payload.topic;
}

async function generateQuestion(promptTopic, difficulty) {
	return postJson(`${AI_ORCHESTRATION_URL}/api/ai/generate-question`, {
		topic: promptTopic,
		difficulty,
	});
}

function startQuestionWorker() {
	const repository = new QuestionJobRepository();
	const workerConnection = createRedisConnection();

	const worker = new Worker(
		QUEUE_NAME,
		async (queueJob) => {
			const payload = queueJob.data;
			const jobId = payload.job_id;

			await repository.markJobProcessing(jobId);
			const resolvedPromptTopic = await resolvePromptTopic(payload);

			const generatedQuestions = [];
			for (let index = 1; index <= payload.question_count; index += 1) {
				try {
					const generated = await generateQuestion(
						resolvedPromptTopic,
						payload.difficulty
					);

					generatedQuestions.push({
						question_number: index,
						question_type: 'multiple_choice',
						prompt: generated.question,
						options: generated.options,
						answer:
							typeof generated.answer === 'number'
								? generated.options?.[generated.answer]
								: generated.answer,
						provider: generated.provider || 'ai-orchestration',
						fallback: Boolean(generated.fallback),
					});
				} catch (error) {
					console.warn(
						`⚠️ AI generation failed for job ${jobId}, question ${index}: ${error.message}`
					);
					generatedQuestions.push(buildLocalFallbackQuestion(payload, index));
				}
			}

			await repository.markJobCompleted(jobId, {
				prompt_topic: resolvedPromptTopic,
				generated_count: generatedQuestions.length,
				questions: generatedQuestions,
			});
		},
		{
			connection: workerConnection,
			concurrency: 5,
		}
	);

	worker.on('completed', (job) => {
		console.log(`✅ Job completed: ${job.id}`);
	});

	worker.on('failed', async (job, error) => {
		if (job) {
			await repository.markJobFailed(job.data.job_id, error.message);
			console.error(`❌ Job failed: ${job.id} - ${error.message}`);
			return;
		}
		console.error(`❌ Worker failed before job context: ${error.message}`);
	});

	return worker;
}

module.exports = {
	startQuestionWorker,
};
