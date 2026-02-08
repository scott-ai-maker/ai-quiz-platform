# API Documentation

Complete reference for all endpoints across the AI Quiz Platform microservices.

---

## Overview

The platform exposes three REST APIs across three independent services. All services respond with JSON and include health check endpoints.

**Base URLs:**
- User Service: `http://localhost:3001`
- Quiz Service: `http://localhost:3002`
- Results Service: `http://localhost:3003`

**Response Format:**
```json
{
  "success": true,
  "data": {},
  "error": null
}
```

---

## User Service (Port 3001)

Handles user registration, authentication, and profile management.

### Register User

Create a new user account.

**Endpoint:** `POST /api/users/register`

**Request:**
```json
{
  "username": "john_doe",
  "password": "secure_password123"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "userId": "user_001",
    "username": "john_doe",
    "message": "User registered successfully"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Username already exists"
}
```

**Status Codes:**
- `201 Created` - User successfully created
- `400 Bad Request` - Invalid input or username exists
- `500 Internal Server Error` - Server error

---

### Login User

Authenticate user and receive token.

**Endpoint:** `POST /api/users/login`

**Request:**
```json
{
  "username": "john_doe",
  "password": "secure_password123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "user_001",
    "username": "john_doe",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "error": "Invalid username or password"
}
```

**Status Codes:**
- `200 OK` - Authentication successful
- `401 Unauthorized` - Invalid credentials
- `404 Not Found` - User not found
- `500 Internal Server Error` - Server error

---

### Get User Profile

Retrieve authenticated user's profile information.

**Endpoint:** `GET /api/users/profile`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "user_001",
    "username": "john_doe",
    "createdAt": "2024-02-08T10:00:00Z"
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "error": "Unauthorized: Invalid or missing token"
}
```

**Status Codes:**
- `200 OK` - Profile retrieved successfully
- `401 Unauthorized` - Invalid or missing token
- `404 Not Found` - User not found
- `500 Internal Server Error` - Server error

---

### Health Check

Verify User Service is operational.

**Endpoint:** `GET /health`

**Response (200):**
```json
{
  "status": "ok",
  "service": "user-service",
  "timestamp": "2024-02-08T10:15:00Z"
}
```

---

## Quiz Service (Port 3002)

Manages quiz content, questions, and internal answer verification.

### List All Quizzes

Retrieve all available quizzes.

**Endpoint:** `GET /api/quizzes`

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "quiz_001",
      "title": "JavaScript Basics",
      "questionCount": 5
    },
    {
      "id": "quiz_002",
      "title": "Python Fundamentals",
      "questionCount": 8
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Quizzes retrieved successfully
- `500 Internal Server Error` - Server error

---

### Get Quiz (Public)

Retrieve a quiz for user to take (without answers).

**Endpoint:** `GET /api/quizzes/:id`

**Parameters:**
- `id` (string, required) - Quiz identifier (e.g., "quiz_001")

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "quiz_001",
    "title": "JavaScript Basics",
    "questions": [
      {
        "id": "q1",
        "text": "What is JavaScript?",
        "options": [
          "A programming language",
          "A CSS framework",
          "A web browser",
          "A database"
        ]
      },
      {
        "id": "q2",
        "text": "Which keyword declares a variable?",
        "options": ["var", "let", "const", "All of the above"]
      }
    ]
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Quiz not found"
}
```

**Status Codes:**
- `200 OK` - Quiz retrieved successfully
- `404 Not Found` - Quiz doesn't exist
- `500 Internal Server Error` - Server error

⚠️ **Note:** This endpoint intentionally omits correct answers for security.

---

### Get Quiz Answers (Internal)

Retrieve correct answers for a quiz. **For internal service use only** (Results Service).

**Endpoint:** `GET /api/quizzes/:id/answers`

**Parameters:**
- `id` (string, required) - Quiz identifier

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "answers": [0, 3, 1, 2, 0]
  }
}
```

**Response Details:**
- `answers` is an array of indices corresponding to correct option for each question
- Index 0 = first option, Index 1 = second option, etc.

**Status Codes:**
- `200 OK` - Answers retrieved successfully
- `404 Not Found` - Quiz doesn't exist
- `500 Internal Server Error` - Server error

⚠️ **Security:** This endpoint must be protected in production (IP whitelist or authentication).

---

### Create Quiz

Add a new quiz to the platform.

**Endpoint:** `POST /api/quizzes`

**Request:**
```json
{
  "title": "React Advanced Patterns",
  "questions": [
    {
      "text": "What is a custom hook?",
      "options": [
        "A React feature",
        "A JavaScript library",
        "A CSS selector",
        "A database query"
      ],
      "correctAnswer": 0
    },
    {
      "text": "Which hook manages side effects?",
      "options": ["useState", "useEffect", "useContext", "useReducer"],
      "correctAnswer": 1
    }
  ]
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "quiz_003",
    "title": "React Advanced Patterns",
    "questionCount": 2,
    "message": "Quiz created successfully"
  }
}
```

**Status Codes:**
- `201 Created` - Quiz successfully created
- `400 Bad Request` - Invalid input
- `500 Internal Server Error` - Server error

---

### Health Check

Verify Quiz Service is operational.

**Endpoint:** `GET /health`

**Response (200):**
```json
{
  "status": "ok",
  "service": "quiz-service",
  "timestamp": "2024-02-08T10:15:00Z"
}
```

---

## Results Service (Port 3003)

Handles quiz submissions, scoring, and leaderboard management.

### Submit Quiz Answers

Submit a completed quiz for scoring.

**Endpoint:** `POST /api/results/submit`

**Request:**
```json
{
  "userId": "user_001",
  "quizId": "quiz_001",
  "answers": [0, 2, 1, 3, 0]
}
```

**Request Details:**
- `userId` - User identifier (string)
- `quizId` - Quiz identifier (string)
- `answers` - Array of selected option indices (integers)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "resultId": "result_001",
    "score": 80,
    "correctCount": 4,
    "totalCount": 5,
    "percentage": "80%"
  }
}
```

