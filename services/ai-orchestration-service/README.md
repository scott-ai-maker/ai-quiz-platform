# AI Orchestration Service

Resilient AI integration layer for the AI Quiz Platform.

## Why this service exists

AI calls are not traditional CRUD operations. They have variable latency, intermittent rate limits, and content-dependent failures. This service isolates those concerns from business APIs.

## Core resilience patterns

- Request timeout protection
- Retry with exponential backoff
- Circuit breaker for provider instability
- Graceful fallback response when AI is unavailable

## API

- `POST /api/ai/generate-question` — generate a quiz question with resilience pipeline
- `GET /api/ai/logs` — retrieve request logs with filters and pagination
- `GET /api/ai/logs/metrics` — retrieve aggregate reliability and latency metrics
- `GET /health` — health endpoint

### Logs endpoint query parameters

- `page` (default: `1`)
- `limit` (default: `20`, max: `100`)
- `outcome` (`success`, `fallback`, `failed`)
- `provider` (exact match)
- `topic` (case-insensitive partial match)

### Metrics endpoint query parameters

- `hours` (default: `24`, min: `1`, max: `168`)

## Run locally

```bash
npm install
npm run dev
```

## Test

```bash
npm test
```
