# Quiz Session Management Service - Technical Specification

## Overview

This document describes the architecture and implementation of a stateful session tracking system for managing concurrent quiz attempts at scale. The service is responsible for persisting user progress, handling disconnection recovery, and maintaining data consistency across distributed deployments.

**Service**: Quiz Session Management
**Language**: Python 3.8+
**Framework**: FastAPI (ASGI)
**Port**: 8002
**Status**: Production-Ready

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────┐
│   FastAPI (Python async) - Port 8002    │
├─────────────────────────────────────────┤
│   Session Endpoints (API Layer)         │
│   - POST /sessions/start                │
│   - GET /sessions/{id}                  │
│   - PATCH /sessions/{id}/progress       │
│   - POST /sessions/{id}/complete        │
├─────────────────────────────────────────┤
│   SessionManager (Business Logic)       │
│   - create_session()                    │
│   - get_session()                       │
│   - update_progress()                   │
│   - auto_save_loop()                    │
├─────────────────────────────────────────┤
│   DatabaseService (Dual Layer)          │
├───────────────────┬─────────────────────┤
│  Redis (Cache)    │  PostgreSQL (DB)    │
│  - Fast reads     │  - Permanent store  │
│  - 30min TTL      │  - Transaction safe │
│  - Fallback       │  - Optimistic lock  │
└───────────────────┴─────────────────────┘
```

## 💾 Data Model: QuizAttempt

```python
QuizAttempt:
  id: str (UUID)
  user_id: str
  quiz_id: str
  started_at: datetime
  current_question: int (0-indexed)
  answers: dict {question_id → answer}
  status: AttemptStatus (started, in_progress, completed, expired, abandoned)
  time_remaining: int (seconds, starts at 1800 = 30 mins)
  last_updated: datetime
  version: int (for optimistic locking)
```

## 🔑 Key Concepts You'll Learn

### 1. Stateful vs Stateless
- **Previous days (stateless)**: Each request independent, no shared state
- **Day 7 (stateful)**: Server remembers ongoing quiz state, survives browser closes

### 2. Optimistic Locking
```python
# Two students update same answer simultaneously
Current: version=5
Student A reads: version=5
Student B reads: version=5
Student B writes: version → 6  ✓ (increments)
Student A writes: version → 6 ✗ (fails, expects 5)
```

### 3. Dual-Layer Caching Pattern
```
Fast path (Cache hit):
  Request → Redis → 1ms response

Resilience (Redis down/miss):
  Request → PostgreSQL → 50ms response

Auto-save:
  Every 30 seconds: Redis + PostgreSQL sync
```

### 4. Auto-Save Loop
```python
async def _auto_save_loop(session_id):
  while session exists:
    wait 30 seconds
    sync Redis → PostgreSQL
    update time_remaining
    check if expired
```

## 📚 Technology Stack

| Component | Why |
|-----------|-----|
| **FastAPI** | Async Python, perfect for concurrent session handling |
| **asyncpg** | Async PostgreSQL driver for non-blocking DB |
| **redis.asyncio** | Async Redis client for session caching |
| **Pydantic** | Type validation (similar to Joi in Express) |
| **SQLAlchemy** | ORM (probably for migrations with Alembic) |
| **Alembic** | Database schema versioning |

## 🎓 Key Differences from Days 1-6

| Aspect | Days 1-6 (Node.js) | Day 7 (Python) |
|--------|------------------|-----------------|
| Framework | Express | FastAPI |
| Language | JavaScript | Python |
| Concurrency | Callbacks/Promises | async/await |
| Async Pattern | Event-driven | Truly async (ASGI) |
| Statefulness | Stateless (JWT) | Stateful (sessions) |
| DB Pattern | Connection pooling | Connection pooling + caching |
| Main Challenge | Error handling | Concurrent state management |

## 📋 Learning Path for Day 7

### Session 1: Setup & Concepts (2 hours)
1. Review FastAPI basics
2. Understand async/await vs promises
3. Set up PostgreSQL + Redis locally
4. Run provided setup.sh to generate skeleton

### Session 2: Data Model & Database (2.5 hours)
1. Implement QuizAttempt model with serialization
2. Create DatabaseService for connection pooling
3. Implement table creation and indexes
4. Write basic CRUD for persistence

### Session 3: Session Manager (2.5 hours)
1. Implement create_session()
2. Implement get_session() with cache fallback
3. Implement update_progress() with optimistic locking
4. Implement _auto_save_loop()

### Session 4: API Endpoints (2 hours)
1. POST /sessions/start → create_session
2. GET /sessions/{id} → get_session
3. PATCH /sessions/{id}/progress → update answer
4. POST /sessions/{id}/complete → mark done

### Session 5: Testing & Scale (2 hours)
1. Unit tests for SessionManager
2. Integration tests for API
3. Concurrent load test
4. Redis failover test

## 💡 Mental Model Analogy

**Netflix watching progress, but for quizzes:**
- Netflix: "Which episode was I on? (cached) → Check if server has it → Show episode"
- Quiz: "Which question am I on? (cached in Redis) → Auto-saved in DB every 30s → Resume from anywhere"

The key difference from Netflix: Quiz service must sync state every 30 seconds AND track down to the exact question+answer level.

## 🚀 Quick Start Tomorrow

```bash
# 1. Navigate to day7
cd /home/scott/repos/aie/day7

# 2. Run setup script (creates all skeleton code)
bash setup.sh

# 3. Install dependencies
cd quiz-session-service
pip install -r requirements.txt

# 4. Start docker containers
docker-compose up -d

# 5. Run the service
python -m uvicorn src.main:app --reload --port 8002

# 6. Test basic endpoint
curl http://localhost:8002/health
```

## 🔍 Code You'll Write Tomorrow

The setup.sh creates 70% of skeleton code. Your job is to implement the remaining 30%:

1. **API Endpoints** - Wire SessionManager to FastAPI routes
2. **Error Handling** - Custom exceptions (like Day 6 but Python style)
3. **Middleware** - Request logging, error catching
4. **Tests** - Unit + integration tests
5. **Cleanup** - Handle expired/abandoned sessions

## ⚠️ Common Pitfalls to Avoid

1. **Async mistakes**: Forgetting `await` on async calls → weird hangs
2. **Redis/DB sync**: Racing conditions when both write simultaneously
3. **Version conflicts**: Not checking version before write
4. **Memory leaks**: Not cleaning up auto-save tasks
5. **Connection pooling**: Opening too many connections, not releasing

## 🎯 Success Criteria

By end of Day 7, you should have:
- ✅ Quiz session can survive browser close
- ✅ Progress auto-saves every 30 seconds
- ✅ Can handle 100+ concurrent sessions
- ✅ Responds in <100ms (Redis hit)/50ms (DB hit)
- ✅ Tests passing for all core flows

## 📖 Pre-Reading (Optional)

If you want to get ahead:
- FastAPI docs: https://fastapi.tiangolo.com/
- async/await in Python: https://realpython.com/async-io-python/
- Optimistic locking pattern: https://en.wikipedia.org/wiki/Optimistic_concurrency_control

---

**Key Takeaway**: Day 7 is about **managing continuous state in a distributed system**. Unlike stateless services (Days 1-6), your session service is the source of truth for where each student is in their quiz.

Good luck tomorrow! You've got this! 🚀
