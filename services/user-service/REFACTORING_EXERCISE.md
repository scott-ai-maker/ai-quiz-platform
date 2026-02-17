# User Service Refactoring Exercise

## Your Mission

Transform the existing basic `user-service` into a production-grade service using the business logic patterns from `quiz-service`.

## Current State (What You Have)

```
user-service/
├── src/
│   └── server.js  (170 lines of basic Express code)
└── package.json

Problems with current code:
- All logic in one file (controller, validation, storage mixed)
- In-memory storage (no database)
- Generic error handling
- No business rules
- No separation of concerns
```

## Goal State (What You'll Build)

```
user-service/
├── src/
│   ├── exceptions/
│   │   └── UserExceptions.js          ← Custom exception hierarchy
│   ├── repositories/
│   │   └── UserRepository.js          ← Data access layer (PostgreSQL)
│   ├── services/
│   │   └── UserService.js             ← Business logic layer
│   ├── controllers/
│   │   └── userController.js          ← HTTP request handling
│   ├── middleware/
│   │   └── auth.js                    ← JWT verification
│   ├── config/
│   │   └── database.js                ← Database connection
│   └── server.js                      ← Express app with routes
└── package.json

Benefits:
- Clear separation of concerns
- Custom exceptions with HTTP status codes
- Business rules enforced consistently
- Testable business logic
- Production-ready error handling
```

## Step-by-Step Refactoring Guide

### Step 1: Create Custom Exceptions (20 minutes)

**File**: `src/exceptions/UserExceptions.js`

**Your Task**: Create exception classes for these scenarios:

```javascript
// 1. User not found (404)
class UserNotFoundError extends Error {
    constructor(userId) {
        // TODO: Set message, name, statusCode, userId
    }
    toJSON() {
        // TODO: Return structured error object
    }
}

// 2. Email already exists (409 Conflict)
class EmailAlreadyExistsError extends Error {
    constructor(email) {
        // TODO: Implement like UserNotFoundError
    }
}

// 3. Username already taken (409 Conflict)
class UsernameTakenError extends Error {
    constructor(username) {
        // TODO: Implement
    }
}

// 4. Invalid password (400 Bad Request)
class WeakPasswordError extends Error {
    constructor(reason) {
        // TODO: Explain what's wrong with password
    }
}

// 5. Profile update limit exceeded (429 Too Many Requests)
class ProfileUpdateLimitError extends Error {
    constructor(todayCount, maxAllowed) {
        // TODO: Include current count and limit
    }
}

// 6. Base validation error (400)
class ValidationError extends Error {
    constructor(message, errors = []) {
        // TODO: Support array of validation errors
    }
}

module.exports = {
    UserNotFoundError,
    EmailAlreadyExistsError,
    UsernameTakenError,
    WeakPasswordError,
    ProfileUpdateLimitError,
    ValidationError
};
```

**Hint**: Look at `quiz-service/src/exceptions/QuizExceptions.js` for the pattern!

**Test Your Work**:
```javascript
const { UserNotFoundError } = require('./UserExceptions');
const error = new UserNotFoundError(123);
console.log(error.toJSON());
// Should show: { error: 'UserNotFoundError', message: '...', statusCode: 404, userId: 123 }
```

---

### Step 2: Create User Repository (30 minutes)

**File**: `src/repositories/UserRepository.js`

**Your Task**: Implement data access layer with PostgreSQL

```javascript
const { pool, getRedisClient } = require('../config/database');

class UserRepository {
    constructor() {
        this.CACHE_TTL = 3600; // 1 hour
        this.CACHE_PREFIX = 'user:';
    }

    // TODO: Implement cache helpers (getCached, setCached, invalidateCache)
    // Hint: Copy from QuizRepository

    async createUser(userData) {
        // TODO: Insert user into 'users' table
        // Fields: username, email, password_hash, full_name, bio, avatar_url
        // Return: Created user object
    }

    async getUserById(userId, useCache = true) {
        // TODO: 
        // 1. Check cache if useCache is true
        // 2. Query database: SELECT * FROM users WHERE id = $1
        // 3. Cache result
        // 4. Return user or null
    }

    async getUserByEmail(email) {
        // TODO: SELECT * FROM users WHERE email = $1
    }

    async getUserByUsername(username) {
        // TODO: SELECT * FROM users WHERE username = $1
    }

    async updateUser(userId, updateData) {
        // TODO: UPDATE users SET ... WHERE id = $1
        // Remember to invalidate cache after update!
    }

    async getUserUpdateCountToday(userId) {
        // TODO: Count updates from user_update_log table for today
        // Used for rate limiting
    }

    async logUserUpdate(userId) {
        // TODO: INSERT INTO user_update_log (user_id, updated_at)
    }
}

module.exports = UserRepository;
```

**Database Schema Needed**:
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    bio TEXT,
    avatar_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_update_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_user_username ON users(username);
