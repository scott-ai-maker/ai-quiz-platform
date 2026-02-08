# Technical Stack

Justification and implementation details for every technology choice in the AI Quiz Platform.

---

## Overview

The platform uses a carefully selected technology stack optimized for:
- **Performance:** Response times under 100ms
- **Scalability:** Horizontal scaling to millions of users
- **Maintainability:** Clear code with industry best practices
- **Security:** Built-in protections against common vulnerabilities
- **Developer Experience:** Rapid development and debugging

---

## Runtime & Language

### Node.js 20 LTS

**Choice:** Node.js runtime via npm/JavaScript ecosystem

**Why:**
- **Async-first:** Built for non-blocking I/O operations (perfect for microservices)
- **LTS Support:** Version 20 receives updates until April 2026
- **Performance:** V8 engine delivers excellent performance for I/O-heavy workloads
- **Ecosystem:** npm has 2M+ packages (largest package registry)
- **Developer productivity:** Single language for backend and frontend

**Alternatives Considered:**
- Python: More verbose for REST APIs; slower for concurrent requests
- Go: Steeper learning curve; less ecosystem for rapid development
- Java: Heavier deployments; slower startup times (not ideal for containers)

**Version Rationale:**
- Node 20: Stable LTS release with strong community support
- Minimum version: 18 (EOL Nov 2024); 20+ recommended for production

---

## Web Framework

### Express.js 4.18+

**Choice:** Express.js for HTTP server and routing

**Why:**
- **Minimal overhead:** Only ~600 lines of core code
- **Middleware-based:** Clean separation of concerns (auth, logging, validation)
- **Community proven:** Used by Uber, Netflix, IBM in production
- **Flexibility:** Unopinionated architecture allows custom patterns
- **Performance:** Benchmarks show ~10K requests/sec per core

**Alternatives Considered:**
- Fastify: Faster (~50% more throughput) but less ecosystem
- Koa: Newer, fewer production deployments; smaller community
- Hapi: More batteries-included; more complexity than needed

**Why NOT Fastify:**
While Fastify benchmarks faster, the difference (40ms vs 30ms) is negligible for quiz platform latency. Express's larger ecosystem and more mature patterns justify the choice.

**Middleware Stack:**
```javascript
app.use(helmet());        // Security headers
app.use(cors());          // Cross-origin requests
app.use(rateLimit());     // DDoS protection
app.use(express.json()); // Body parsing
```

---

## Security

### Helmet.js 7.0+

**Choice:** Helmet middleware for HTTP header security

**What it protects:**
- **X-Content-Type-Options:** Prevents MIME sniffing attacks
- **X-Frame-Options:** Blocks clickjacking attempts
- **Strict-Transport-Security (HSTS):** Forces HTTPS connections
- **Content-Security-Policy:** Restricts script execution
- **X-XSS-Protection:** Browser XSS filter settings

**Example headers added:**
```
Strict-Transport-Security: max-age=15552000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'
```

**Why not alternatives:**
- Manual headers: Error-prone, requires security expertise
- Other libraries: Helmet is the de facto standard for Express

### CORS (Cross-Origin Resource Sharing)

**Choice:** express-cors middleware

**Configuration:**
```javascript
const cors = require('cors');
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
  maxAge: 3600
}));
```

**Why:**
- Enables frontend on different domain to call backend APIs
- Whitelist configuration prevents unauthorized cross-domain requests
- Credentials flag allows session/cookie sharing

### Rate Limiting

**Choice:** express-rate-limit

**Current Configuration:**
```javascript
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                   // 100 requests per window
  message: 'Too many requests from this IP'
});
app.use('/api/', limiter);
```

**Future Production:**
- IP-based vs. user-based limiting
- Different limits for different endpoints
- Redis-backed for distributed rate limiting across multiple servers

---

## Database

### MongoDB 5.0+

**Choice:** MongoDB for persistent data storage (Phase 3+)

**Why:**
- **Document-oriented:** Quiz questions naturally map to JSON documents
- **Flexible schema:** Can evolve data structure without migrations
- **Scalability:** Built-in sharding for horizontal scaling
- **Replication:** Replica sets provide high availability
- **Indexing:** Supports indexing on any field for query performance

**Schema Design:**

User Service:
```json
{
  "_id": ObjectId,
  "username": String,
  "passwordHash": String,
  "createdAt": Date
}
```

Quiz Service:
```json
{
  "_id": ObjectId,
  "title": String,
  "questions": [{
    "id": String,
    "text": String,
    "options": Array,
    "correctAnswer": Number
  }],
  "createdAt": Date
}
```

Results Service:
```json
{
  "_id": ObjectId,
  "userId": String,
  "quizId": String,
  "score": Number,
  "correctCount": Number,
  "totalCount": Number,
  "submittedAt": Date
}
```

