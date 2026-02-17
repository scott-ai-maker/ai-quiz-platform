# Quiz Session Management Service - Quick Reference

## Architecture Overview

```
FastAPI Endpoint
    ↓
SessionManager (business logic)
    ├→ Redis (fast, cache, 30min TTL)
    └→ PostgreSQL (durable, source of truth)
    ├→ Auto-save loop (every 30 sec)
    └→ Optimistic locking (version field)
```

## Session Lifecycle

```
1. START SESSION
   POST /sessions/start {user_id, quiz_id}
   └→ Create QuizAttempt (status=started)
   └→ Store in Redis + PostgreSQL
   └→ Start auto-save background task

2. IN PROGRESS
   PATCH /sessions/{id}/progress {question_id, answer}
   └→ Check current version
   └→ Increment version + 1
   └→ Update answers dict
   └→ Save to PostgreSQL (if version matches)
   └→ Update Redis cache

3. AUTO-SAVE (every 30 sec)
   Background task triggers
   └→ Read from Redis
   └→ Write to PostgreSQL
   └→ Decrement time_remaining
   └→ Check if expired (≤0 sec)

4. COMPLETE
   POST /sessions/{id}/complete
   └→ Mark status=completed
   └→ Save final score
   └→ Stop auto-save task
   └→ Keep in PostgreSQL for history
```

## Key Data Structures

```python
# Quiz Attempt (in-flight)
{
  "id": "uuid",
  "user_id": "user123",
  "quiz_id": "quiz456",
  "current_question": 3,
  "answers": {"0": "A", "1": "C", "2": "B"},
  "status": "in_progress",
  "time_remaining": 1200,  # seconds
  "version": 5,
  "last_updated": "2026-02-17T10:30:00"
}

# Redis Key Structure
session:{session_id} → JSON serialized QuizAttempt

# PostgreSQL Schema
quiz_attempts (
  id PK,
  user_id,
  quiz_id,
  answers JSONB,
  status,
  version,
  time_remaining,
  INDEX: user_id, quiz_id, status
)
```

## Error Cases to Handle

```python
# Race Condition: Version Mismatch
Current DB: version=5
User reads: version=5
User tries to write: version=6 (from 5)
But someone else already incremented to 6
→ Conflict! Return 409 Conflict

# Session Expired
time_remaining ≤ 0
→ Auto mark status=expired
→ No more updates allowed
→ Return 410 Gone

# Session Not Found
No session ID matches
→ Return 404 Not Found

# Database Down
Redis is empty AND PostgreSQL is down
→ Return 503 Service Unavailable
```

## Python Async Patterns

```python
# JavaScript (Day 1-6)
app.post('/sessions', async (req, res) => {
  const session = await sessionManager.create(req.body);
  res.json(session);
});

# Python (Day 7)
@app.post('/sessions')
async def create_session(data: CreateSessionRequest):
  session = await session_manager.create_session(data.user_id, data.quiz_id)
  return session

# The async/await syntax is almost identical!
# Key difference: Python's asyncio vs Node's event loop
```

## FastAPI vs Express

```python
# EXPRESS (JavaScript)
app.get('/sessions/:id', async (req, res, next) => {
  try {
    const session = await sessionManager.get(req.params.id);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

# FastAPI (Python) - looks even cleaner!
@app.get('/sessions/{session_id}')
async def get_session(session_id: str):
  session = await session_manager.get_session(session_id)
  if not session:
    raise HTTPException(status_code=404, detail="Session not found")
  return session
```

## Testing Patterns to Use

```python
# Unit Test
async def test_create_session():
  manager = SessionManager()
  session = await manager.create_session("user1", "quiz1")
  assert session.status == "started"
  assert session.user_id == "user1"

# Integration Test with HTTP
async def test_start_session_endpoint():
  response = client.post("/sessions/start", json={
    "user_id": "user1",
    "quiz_id": "quiz1"
  })
  assert response.status_code == 201
  data = response.json()
  assert data["status"] == "started"

# Concurrent Test
async def test_concurrent_updates():
  session_id = "test-session"
  # Create 10 concurrent requests
  tasks = [
    update_answer(session_id, i, f"answer{i}")
    for i in range(10)
  ]
  results = await asyncio.gather(*tasks)
  # Verify final version is 10
  final = await get_session(session_id)
  assert final.version == 10
```

## Performance Targets

| Metric | Target | Path |
|--------|--------|------|
| Read (cache hit) | <15ms | Redis lookup |
| Write (update answer) | <50ms | PostgreSQL transaction |
| Auto-save cycle | <100ms | PostgreSQL batch update |
| Session creation | <100ms | PostgreSQL + Redis cache |
| Concurrent sessions | 100+ | With <500ms overall latency |

## Command Line Cheat Sheet

```bash
# Start service
python -m uvicorn src.main:app --reload --port 8002

# Run tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=src

# Check redis connection
redis-cli ping

# Check postgres connection
psql -U postgres -d quiz_db -c "SELECT version();"

# Tail application logs
tail -f app.log
```

## Implementation Error Patterns

### Pattern 1: Missing Await on Async Functions

**Incorrect**:
```python
# Returns coroutine object, not session data
session = session_manager.create_session(user_id, quiz_id)
```

**Correct**:
```python
session = await session_manager.create_session(user_id, quiz_id)
```

---

### Pattern 2: Version Mismatch on Concurrent Updates

**Incorrect**:
```python
# User A reads version=5
# User B reads version=5
# User B writes: version←6
# User A writes: version←6 anyway (overwrites B's changes!)
```

**Correct**:
```python
current_version = await db.get_current_version(session_id)
if current_version != expected_version:
    raise HTTPException(status_code=409, detail="Session conflict")
```

---

### Pattern 3: Background Task Resource Leaks

**Incorrect**:
```python
task = asyncio.create_task(auto_save_loop(session_id))
# Task never cancelled when session ends
```

**Correct**:
```python
task = self.auto_save_tasks[session_id]
task.cancel()
await asyncio.gather(task, return_exceptions=True)

---

## Support and Issues

For questions regarding implementation or architecture, refer to the main specification document: DAY_7_PREP.md

Document Version: 1.0
Last Updated: February 2026