CREATE INDEX idx_update_log_user_date ON user_update_log(user_id, updated_at);
```

---

### Step 3: Create User Service with Business Logic (45 minutes)

**File**: `src/services/UserService.js`

**Your Task**: Implement business rules and validation

```javascript
const UserRepository = require('../repositories/UserRepository');
const {
    UserNotFoundError,
    EmailAlreadyExistsError,
    UsernameTakenError,
    WeakPasswordError,
    ProfileUpdateLimitError,
    ValidationError
} = require('../exceptions/UserExceptions');

class UserService {
    constructor() {
        this.repository = new UserRepository();
        
        // TODO: Define business rule constants
        this.MIN_USERNAME_LENGTH = 3;
        this.MAX_USERNAME_LENGTH = 50;
        this.MIN_PASSWORD_LENGTH = 8;
        this.MAX_PROFILE_UPDATES_PER_DAY = 10;
        this.MAX_BIO_LENGTH = 500;
    }

    // TODO: Implement validation methods
    validateUsername(username) {
        // Check: length, valid characters (alphanumeric + underscore)
        // Throw: ValidationError if invalid
    }

    validateEmail(email) {
        // Check: basic email format
        // Throw: ValidationError if invalid
    }

    validatePassword(password) {
        // Check: length, has uppercase, has lowercase, has number
        // Throw: WeakPasswordError with specific reason
    }

    validateBio(bio) {
        // Check: length
        // Throw: ValidationError if too long
    }

    async validateUniqueEmail(email) {
        // Check: email not already in database
        // Throw: EmailAlreadyExistsError if exists
    }

    async validateUniqueUsername(username) {
        // Check: username not already in database
        // Throw: UsernameTakenError if exists
    }

    async validateUpdateQuota(userId) {
        // Check: user hasn't exceeded daily update limit
        // Throw: ProfileUpdateLimitError if over limit
    }

    // TODO: Implement business operations
    async createUser(userData) {
        // 1. Validate username
        // 2. Validate email
        // 3. Validate password
        // 4. Check email uniqueness (async)
        // 5. Check username uniqueness (async)
        // 6. Hash password (use bcrypt)
        // 7. Create user via repository
        // 8. Return success response (NO PASSWORD in response!)
    }

    async getUserProfile(userId) {
        // 1. Get user from repository
        // 2. Throw UserNotFoundError if not found
        // 3. Return user WITHOUT password_hash
    }

    async updateProfile(userId, updateData) {
        // 1. Validate update quota (rate limiting)
        // 2. Validate fields (bio length, etc)
        // 3. Update user via repository
        // 4. Log the update (for quota tracking)
        // 5. Return updated profile
    }

    async searchUsers(query, limit = 10) {
        // Bonus: Search by username or name
    }
}

module.exports = UserService;
```

**Key Patterns to Use**:
1. **Fail Fast**: Check cheap validations first, then expensive database checks
2. **Clear Errors**: Each validation throws specific exception with context
3. **Security**: NEVER return password hashes in responses
4. **Rate Limiting**: Track and limit profile updates per day

---

### Step 4: Update Server.js with Global Error Handler (30 minutes)

**File**: `src/server.js`

**Your Task**: Refactor to use service layer and global error handler

```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const UserService = require('./services/UserService');
const {
    UserNotFoundError,
    EmailAlreadyExistsError,
    UsernameTakenError,
    WeakPasswordError,
    ProfileUpdateLimitError,
    ValidationError
} = require('./exceptions/UserExceptions');

const app = express();
const userService = new UserService();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes - notice how clean they are now!
app.post('/api/users/register', async (req, res, next) => {
    try {
        const result = await userService.createUser(req.body);
        res.status(201).json(result);
    } catch (error) {
        next(error);  // Let global handler deal with it
    }
});

app.get('/api/users/:id', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        const user = await userService.getUserProfile(userId);
        res.json(user);
    } catch (error) {
        next(error);
    }
});

app.put('/api/users/:id', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        const result = await userService.updateProfile(userId, req.body);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// TODO: Add global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.name, err.message);
    
    // TODO: Map each exception type to HTTP status code
    if (err instanceof ValidationError) {
        // return res.status(???)...
    }
    if (err instanceof UserNotFoundError) {
        // return res.status(???)...
    }
    // ... handle all exception types
    
    // Fallback for unexpected errors
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
    });
});
```

---

### Step 5: Set Up Database Configuration (15 minutes)

**File**: `src/config/database.js`

**Your Task**: Copy and adapt from quiz-service

```javascript
const { Pool } = require('pg');
const redis = require('redis');

// TODO: Create PostgreSQL pool
// TODO: Create Redis client
// TODO: Create initializeDatabase() function
// TODO: Create migrations for users table
// TODO: Export pool, getRedisClient, initializeDatabase, closeDatabase
```

**Hint**: This is almost identical to quiz-service, just different table name!

---

### Step 6: Add Dependencies (5 minutes)

```bash
cd services/user-service
npm install pg redis bcrypt
```

**Update `.env`**:
```env
PORT=3001
SERVICE_NAME=user-service
DB_HOST=localhost
DB_PORT=5432
DB_NAME=user_db
DB_USER=postgres
DB_PASSWORD=postgres
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=development
```

---

### Step 7: Test Your Implementation (30 minutes)

**Start services**:
```bash
# Terminal 1: Start PostgreSQL and Redis
cd ai-quiz-platform
docker compose up -d user-postgres user-redis