**Indexes for Performance:**
```javascript
db.users.createIndex({username: 1}, {unique: true})
db.quizzes.createIndex({title: 1})
db.results.createIndex({userId: 1, quizId: 1, submittedAt: -1})
```

**Alternatives Considered:**
- PostgreSQL: Requires strict schema; better for relational data
- Redis: In-memory; suited for caching, not primary storage
- DynamoDB: AWS vendor lock-in

**Why MongoDB for quizzes:**
Questions are hierarchical JSON → natural document fit

---

## HTTP Communication

### Axios 1.4+

**Choice:** Axios for inter-service HTTP calls

**Why:**
- **Promise-based:** Modern async/await support
- **Interceptors:** Built-in request/response transformation
- **Timeout handling:** Automatic timeout management
- **Error handling:** Consistent error structure

**Usage in Results Service:**
```javascript
const axios = require('axios');
const QUIZ_SERVICE_URL = process.env.QUIZ_SERVICE_URL;

const response = await axios.get(
  `${QUIZ_SERVICE_URL}/api/quizzes/${quizId}/answers`,
  {
    timeout: 5000,  // 5 second timeout
    headers: { 'X-Service-Auth': process.env.SERVICE_SECRET }
  }
);
```

**Error Handling:**
```javascript
try {
  const correctAnswers = await axios.get(answerUrl);
} catch (error) {
  if (error.response?.status === 404) {
    return res.status(404).json({error: 'Quiz not found'});
  }
  if (error.code === 'ECONNREFUSED') {
    return res.status(503).json({error: 'Quiz service unavailable'});
  }
}
```

**Alternatives:**
- node-fetch: Lower-level; requires more boilerplate
- got: Similar; less widely adopted
- Native fetch API: Not yet stable in Node.js 20

---

## Environment Configuration

### dotenv 16+

**Choice:** dotenv for environment variable management

**Why:**
- **Secrets separation:** Credentials never committed to git
- **Environment-specific config:** Different .env per environment
- **Standard approach:** dotenv format recognized across ecosystems

**Usage Pattern:**
```javascript
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
```

**.env.example (committed):**
```
NODE_ENV=development
PORT=3001
SERVICE_NAME=user-service
MONGODB_URI=mongodb://localhost:27017/user-service
JWT_SECRET=change-me-in-production
```

**.env (git-ignored):**
```
NODE_ENV=development
PORT=3001
SERVICE_NAME=user-service
MONGODB_URI=mongodb://localhost:27017/user-service
JWT_SECRET=super-secret-key-generated
```

---

## Development Tools

### Nodemon 3.0+

**Choice:** Nodemon for auto-reload during development

**Why:**
- **Automatic restart:** App restarts on file change
- **Saves time:** Eliminates manual restart cycle
- **Production-safe:** Only used in development, excluded from prod build

**Configuration:**
```json
{
  "watch": ["src"],
  "ext": "js",
  "ignore": ["src/**/*.test.js"],
  "delay": 500
}
```

### ESLint 9+

**Choice:** ESLint for code quality and consistency

**Why:**
- **Catch bugs early:** Common mistakes flagged before runtime
- **Code consistency:** Enforces team style guidelines
- **Performance:** Identifies inefficient patterns

**Rules:**
```javascript
module.exports = {
  rules: {
    'no-console': 'warn',          // Console logs in production
    'no-unused-vars': 'error',     // Dead code
    'eqeqeq': ['error', 'always'], // Strict equality
    'semi': ['error', 'always']    // Statement semicolons
  }
};
```

### Prettier 3.0+

**Choice:** Prettier for automatic code formatting

**Why:**
- **No debates:** Auto-formatting removes style discussions
- **Consistency:** All code formatted identically
- **Integration:** Works with ESLint; formats on save

**Configuration:**
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2
}
```

---

## Testing

### Jest 29+

**Choice:** Jest for unit and integration testing

**Why:**
- **Zero config:** Works out of box with good defaults
- **Snapshot testing:** Catches regressions in data structures
- **Coverage reporting:** Built-in code coverage analysis
- **Speed:** Parallel test execution

**Basic Test:**
```javascript
describe('User registration', () => {
  test('creates user with valid credentials', async () => {
    const response = await request(app)
      .post('/api/users/register')
      .send({username: 'test', password: 'pass123'});
    
    expect(response.status).toBe(201);
    expect(response.body.data.userId).toBeDefined();
  });
});
```

### Supertest 6+

**Choice:** Supertest for HTTP API testing

**Why:**
- **Express integration:** Clean API for testing HTTP endpoints
- **Assertion library:** Jest syntax works seamlessly
- **No server startup:** Tests hit router directly

---

## Containerization

### Docker

**Choice:** Docker for consistent deployments

**Why:**
- **Consistency:** Works identically across laptops, servers, cloud
- **Efficiency:** Lightweight compared to VMs
- **Isolation:** Services don't interfere with each other
- **CI/CD:** Native support in all modern deployment platforms

**Image Selection:**
```dockerfile
FROM node:20-alpine
```

**Why alpine:**
- ~150MB vs ~900MB for standard node image
- Same functionality; just smaller
- Fast container startup

**Production Multi-Stage Build (future):**
```dockerfile
# Build stage
FROM node:20-alpine as builder
COPY . .
RUN npm ci --only=production
RUN npm run build

