const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { randomUUID } = require('crypto');
require('dotenv').config();
const questionRoutes = require('./routes/questionRoutes');
const { initializeDatabase, closeDatabase } = require('./config/database');
const { startQuestionWorker } = require('./workers/questionWorker');
const { closeQueues } = require('./queue/queues');

const app = express();
const PORT = process.env.PORT || 3008;
const SERVICE_NAME = process.env.SERVICE_NAME || 'question-generation-service';
let questionWorker;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
	req.requestId = req.get('x-request-id') || randomUUID();
	res.setHeader('x-request-id', req.requestId);
	next();
});

app.get('/health', (req, res) => {
	res.json({
		status: 'healthy',
		service: SERVICE_NAME,
		requestId: req.requestId,
		timestamp: new Date().toISOString(),
	});
});

app.use('/api/questions', questionRoutes);

app.use((req, res) => {
	res.status(404).json({
		error: 'NotFound',
		message: 'Route not found',
		errorCode: 'ROUTE_NOT_FOUND',
		requestId: req.requestId,
		statusCode: 404,
	});
});

app.use((err, req, res, next) => {
	console.error(
		`❌ [question-generation-service] Error [${req.requestId}]:`,
		err.message
	);

	if (err.type === 'entity.parse.failed') {
		return res.status(400).json({
			error: 'ValidationError',
			message: 'Malformed JSON request body',
			errorCode: 'VALIDATION_ERROR',
			requestId: req.requestId,
			statusCode: 400,
		});
	}

	if (
		err.message &&
		(err.message.includes('required') || err.message.includes('must be'))
	) {
		return res.status(400).json({
			error: 'ValidationError',
			message: err.message,
			errorCode: 'VALIDATION_ERROR',
			requestId: req.requestId,
			statusCode: 400,
		});
	}

	return res.status(500).json({
		error: 'InternalServerError',
		message: 'An unexpected error occurred',
		errorCode: 'INTERNAL_SERVER_ERROR',
		requestId: req.requestId,
		statusCode: 500,
	});
});

if (process.env.NODE_ENV !== 'test') {
	initializeDatabase()
		.then(() => {
			questionWorker = startQuestionWorker();
			app.listen(PORT, () => {
				console.log(`${SERVICE_NAME} listening on ${PORT}`);
			});
		})
		.catch((error) => {
			console.error('❌ Failed to initialize database:', error.message);
			process.exit(1);
		});
}

process.on('SIGTERM', async () => {
	if (questionWorker) {
		await questionWorker.close();
	}
	await closeQueues();
	await closeDatabase();
	process.exit(0);
});

process.on('SIGINT', async () => {
	if (questionWorker) {
		await questionWorker.close();
	}
	await closeQueues();
	await closeDatabase();
	process.exit(0);
});

module.exports = { app };
