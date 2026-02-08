# Day 2: Microservices Architecture - Completed ✅

## Learning Objectives
- [ ] Understand microservices architecture patterns
- [ ] Create independent services (User, Quiz, Results)
- [ ] Implement inter-service communication
- [ ] Containerize with Docker & Docker Compose
- [ ] Deploy all services together

## What You Built

### 1. User Service (Port 3001)
- Endpoints: register, login, profile management
- Stores: user data (email, password, name)

### 2. Quiz Service (Port 3002)
- Endpoints: list quizzes, get quiz, create quiz
- Stores: quiz questions and correct answers
- **Important:** Has internal `/api/quizzes/:id/answers` endpoint for Results Service

### 3. Results Service (Port 3003)
- Endpoints: submit results, leaderboard, user stats
- **Calls Quiz Service** via HTTP to fetch correct answers
- Calculates real scores based on actual answers

## Key Architectural Concepts Learned

### Loose Coupling
- Services run independently
- Communicate via HTTP (REST APIs)
- Can restart one without affecting others

### Docker Networking
- Services communicate using service names (e.g., `http://quiz-service:3002`)
- All services on same `quiz-network` bridge

### Inter-Service Communication
- Results Service → Quiz Service call
- Real scoring implemented (not fake random scores)

## Technical Implementation

### Stack
- Express.js for all services
- Docker & Docker Compose for orchestration
- axios for inter-service HTTP calls
- In-memory storage (no database yet)

### How to Run

**Local (development):**
```bash
# Terminal 1
cd services/user-service && npm start

# Terminal 2
cd services/quiz-service && npm start

# Terminal 3
cd services/results-service && npm start
```

## Docker (production-like):
```bash
docker-compose up
```

### Test
```bash
curl -X POST http://localhost:3003/api/results/submit \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"quizId":1,"answers":[1,0]}'
```