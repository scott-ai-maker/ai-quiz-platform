# Content Verification Service

Production-focused verification service for AI-generated quiz content.

## Features

- Multi-stage synchronous verification pipeline
- Structural and quality checks for generated questions
- Scoring and decision engine (`approve`, `flag`, `reject`)
- Consistent API contracts and error responses

## Endpoints

- `GET /health`
- `POST /api/verification/verify`
- `POST /api/verification/verify/async`
- `GET /api/verification/jobs/:jobId`

## Run

```bash
npm install
npm start
```

## Test

```bash
npm test
```

## Smoke

```bash
npm run smoke
```
