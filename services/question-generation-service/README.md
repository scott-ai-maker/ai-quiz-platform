# Question Generation Service

Asynchronous question generation service for the AI Quiz Platform. The service accepts question-generation requests, queues work for background processing, tracks job state, and provides operational metrics.

## Features

- Asynchronous job workflow (`queued`, `processing`, `completed`, `failed`)
- Redis/BullMQ-based background processing
- PostgreSQL-backed durable job persistence
- Idempotent submission via `x-idempotency-key`
- Prompt rendering + AI orchestration integration with graceful fallback
- Pagination/filtering for job listing
- Metrics endpoint for observability and performance tracking

## Endpoints

### Health

- `GET /health`

### Jobs

- `POST /api/questions/jobs`
	- Submits a new async generation job.
	- Optional header: `x-idempotency-key`.
	- Returns `202 Accepted` with job metadata.

- `GET /api/questions/jobs/:jobId`
	- Returns status and payload for a specific job.

- `GET /api/questions/jobs`
	- Lists jobs with pagination and filters.
	- Query parameters:
		- `page` (default: `1`)
		- `limit` (default: `20`, max: `100`)
		- `status` (`queued|processing|completed|failed`)
		- `topic` (case-insensitive partial match)

### Metrics

- `GET /api/questions/jobs/metrics`
	- Returns job volume, status distribution, completion/failure rates, latency, and queue depth.
	- Query parameters:
		- `hours` (default: `24`, min: `1`, max: `168`)

## Local Development

```bash
npm install
npm start
```

## Test

```bash
npm test
```

## Smoke Test

```bash
npm run smoke
```
