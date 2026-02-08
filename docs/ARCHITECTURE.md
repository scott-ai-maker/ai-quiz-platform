# Microservices Architecture

## System Overview

The AI Quiz Platform uses a distributed **Service-Oriented Architecture** with three independently deployable microservices, each with dedicated responsibilities. This design enables independent scaling, technology flexibility, and fault isolation.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Quiz Network (Docker)                   │
├──────────────┬──────────────────┬──────────────────────────┤
│              │                  │                          │
│  User Service │  Quiz Service   │  Results Service        │
│  Port 3001   │  Port 3002      │  Port 3003             │
│              │                  │                          │
│ - Register   │ - Quizzes       │ - Score & Submit       │
│ - Login      │ - Questions     │ - Leaderboards        │
│ - Profiles   │ - Answers(int)  │ - Analytics           │
└──────────────┴──────────────────┴──────────────────────────┘
                            │
                     REST API Communication
                      (Loose Coupling)
```

---

## Service Definitions

### User Service (Port 3001) 🔐
**Responsibility:** Authentication and user management  
**Data Owner:** User accounts, profiles, credentials  

**Endpoints:**
```
POST   /api/users/register       - Register new user
POST   /api/users/login          - Authenticate user  
GET    /api/users/profile        - Retrieve user profile
GET    /health                   - Health check
```

**Technical Details:**
- Stores user credentials and profile information
- In-memory storage (upgradable to MongoDB)
- No dependencies on other services

### Quiz Service (Port 3002) 📝
**Responsibility:** Quiz content management and delivery  
**Data Owner:** Quizzes, questions, correct answers  

**Endpoints:**
```
GET    /api/quizzes              - List all quizzes
GET    /api/quizzes/:id          - Get quiz for user (no answers)
GET    /api/quizzes/:id/answers  - Get answers (internal use only)
POST   /api/quizzes              - Create new quiz
GET    /health                   - Health check
```

**Technical Details:**
- Public endpoint hides correct answers (security)
- Internal endpoint provides answers to Results Service
- Independent quiz lifecycle management

### Results Service (Port 3003) 🏆
**Responsibility:** Score calculation and performance analytics  
**Data Owner:** Quiz submissions, scores, rankings  

**Endpoints:**
```
POST   /api/results/submit       - Submit quiz answers
GET    /api/leaderboard          - Get top scores
GET    /api/results/user/:id     - Get user's score history
GET    /health                   - Health check
```

**Technical Details:**
- Calls Quiz Service for correct answers
- Implements distributed scoring algorithm
- Tracks user performance metrics
- In-memory leaderboard (upgradable to MongoDB)

---

## Communication Patterns
---

## Distributed Communication

### Inter-Service Communication Pattern

When a user submits quiz answers, the Results Service initiates a **synchronous REST call** to the Quiz Service to fetch correct answers:

```javascript
// Results Service calls Quiz Service
const response = await axios.get(
  `${QUIZ_SERVICE_URL}/api/quizzes/${quizId}/answers`
);
const correctAnswers = response.data.answers;
```

**Communication Flow:**
1. Client submits answers to Results Service
2. Results Service calls Quiz Service for correct answers
3. Quiz Service returns answers from its data store
4. Results Service calculates scores
5. Results Service updates leaderboard and returns score to client

---

## Architectural Benefits

### Service Isolation
- **Independent Deployment:** Each service can be updated without affecting others
- **Failure Containment:** User Service outage doesn't crash Quiz or Results services
- **Technology Freedom:** Each service can use different stacks if needed

### Scalability
- **Horizontal Scaling:** Quiz Service can have multiple instances during high traffic
- **Resource Efficiency:** User Service scales independently from Results Service
- **Load Distribution:** Docker Compose can be extended to multiple machines

### Maintainability
- **Clear Ownership:** Each service has well-defined responsibility
- **Simpler Codebases:** Smaller services easier to understand and modify
- **Independent Testing:** Services can be tested in isolation

---

## Technology Stack

| Component | Technology | Version | Rationale |
|-----------|-----------|---------|-----------|
| Runtime | Node.js | 20+ | Fast, JavaScript ecosystem, easy async operations |
| Web Framework | Express.js | 4.18+ | Lightweight, minimal overhead, great for microservices |
| Security | Helmet | 7.0+ | Protects from common HTTP vulnerabilities |
| API Communication | Axios | Latest | Promise-based HTTP client, simple inter-service calls |
| Containerization | Docker | Latest | Consistent deployment across environments |
| Orchestration | Docker Compose | Latest | Local development and small deployments |

---

## Data Flow

### Quiz Submission Sequence

```
Client POST /api/results/submit with {userId, quizId, answers: [...]}
    ↓
Results Service receives submission
    ↓
Results Service calls Quiz Service GET /api/quizzes/:id/answers
    ↓
Quiz Service returns correct answers
    ↓
