# AI Quiz Platform

Production-focused microservices platform for quiz delivery, AI-assisted content generation, scoring, and prompt orchestration.

## Platform Highlights

- Service-oriented architecture with independently deployable services
- PostgreSQL-backed persistence with Redis caching where applicable
- Resilience patterns for AI calls (timeouts, retries, circuit breaker, fallback)
- Consistent API error contracts and request ID tracing across services
- Integration tests and smoke-test scripts for core production paths

## Services

| Service | Port | Responsibility |
|---|---:|---|
| user-service | 3001 | User profiles and account endpoints |
| quiz-service | 3002 | Quiz catalog and question delivery |
| results-service | 3003 | Quiz scoring and results retrieval |
| session-service | 3005 | Session lifecycle and progress tracking |
| ai-orchestration-service | 3006 | Resilient AI generation orchestration |
| prompt-framework-service | 3007 | Prompt template versioning and rendering |

## Tech Stack

Node.js 20+, Express.js, PostgreSQL, Redis, Docker, Jest, Supertest

## Local Development

Per service:

```bash
cd services/<service-name>
npm install
npm start
```

## Docker Compose

From repository root:

```bash
docker compose up -d quiz-postgres quiz-redis user-service quiz-service results-service prompt-framework-service
```

Stop containers:

```bash
docker compose down
```

## Quality Gates

- Integration tests: `npm test` (run inside each service)
- Smoke tests (available where implemented): `npm run smoke`
- Health endpoint pattern: `GET /health`

## License

MIT