# Runtime stage
FROM node:20-alpine
COPY --from=builder /app/dist /app/dist
CMD ["node", "dist/server.js"]
```

### Docker Compose 2.0+

**Choice:** Docker Compose for multi-container orchestration

**Why:**
- **Service coordination:** Automatically starts dependencies in order
- **Networking:** Built-in DNS between containers
- **Environment:** Services discover each other by name
- **Development:** Single command starts entire stack

**Key features used:**
- `depends_on:` Ensures MongoDB starts before services
- `networks:` quiz-network bridges all services
- `healthcheck:` Validates service readiness
- Environment variable injection for service discovery

---

## Production Considerations

### Kubernetes (Phase 4+)

**Choice:** Kubernetes for large-scale production

**Why:**
- **Auto-scaling:** Adjust replicas based on CPU/memory usage
- **Self-healing:** Restart failed containers automatically
- **Rolling updates:** Zero-downtime deployments
- **Service mesh:** Istio for advanced networking

---

## Monitoring & Observability

### Health Checks

Every service exposes `/health` endpoint:
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: process.env.SERVICE_NAME,
    timestamp: new Date().toISOString()
  });
});
```

**Used by:**
- Load balancers: Determine if service is ready to receive traffic
- Kubernetes: Detect pod failures and restart
- Monitoring systems: Alert on service degradation

### Future: Prometheus Metrics

```javascript
const prometheus = require('prom-client');

// Track request duration
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms'
});
```

### Future: Structured Logging

```javascript
const winston = require('winston');

logger.info('Quiz submitted', {
  userId: 'user_001',
  quizId: 'quiz_001',
  score: 85,
  timestamp: new Date()
});
```

---

## Summary Table

| Component | Technology | Version | Rationale |
|-----------|-----------|---------|-----------|
| Runtime | Node.js | 20 LTS | Async-first, large ecosystem |
| Framework | Express | 4.18+ | Minimal, proven, flexible |
| Database | MongoDB | 5.0+ | Document-oriented, scalable |
| Security | Helmet | 7.0+ | HTTP header protection |
| HTTP Client | Axios | 1.4+ | Promise-based, reliable |
| Containers | Docker | Latest | Consistent deployments |
| Orchestration | Docker Compose | 2.0+ | Local development & small production |
| Development | Nodemon | 3.0+ | Auto-reload, saves time |
| Linting | ESLint | 9+ | Code quality, catch bugs |
| Formatting | Prettier | 3.0+ | Consistency, no debates |
| Testing | Jest | 29+ | Comprehensive, zero-config |
| HTTP Testing | Supertest | 6+ | Express integration |

---

## Architecture Decisions

### Microservices vs Monolith

**Decision:** Start with monolith (Phase 1), migrate to microservices (Phase 2)

**Rationale:**
- **Learning:** Understand monolith before distributing
- **Pragmatism:** Monolith sufficient for <10K users
- **Clear split:** Three services align with business domains (users, quizzes, scoring)

### REST API vs GraphQL

**Decision:** REST API (simpler, proven)

**Why not GraphQL:**
- Complexity for initial phase
- REST endpoints already cacheable
- GraphQL can be added in Phase 4 wrapper

### Synchronous vs Asynchronous Communication

**Decision:** Synchronous HTTP (Results Service → Quiz Service)

**Why:**
- **Simple:** Direct request/response
- **Clear errors:** Immediate feedback if service down
- **Small payload:** Answers response <1KB

**Future async migrations:**
- Quiz creation: Queue → Background processing
- User notifications: Event sourcing → Message broker

---

## Scaling Path

| Phase | Users | Architecture | Database | Changes |
|-------|-------|-----------|-----------|---------|
| 2 (Current) | 0-1K | Monolithic | In-memory | Foundation |
| 3 | 1K-10K | Microservices | MongoDB | Persistence |
| 4 | 10K-1M | K8s | MongoDB Replica | High availability |
| 5 | 1M+ | Multi-region | Sharded MongoDB | Global distribution |

---

## Conclusion

This stack balances:
- **Simplicity:** Easy to learn and modify
- **Performance:** Handles thousands of concurrent users
- **Scalability:** Grows from single server to distributed system
- **Reliability:** Industry-proven technologies
- **Maintainability:** Clear code, industry standards

Every technology choice enables moving from prototype to production without major rewrites.

