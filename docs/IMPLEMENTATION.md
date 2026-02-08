# Microservices Implementation Guide

## Overview

The AI Quiz Platform implements a three-service microservices architecture using Node.js/Express, Docker, and Docker Compose. This document describes the implementation details and decisions for each service component.

---

## Project Structure

```
ai-quiz-platform/
├── services/
│   ├── user-service/
│   │   ├── src/
│   │   │   └── server.js          # Express server on port 3001
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── .env
│   ├── quiz-service/
│   │   ├── src/
│   │   │   └── server.js          # Express server on port 3002
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── .env
│   └── results-service/
│       ├── src/
│       │   └── server.js          # Express server on port 3003
│       ├── Dockerfile
│       ├── package.json
│       └── .env
├── docker-compose.yml             # Orchestration
├── backend/                       # Legacy Phase 1 monolithic
└── docs/
    ├── ARCHITECTURE.md
    └── IMPLEMENTATION.md
```

---

## Service: User Service (Port 3001)

### Responsibilities
- User registration and authentication
- User profile management
- Session/token validation (upgradeable to JWT)

### Endpoints

| Method | Path | Purpose | Returns |
|--------|------|---------|---------|
| POST | `/api/users/register` | Create new user account | `{userId, username, message}` |
| POST | `/api/users/login` | Authenticate user | `{userId, username, token}` |
| GET | `/api/users/profile` | Get user profile | `{userId, username, createdAt}` |
| GET | `/health` | Health check | `{status: "ok"}` |

### Implementation Details

**Authentication Flow:**
```javascript
// Registration
1. Client: POST /api/users/register {username, password}
2. Service: Hash password with bcryptjs
3. Service: Generate userId
4. Service: Store in memory (or future: MongoDB)
5. Response: {userId, username, message}

// Login
1. Client: POST /api/users/login {username, password}
2. Service: Find user in memory
3. Service: Compare password hashes
4. Service: Generate JWT token (future)
5. Response: {userId, username, token}
```

**Dependencies:**
- `express` - Web framework
- `cors` - Cross-origin requests
- `helmet` - Security headers
- `dotenv` - Environment variables

---

## Service: Quiz Service (Port 3002)

### Responsibilities
- Quiz content management
- Question delivery to users
- Correct answer storage (internal only)

### Endpoints

| Method | Path | Purpose | Returns |
|--------|------|---------|---------|
| GET | `/api/quizzes` | List all quizzes | `[{id, title, questionCount}]` |
| GET | `/api/quizzes/:id` | Get quiz for user | `{id, title, questions: [{id, text, options}]}` |
| GET | `/api/quizzes/:id/answers` | Get answers (internal) | `{answers: [0, 1, 2, ...]}` |
| POST | `/api/quizzes` | Create new quiz | `{id, title, message}` |
| GET | `/health` | Health check | `{status: "ok"}` |

### Implementation Details

**Security: Public vs Internal Endpoints**

The public endpoint returns questions WITHOUT answers for users taking the quiz. The internal endpoint returns only correct answer indices for the Results Service.

**Dependencies:**
- `express` - Web framework
- `cors` - Cross-origin requests
- `helmet` - Security headers
- `dotenv` - Environment variables

---

## Service: Results Service (Port 3003)

### Responsibilities
- Score calculation and submission handling
- Leaderboard management
- Performance analytics
- Inter-service communication to Quiz Service

### Endpoints

| Method | Path | Purpose | Returns |
|--------|------|---------|---------|
| POST | `/api/results/submit` | Submit quiz answers | `{score, correctCount, totalCount}` |
| GET | `/api/leaderboard` | Get top scores | `[{userId, username, score, quizId}]` |
| GET | `/api/results/user/:id` | Get user results | `[{quizId, score, submittedAt}]` |
| GET | `/health` | Health check | `{status: "ok"}` |

### Implementation Details

**Scoring Algorithm:**

1. Receives user's answers
2. Calls Quiz Service for correct answers via HTTP
3. Compares answers and calculates percentage
4. Updates leaderboard
5. Returns score to user

**Inter-Service Communication:**

Results Service calls Quiz Service to fetch correct answers:
```javascript
const axios = require('axios');
const QUIZ_SERVICE_URL = process.env.QUIZ_SERVICE_URL || 'http://localhost:3002';

// Call Quiz Service for answers
const response = await axios.get(
  `${QUIZ_SERVICE_URL}/api/quizzes/${quizId}/answers`
);
const correctAnswers = response.data.answers;
```

**Dependencies:**
- `express` - Web framework
- `axios` - HTTP client for service calls
- `cors` - Cross-origin requests
- `helmet` - Security headers
- `dotenv` - Environment variables

---

## Docker & Deployment

### Dockerfile Pattern

All services use node:20-alpine for minimal image size:
- WORKDIR: /app
- Copy package files
- Install production dependencies only
- Copy application code
- EXPOSE service port
- CMD starts with node src/server.js

### Environment Variables

Each service reads from `.env`:
- `PORT`: Service port (3001, 3002, 3003)
- `SERVICE_NAME`: Service identifier
- Results Service: `QUIZ_SERVICE_URL=http://quiz-service:3002` (Docker network name)

### Docker Compose Orchestration

Coordinates all three services on `quiz-network` bridge:
- Maps ports: 3001-3003 on localhost
- Sets environment variables including service discovery
- Includes health checks for load balancer compatibility
- Results Service depends_on Quiz Service being healthy

---

## Testing & Validation

### Service Health Checks
```bash
curl http://localhost:3001/health  # User Service
curl http://localhost:3002/health  # Quiz Service
curl http://localhost:3003/health  # Results Service
```

### End-to-End Workflow
```bash
# 1. Register user
curl -X POST http://localhost:3001/api/users/register

# 2. Get quiz
curl http://localhost:3002/api/quizzes/quiz_001

# 3. Submit answers (triggers inter-service call)
curl -X POST http://localhost:3003/api/results/submit

# 4. Check leaderboard
curl http://localhost:3003/api/leaderboard
```

---

## Summary

This implementation provides:
- ✅ Three independent services with clear responsibilities
- ✅ REST API communication between services
- ✅ Public/internal endpoint security patterns
- ✅ Docker containerization
- ✅ Docker Compose orchestration
- ✅ Health check monitoring

Each service can be modified, scaled, and deployed independently.