# Terminal 2: Start user-service
cd services/user-service
npm start
```

**Test with curl**:

```bash
# 1. Test health check
curl http://localhost:3001/health

# 2. Register user (should succeed)
curl -X POST http://localhost:3001/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "SecurePass123!",
    "full_name": "John Doe"
  }'

# 3. Try duplicate email (should get 409)
curl -X POST http://localhost:3001/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "janedoe",
    "email": "john@example.com",
    "password": "SecurePass123!",
    "full_name": "Jane Doe"
  }'

# 4. Try weak password (should get 400)
curl -X POST http://localhost:3001/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "bobsmith",
    "email": "bob@example.com",
    "password": "weak",
    "full_name": "Bob Smith"
  }'

# 5. Get user profile
curl http://localhost:3001/api/users/1

# 6. Update profile (try 11 times quickly to hit rate limit)
for i in {1..11}; do
  curl -X PUT http://localhost:3001/api/users/1 \
    -H "Content-Type: application/json" \
    -d "{\"bio\": \"Updated bio $i\"}"
  echo "Update $i"
done
```

**Expected Results**:
- ✅ Registration succeeds → Returns 201 with user data (no password!)
- ✅ Duplicate email → Returns 409 with EmailAlreadyExistsError
- ✅ Weak password → Returns 400 with WeakPasswordError
- ✅ Get profile → Returns 200 with user data
- ✅ 11th update → Returns 429 with ProfileUpdateLimitError

---

## Success Criteria

You've succeeded when:

1. ✅ All custom exceptions throw with proper HTTP status codes
2. ✅ Business rules are enforced (username length, password strength, rate limiting)
3. ✅ Validation errors provide clear, actionable messages
4. ✅ Global error handler catches and formats all errors consistently
5. ✅ No passwords appear in any API responses
6. ✅ Database queries use connection pooling
7. ✅ Redis caching works for user lookups
8. ✅ Code is organized into clear layers (Controller → Service → Repository)

## Bonus Challenges

Once you have the basics working:

1. **Add JWT Authentication**: Secure the update endpoint
2. **Add Password Reset**: Implement forgot password flow
3. **Add Avatar Upload**: Allow users to upload profile images
4. **Add User Search**: Search users by username or name
5. **Add Account Deactivation**: Soft delete with business rules
6. **Add Email Verification**: Users must verify email before activating

## Common Mistakes to Avoid

1. ❌ **Returning passwords**: NEVER return `password_hash` in responses
2. ❌ **Skipping validation**: Always validate before database operations
3. ❌ **Inconsistent error handling**: Use global error handler, not try/catch everywhere
4. ❌ **Magic numbers**: Use named constants (MIN_USERNAME_LENGTH, not hardcoded 3)
5. ❌ **Bypassing service layer**: Controllers should NEVER call repository directly

## Learning Checkpoints

After each step, ask yourself:

- **Step 1**: Can I throw and catch my custom exceptions?
- **Step 2**: Can my repository create and fetch users?
- **Step 3**: Do my business rules actually prevent invalid data?
- **Step 4**: Does my global error handler map exceptions to HTTP codes?
- **Step 5**: Can I connect to PostgreSQL and Redis?

## Need Help?

**Compare with quiz-service**: Your user-service should follow the same patterns:
```bash
# See how quiz-service does it
cat services/quiz-service/src/exceptions/QuizExceptions.js
cat services/quiz-service/src/services/QuizService.js
cat services/quiz-service/src/server.js
```

**Key differences**:
- Quiz-service manages quizzes → User-service manages users
- Different business rules (quiz difficulty vs password strength)
- Same architectural patterns!

---

## Time Estimate

- **Step 1** (Exceptions): 20 minutes
- **Step 2** (Repository): 30 minutes
- **Step 3** (Service): 45 minutes
- **Step 4** (Server): 30 minutes
- **Step 5** (Config): 15 minutes
- **Step 6** (Dependencies): 5 minutes
- **Step 7** (Testing): 30 minutes

**Total**: ~3 hours for complete implementation

Take breaks! The patterns will sink in better if you do this over 2-3 sessions.

---

## What You'll Learn

By completing this exercise, you'll truly understand:

1. **Custom exceptions** aren't just fancy errors - they're a communication system
2. **Business logic layer** isn't extra complexity - it's organized simplicity
3. **Separation of concerns** isn't academic - it's practical and saves time
4. **Global error handlers** aren't magic - they're just good middleware placement
5. **These patterns** aren't language-specific - they work in Python, Java, Go, C#, etc.

**Most importantly**: You'll have built it yourself. That's when it really sticks.

Good luck! 🚀
