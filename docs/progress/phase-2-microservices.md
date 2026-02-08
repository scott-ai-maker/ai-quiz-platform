# Phase 2: Microservices Architecture

## Overview

Refactored the monolithic backend into a distributed microservices architecture with three independently deployable services. This phase introduces service-oriented design patterns, inter-service communication, and container-based orchestration.

## Architectural Improvements

### From Monolith to Microservices

✅ **Separated concerns** - Three services with distinct responsibilities  
✅ **Independent scaling** - Each service scales independently based on demand  
✅ **Technology flexibility** - Each service can use different technologies if needed  
✅ **Failure isolation** - Service failures don't cascade to others  
✅ **Deployment independence** - Services deployed and updated separately  

### Services Implemented

**User Service (Port 3001)**
- User registration and authentication
- Profile management and retrieval
- User data persistence
- Independent deployment and scaling

**Quiz Service (Port 3002)**
- Quiz creation and management
- Question storage and retrieval
- Public endpoint for quiz delivery (without answers)
- Internal endpoint for answer verification (used by Results Service)
- Question library management

**Results Service (Port 3003)**
- Quiz submission and answer processing
- Real-time score calculation via inter-service communication
- Leaderboard management and retrieval
- User performance tracking and analytics
- HTTP calls to Quiz Service for correct answers

## Technical Implementation

### Architecture Pattern: Service-Oriented Architecture (SOA)

**Communication Protocol:** REST APIs with JSON payloads  
**Service Discovery:** Service names via Docker networking  
**Orchestration:** Docker Compose  
**Network:** Dedicated bridge network for inter-service communication  

### Distributed Scoring Algorithm

Results Service calculates scores by:
1. Receiving quiz submission with user answers
2. Calling Quiz Service to fetch correct answers
3. Comparing user answers with correct answers
4. Calculating percentage score
5. Storing result with timestamp

This design demonstrates proper service boundaries and separation of concerns.

### Technology Stack

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