const { Queue } = require('bullmq');
const { createRedisConnection } = require('./redis');

const QUEUE_NAME = 'question-generation';
const redisConnection = createRedisConnection();

const questionGenerationQueue = new Queue(QUEUE_NAME, {
	connection: redisConnection,
});

async function closeQueues() {
	await questionGenerationQueue.close();
	await redisConnection.quit();
}

module.exports = {
	QUEUE_NAME,
	questionGenerationQueue,
	closeQueues,
};
