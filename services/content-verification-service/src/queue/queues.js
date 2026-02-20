const { Queue } = require('bullmq');
const { createRedisConnection } = require('./redis');

const QUEUE_NAME = 'content-verification';
const redisConnection = createRedisConnection();

const verificationQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
});

async function closeQueues() {
  await verificationQueue.close();
  await redisConnection.quit();
}

module.exports = {
  QUEUE_NAME,
  verificationQueue,
  closeQueues,
};