**Error Response Examples:**

Quiz not found (404):
```json
{
  "success": false,
  "error": "Quiz not found"
}
```

Invalid submission (400):
```json
{
  "success": false,
  "error": "Answer count does not match question count"
}
```

**Status Codes:**
- `200 OK` - Quiz scored successfully
- `400 Bad Request` - Invalid submission format
- `404 Not Found` - Quiz doesn't exist
- `500 Internal Server Error` - Server error

**Scoring Algorithm:**
- Compares each user answer with correct answer
- Calculates percentage: (correctCount / totalCount) * 100
- Result rounded to nearest integer

---

### Get Leaderboard

Retrieve top scores across all users.

**Endpoint:** `GET /api/leaderboard`

**Query Parameters (optional):**
- `limit` (integer) - Number of results (default: 10, max: 100)
- `quizId` (string) - Filter by quiz (default: all quizzes)

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "userId": "user_003",
      "username": "alice",
      "score": 95,
      "quizId": "quiz_001"
    },
    {
      "rank": 2,
      "userId": "user_001",
      "username": "john_doe",
      "score": 80,
      "quizId": "quiz_001"
    },
    {
      "rank": 3,
      "userId": "user_002",
      "username": "bob",
      "score": 70,
      "quizId": "quiz_001"
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Leaderboard retrieved
- `400 Bad Request` - Invalid query parameters
- `500 Internal Server Error` - Server error

---

### Get User Results

Retrieve submission history for a specific user.

**Endpoint:** `GET /api/results/user/:id`

**Parameters:**
- `id` (string, required) - User identifier

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "user_001",
    "username": "john_doe",
    "results": [
      {
        "resultId": "result_001",
        "quizId": "quiz_001",
        "score": 80,
        "submittedAt": "2024-02-08T10:15:00Z"
      },
      {
        "resultId": "result_002",
        "quizId": "quiz_002",
        "score": 75,
        "submittedAt": "2024-02-08T10:30:00Z"
      }
    ],
    "averageScore": 77.5
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "User not found"
}
```

**Status Codes:**
- `200 OK` - Results retrieved successfully
- `404 Not Found` - User doesn't exist
- `500 Internal Server Error` - Server error

---

### Health Check

Verify Results Service is operational.

**Endpoint:** `GET /health`

**Response (200):**
```json
{
  "status": "ok",
  "service": "results-service",
  "timestamp": "2024-02-08T10:15:00Z"
}
```

---

## Common HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Request succeeded, data returned |
| 201 | Created | Resource successfully created |
| 400 | Bad Request | Invalid input or malformed request |
| 401 | Unauthorized | Missing or invalid authentication |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Unexpected server error |

---

## Error Handling

All error responses follow this format:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

**Common Error Scenarios:**
- Missing required fields → 400
- Invalid data types → 400
- Resource not found → 404
- Authentication failed → 401
- Server issues → 500

---

## Authentication

The platform uses JWT tokens for authentication (implemented in Phase 3+).

**Current state:** Authentication tokens available from login endpoint, validation in progress.

**Future implementation:**
- Include token in Authorization header: `Authorization: Bearer <token>`
- Token validation on protected endpoints
- Token expiration and refresh mechanisms

---

## Rate Limiting

All services implement rate limiting:
- **Default:** 100 requests per 15 minutes per IP
- **Adjustable:** Configure in environment variables

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1707388800
```

---

## Examples

### Complete Workflow

```bash
# 1. Register user
curl -X POST http://localhost:3001/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "password": "secure123"
  }'

# Response: user_001, token

# 2. List quizzes
curl http://localhost:3002/api/quizzes

# 3. Get specific quiz
curl http://localhost:3002/api/quizzes/quiz_001

# 4. Submit answers
curl -X POST http://localhost:3003/api/results/submit \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_001",
    "quizId": "quiz_001",
    "answers": [0, 2, 1, 3, 0]
  }'

# Response: {score: 80, correctCount: 4, totalCount: 5}

# 5. Check leaderboard
curl http://localhost:3003/api/leaderboard

# 6. View user results
curl http://localhost:3003/api/results/user/user_001
```

---

## Changelog

**Phase 2 (Current)**
- ✅ All core endpoints implemented
- ✅ Inter-service communication working
- ✅ Health checks implemented

**Phase 3 (Planned)**
- Full JWT authentication
- MongoDB persistence
- Request validation schemas
- Enhanced error messages
- API versioning (v1, v2, etc.)

