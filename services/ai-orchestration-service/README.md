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
- `GET /health` — health endpoint

## Run locally

```bash
npm install
npm run dev
```

## Test

```bash
npm test
```
