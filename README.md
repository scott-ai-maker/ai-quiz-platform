# AI Quiz Platform

A production-ready, microservices-based quiz platform with AI-powered content generation, intelligent scoring, and real-time analytics.

## Features

- **Microservices Architecture** - Three independently deployable services
- **Inter-Service Communication** - REST APIs with health monitoring
- **Docker Containerization** - Production-ready with Docker Compose
- **Security First** - Helmet.js, CORS, rate limiting
- **Scalable Design** - Loose coupling enables independent scaling
- **Express.js & MongoDB** - Modern, reliable stack

## Getting Started

### Prerequisites
- Node.js 20+
- MongoDB
- Docker (optional)

### Installation

**Local Development:**
```bash
cd services/user-service && npm install && npm start
cd services/quiz-service && npm install && npm start
cd services/results-service && npm install && npm start
```

**Docker:**
```bash
docker-compose up
```

Services: http://localhost:3001, 3002, 3003

## Architecture

**Three Independent Microservices:**
- **User Service (3001)** - Authentication & profiles
- **Quiz Service (3002)** - Content & questions
- **Results Service (3003)** - Scoring & leaderboards

## Tech Stack

Node.js 20+ | Express.js | MongoDB | Docker | Helmet | CORS | Rate Limiting

## Development

```bash
npm run dev      # Auto-reload development
npm run lint     # ESLint
npm run test     # Run tests
```

## Deployment

```bash
docker-compose up   # Start all services
docker-compose down # Stop services
```

## Security

✅ CORS configured  
✅ Helmet.js security headers  
✅ Rate limiting protection  
✅ Environment-based secrets  
✅ Service isolation via Docker networking  

## License

MIT

---

**Built with:** Node.js | Express | MongoDB | Docker
