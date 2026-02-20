const { Worker } = require('bullmq');
const { createRedisConnection } = require('../queue/redis');
const { QUEUE_NAME } = require('../queue/queues');
const VerificationService = require('../services/VerificationService');
const VerificationJobRepository = require('../repositories/VerificationJobRepository');

function startVerificationWorker() {
  const service = new VerificationService();
  const repository = new VerificationJobRepository();
  const workerConnection = createRedisConnection();

  const worker = new Worker(
    QUEUE_NAME,
    async (queueJob) => {
      const { job_id: jobId, payload } = queueJob.data;
      await repository.markJobProcessing(jobId);

      const result = service.verify(payload);

      await repository.markJobCompleted(jobId, result);
    },
    {
      connection: workerConnection,
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    console.log(`✅ Verification job completed: ${job.id}`);
  });

  worker.on('failed', async (job, error) => {
    if (job) {
      await repository.markJobFailed(job.data.job_id, error.message);
      console.error(`❌ Verification job failed: ${job.id} - ${error.message}`);
      return;
    }
    console.error(`❌ Worker failure before job context: ${error.message}`);
  });

  const originalClose = worker.close.bind(worker);
  worker.close = async () => {
    await originalClose();
    await workerConnection.quit();
  };

  return worker;
}

module.exports = {
  startVerificationWorker,
};