Results Service compares user answers with correct answers
    ↓
Results Service calculates score percentage
    ↓
Results Service stores result in leaderboard
    ↓
Results Service returns {score, correctCount, totalCount} to client
```

---

## Deployment Architecture

---

## Deployment Architecture

### Local Development (Docker Compose)

All three services run on the same Docker bridge network, enabling service discovery by hostname:

```yaml
services:
  user-service:
    build: ./services/user-service
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - SERVICE_NAME=user-service
    networks:
      - quiz-network

  quiz-service:
    build: ./services/quiz-service
    ports:
      - "3002:3002"
    environment:
      - PORT=3002
      - SERVICE_NAME=quiz-service
    networks:
      - quiz-network

  results-service:
    build: ./services/results-service
    ports:
      - "3003:3003"
    environment:
      - PORT=3003
      - SERVICE_NAME=results-service
      - QUIZ_SERVICE_URL=http://quiz-service:3002
    networks:
      - quiz-network

networks:
  quiz-network:
    driver: bridge
```

**Key Points:**
- Docker bridge network `quiz-network` enables DNS resolution by service name
- Environment variables configure service dependencies (e.g., QUIZ_SERVICE_URL)
- Port mappings expose services on localhost for development
- Each service build uses node:20-alpine for minimal image size

---

## Scalability Considerations

### Horizontal Scaling
To run multiple instances of a service in Docker Compose:

```yaml
quiz-service:
  build: ./services/quiz-service
  ports:
    - "3002-3004:3002"  # Multiple port mappings
  deploy:
    replicas: 3  # Docker Swarm mode
```

### Load Balancing
For production, use:
- **NGINX Reverse Proxy:** Route requests to service instances
- **Docker Swarm:** Built-in orchestration with load balancing
- **Kubernetes:** Production-grade container orchestration
- **API Gateway:** Centralized entry point for all services

### Monitoring Considerations
- **Health Checks:** Each service exposes `/health` endpoint
- **Logging:** Centralize logs from all services (ELK stack, Datadog, etc.)
- **Metrics:** Track CPU, memory, network per service instance
- **Distributed Tracing:** Trace requests across service boundaries

---

## Security Considerations

### Inter-Service Communication
- ✅ **Network Isolation:** Services communicate within Docker network
- ⚠️ **No Encryption (Development):** HTTP used locally; use HTTPS in production
- ⚠️ **No Authentication:** Internal endpoints trust network; add JWT verification in production

### Data Security
- ✅ **Service Isolation:** Quiz answers stored only in Quiz Service
- ✅ **Public/Internal Endpoints:** Quiz Service distinguishes public from internal endpoints
- ⚠️ **In-Memory Data:** No persistence; added MongoDB integration for Phase 3

### Recommendations for Production
1. Implement service-to-service authentication (mTLS or API keys)
2. Encrypt inter-service communication (HTTPS/TLS)
3. Implement rate limiting at API Gateway
4. Add request validation and sanitization
5. Implement audit logging for all service calls
6. Use secrets management for environment variables

---

## Potential Improvements

### Phase 3+
- **Persistent Storage:** MongoDB for each service
- **Async Communication:** Message queues (RabbitMQ, Kafka) for event-driven architecture
- **API Gateway:** Single entry point with authentication/rate limiting
- **Service Mesh:** Istio for advanced networking, security, and observability
- **Database Sharding:** Distribute data across multiple database instances
- **Caching Layer:** Redis for performance optimization
- **Circuit Breaker:** Handle service failures gracefully
- **Event Sourcing:** Maintain immutable event logs for auditability

---

## Comparison with Monolithic Architecture

### Monolithic (Phase 1)
```
┌─────────────────────────────────┐
│  Single Express Backend          │
│  - Users, Auth, Quizzes, Results │
│  - One MongoDB database          │
│  - Port 3000                     │
└─────────────────────────────────┘
```

**Pros:** Simple deployment, consistent tech stack  
**Cons:** Hard to scale individual features, tightly coupled

### Microservices (Phase 2)
```
┌─────────────┐  ┌─────────────┐  ┌──────────────┐
│  User Service│  │ Quiz Service│  │Results Service│
│  Port 3001  │  │ Port 3002   │  │ Port 3003    │
└─────────────┘  └─────────────┘  └──────────────┘
```

**Pros:** Independent scaling, easy to modify, distributed resilience  
**Cons:** More complexity, network calls, operational overhead

---

## Summary

The AI Quiz Platform microservices architecture provides:
- ✅ **Clear separation of concerns** with three focused services
- ✅ **Independent scaling** based on individual service demand
- ✅ **Failure isolation** preventing cascading system failures
- ✅ **Docker containerization** for consistent deployment
- ✅ **REST API communication** enabling future protocol changes
- ✅ **Health check integration** supporting load balancer detection

This foundation supports future growth with persistent databases, message queues, API gateways, and distributed tracing.
