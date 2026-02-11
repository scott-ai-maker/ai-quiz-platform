# Authentication Service - Day 4

Production-ready authentication microservice with JWT tokens, bcrypt password hashing, and MongoDB integration.

## 🚀 Quick Start

### Option 1: Run with Docker (Recommended)

```bash
cd docker
docker-compose up -d
```

Visit http://localhost:8000

### Option 2: Run Locally

**Prerequisites:**
- Python 3.11+
- MongoDB running on localhost:27017

**Steps:**

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Set environment variables
export PYTHONPATH=$(pwd)
export MONGODB_URL="mongodb://localhost:27017"

# 3. Run the service
python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

## 🧪 Testing

```bash
# Run all tests
python run_tests.py

# Or use pytest directly
pytest tests/ -v
```

## 📡 API Endpoints

- **POST /auth/register** - Register new user
- **POST /auth/login** - Login and get JWT token
- **GET /auth/me** - Get current user (requires token)
- **GET /auth/health** - Health check

## 🔐 Security Features

- ✅ Bcrypt password hashing
- ✅ JWT token authentication (30 min expiry)
- ✅ Password strength validation
- ✅ MongoDB with indexes
- ✅ CORS configuration

## 📖 API Documentation

Interactive docs available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
