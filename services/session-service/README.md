# Session Service

Session lifecycle and progress-tracking service for the AI Quiz Platform.

This service manages quiz attempt sessions with:
- optimistic concurrency control (`version`-based writes)
- Redis-backed caching for low-latency reads
- PostgreSQL persistence for durability
- explicit HTTP error contracts for client reliability

## Architecture

- **API Layer**: Express routes in `src/routes/sessionRoutes.js`
- **Service Layer**: business rules in `src/services/SessionService.js`
- **Repository Layer**: persistence and cache access in `src/repositories/SessionRepository.js`
- **Storage**: PostgreSQL (`quiz_sessions`) + Redis (`session:{id}`)

## API Endpoints

- `POST /api/sessions/start` — create a new session
- `GET /api/sessions/:id` — fetch session by id
- `PUT /api/sessions/:id/progress` — update question progress with optimistic locking
- `POST /api/sessions/:id/complete` — complete a session
- `GET /health` — service health check

## Error Contract

- `400` `VALIDATION_ERROR` — malformed or invalid input
- `404` `SESSION_NOT_FOUND` — unknown session id
- `409` `SESSION_CONFLICT` — optimistic-lock conflict; client should retry
- `410` `SESSION_EXPIRED` — session expired
- `500` `INTERNAL_SERVER_ERROR` — unexpected server failure

All responses include:
- `x-request-id` header
- `requestId` field in error payloads

For conflict responses (`409`), service provides:
- `retry-after: 1` header
- `retryable: true`
- `retryAfterSeconds: 1`

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL running on `localhost:5432`
- Redis running on `localhost:6379`

### Install & Run

```bash
npm install
npm run dev
```

### Test Commands

```bash
# Integration tests
npm test

# Watch mode
npm run test:watch

# Live smoke checks (400/404/409/410)
npm run smoke
```

## Observability

Each request is logged with request id, method, route, status code, and latency:

`[session-service] <request-id> <METHOD> <URL> <STATUS> <duration>ms`

## Security and Reliability Notes

- Route-level UUID validation for session ids
- Input validation at service boundary
- Cache invalidation on completion
- DB remains source of truth for concurrency and expiry checks

## Status

Current implementation includes:
- focused integration tests for `400/404/409/410`
- one-command end-to-end smoke test script
- request tracing and retry metadata for conflict handling
