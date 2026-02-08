# Backend Service

This is the legacy monolithic backend. The current architecture uses three microservices instead.

## Features

- Express.js REST API
- MongoDB database integration
- Claude AI integration
- Security middleware (Helmet, CORS, Rate Limiting)
- Environment-based configuration  
- Health check endpoints

## Prerequisites

- Node.js 18+
- MongoDB running locally or connection URI
- Claude API key from Anthropic

## Installation

```bash
npm install
```

## Configuration

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/ai-quiz-platform
JWT_SECRET=your-secret
CLAUDE_API_KEY=sk-ant-...
```

## Running

```bash
npm start        # Production
npm run dev      # Development with nodemon
npm run lint     # ESLint
npm run test     # Test suite
npm run format   # Prettier formatting
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