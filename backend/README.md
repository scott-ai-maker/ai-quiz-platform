# AI Quiz Platform - Backend

Day 1 implementation of the AI Quiz Platform backend service.

## Features

- ✅ Express.js REST API
- ✅ MongoDB database connection
- ✅ Claude AI integration
- ✅ Security middleware (Helmet, CORS, Rate Limiting)
- ✅ Environment-based configuration
- ✅ Health check endpoints

## Prerequisites

- Node.js 18+
- MongoDB running locally or connection URI
- Claude API key from Anthropic

## Installation

```bash
npm install
```

## Configuration
Create a .env file in the backend directory:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/ai-quiz-platform
JWT_SECRET=your-secret-key
CLAUDE_API_KEY=your-claude-api-key
```

## Running the Application

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## API Endpoints
- `GET /health` - Health check
- `GET /api` - API information

## Project Structure

```bash
backend/
├── src/
│   ├── config/         # Configuration files
│   ├── controllers/    # Route controllers
│   ├── middleware/     # Custom middleware
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── app.js          # Express app setup
│   └── server.js       # Server entry point
├── tests/              # Test files
└── docs/               # Documentation
```

### Technologies
- Express.js - Web framework
- Mongoose - MongoDB ODM
- Anthropic SDK - Claude AI integration
- Helmet - Security headers
- CORS - Cross-origin resource sharing
- Express Rate Limit - API rate limiting