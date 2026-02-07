# Day 2: Building Microservices Architecture

## 🎯 What You're Building Today

A **distributed microservices system** with three independent services that communicate through REST APIs. This is the same architectural pattern used by **Netflix, Uber, Spotify, and Discord**.

---

## 🏗️ The Three Pillars

### 1️⃣ User Service (Port 3001) 🔐
**Handles:** Authentication, user profiles, session management
- Every user interaction starts here
- Isolated user data management
- Can scale independently for login traffic

**Key Endpoints:**
```
POST   /api/users/register     - User registration
POST   /api/users/login        - Authentication
GET    /api/users/profile      - Profile retrieval
GET    /health                 - Health check
```

### 2️⃣ Quiz Service (Port 3002) 📝
**Handles:** Quiz creation, question management, content delivery
- Core platform functionality
- Stores quiz questions and metadata
- Manages content without exposing answers to users

**Key Endpoints:**
```
GET    /api/quizzes            - List all quizzes
GET    /api/quizzes/:id        - Get specific quiz
POST   /api/quizzes            - Create new quiz
GET    /health                 - Health check
```

### 3️⃣ Results Service (Port 3003) 🏆
**Handles:** Score calculation, leaderboards, analytics
- Evaluates quiz submissions
- Tracks user performance over time
- Generates competitive rankings

**Key Endpoints:**
```
POST   /api/results/submit     - Submit quiz answers
GET    /api/results/user/:id   - User statistics
GET    /api/leaderboard        - View rankings
GET    /health                 - Health check
```

---

## 🔗 How They Communicate

```
User Request
    ↓
API Gateway / Routing (on main backend)
    ↓
┌───────────────────────────────────────────┐
│  Microservices Communication Pattern      │
└───────────────────────────────────────────┘
    ↓                  ↓                  ↓
User Service    Quiz Service       Results Service
(Port 3001)     (Port 3002)        (Port 3003)
   │                │                  │
   └────────────────┼──────────────────┘
        Independent Services
```

**Communication Flow Example:**
1. User registers with User Service
2. User requests quiz from Quiz Service
3. User submits answers to Results Service
4. Results Service calls Quiz Service to get correct answers
5. Results Service updates leaderboard
6. All services can restart without affecting others

---

## 📁 Project Structure for Day 2

```
ai-quiz-platform/
├── services/                    ← NEW: All microservices
│   ├── user-service/           ← NEW: Port 3001
│   │   ├── src/
│   │   ├── package.json
│   │   └── .env
│   ├── quiz-service/           ← NEW: Port 3002
│   │   ├── src/
│   │   ├── package.json
│   │   └── .env
│   └── results-service/        ← NEW: Port 3003
│       ├── src/
│       ├── package.json
│       └── .env
├── shared/                     ← NEW: Common utilities
│   ├── middleware/
│   └── utils/
├── backend/                    ← Day 1 (archived)
├── docs/
├── docker-compose.yml          ← UPDATED: Multi-service
└── package.json
```

---

## 🎓 Key Concepts You'll Learn

### Microservices Architecture Pattern
- **Service Independence**: Each service owns its code and data
- **API-First Design**: Services communicate through REST APIs
- **Scalability**: Services scale independently based on demand
- **Resilience**: One service failure doesn't crash the entire system

### Design Patterns
- **API Gateway Pattern**: Single entry point for all requests
- **Database Per Service**: Each service has independent data
- **Health Checks**: Services demonstrate liveness to load balancers
- **Error Handling**: Graceful failures and proper HTTP status codes

### Real-World Benefits
- Netflix scales authentication separately from video streaming
- Spotify scales music recommendation independent of payment processing
- Discord's chat service scales differently than voice
- Each team can deploy independently without waiting for others

---

## 📊 Comparison: Day 1 vs Day 2

| Aspect | Day 1 | Day 2 |
|--------|-------|-------|
| **Architecture** | Single monolithic backend | Three independent microservices |
| **Ports** | 3000 | 3001, 3002, 3003 |
| **Database** | Shared MongoDB | Separate databases per service |
| **Scaling** | All or nothing | Can scale each service individually |
| **Deployment** | Single container | Multiple containers (Docker Compose) |
| **Failure Impact** | Full system down | Only affected service impacted |

---

## 🛠️ What You'll Code

### Part 1: Service Setup (30 mins)
- Create three independent Node.js/Express services
- Set up package.json for each service
- Create basic server structure with health checks
- Configure environment variables

### Part 2: Service Implementation (60 mins)
- Build User Service endpoints (register, login, profile)
- Build Quiz Service endpoints (list, get, create)
- Build Results Service endpoints (submit, stats, leaderboard)
- Implement inter-service communication

### Part 3: Docker & Testing (30 mins)
- Create Docker Compose setup
- Run all services simultaneously
- Test service communication
- Verify end-to-end workflows

---

## ✅ Success Criteria for Day 2

You'll know you're successful when:

**Technical Checks:**
- ✅ All three services start without errors
- ✅ Health endpoints respond correctly on all ports (3001, 3002, 3003)
- ✅ Services run independently on different ports
- ✅ `docker-compose up` starts all services together
- ✅ Services can call each other's endpoints

**Architectural Checks:**
- ✅ Each service has its own codebase
- ✅ Services don't share dependencies (independent)
- ✅ API endpoints follow REST conventions
- ✅ Error handling is consistent across services
- ✅ Health checks work for load balancer detection

**Learning Checks:**
- ✅ You understand why services are separated
- ✅ You can explain the data flow between services
- ✅ You feel confident about microservices concepts
- ✅ You see how this scales to real systems

---

## 🚨 Important Decisions

### Should we refactor Day 1 code?
**Option A:** Keep Day 1 backend as reference → Start fresh for services
**Option B:** Refactor Day 1 as User Service → Faster but might miss concepts

**Recommendation:** **Option A** - Start fresh to understand microservices from scratch. Your Day 1 code remains as reference and documentation.

### Database Strategy for Day 2
Since Day 2 focuses on **architecture patterns**, we'll:
- Use in-memory data structures (no real databases yet)
- Mock external service calls for now
- Focus on **service design and communication**
- Add real databases in Day 3

---

## 📚 Resources You'll Need

**Article:** https://aieworks.substack.com/p/day-2-building-your-first-production
**Reference Code:** Day 2 microservices examples from the article
**Your Foundation:** Day 1 backend code (as reference for patterns)

---

## 🎯 Starting Point

When you're ready, we'll:
1. Create the `services/` folder structure
2. Build User Service (Port 3001) - you'll drive the keyboard
3. Build Quiz Service (Port 3002) - you'll drive the keyboard
4. Build Results Service (Port 3003) - you'll drive the keyboard
5. Set up Docker Compose to run all three together
6. Test inter-service communication

---

## 💡 Pro Tips for Day 2

1. **Keep it simple first** - Get services running before adding features
2. **Test as you go** - Use `curl` to test each endpoint immediately
3. **Understand the why** - Don't just copy code, understand service separation
4. **Document differences** - Note how Day 2 differs from Day 1 architecture
5. **Have fun** - You're building production-grade distributed systems!

---

**Ready to become a distributed systems architect?** 🚀

Let me know when you want to start, and we'll build your first microservices!
