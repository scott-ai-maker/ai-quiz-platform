# Day 2 Quick Start Checklist

## Before You Start

- [x] Day 1 code is committed and pushed
- [x] Project structure is clean
- [x] You understand microservices (read DAY_2_OVERVIEW.md)
- [x] You have 2-3 hours available
- [x] MongoDB is still running: `pgrep -l mongod`

## Step-by-Step Startup

### 1. Verify Your Environment
```bash
cd /home/scott/repos/aie/ai-quiz-platform

# Check you're on main branch
git status

# Verify MongoDB running
pgrep -l mongod

# Check Node.js version
node --version  # Should be v18+

# Verify npm works
npm --version
```

### 2. Create Services Directory Structure
```bash
# Create the services folder
mkdir -p services/{user-service,quiz-service,results-service}/src
mkdir -p shared/{middleware,utils}

# You should now have:
# services/
# ├── user-service/src/
# ├── quiz-service/src/
# └── results-service/src/
# shared/
# ├── middleware/
# └── utils/
```

### 3. Initialize Each Service
For each service (user-service, quiz-service, results-service):
```bash
cd services/user-service
npm init -y
npm install express cors helmet dotenv
npm install -D nodemon

# Create .env file
cat > .env << 'EOF'
NODE_ENV=development
PORT=3001
SERVICE_NAME=user-service
EOF

# Create src/server.js with basic Express setup
```

(Repeat for quiz-service on port 3002 and results-service on port 3003)

### 4. Build Each Service
Start with creating basic server files:
- `user-service/src/server.js` - Express server on port 3001
- `quiz-service/src/server.js` - Express server on port 3002
- `results-service/src/server.js` - Express server on port 3003

Each should have:
- Health check endpoint: `GET /health`
- Service info endpoint: `GET /api/info`
- Proper error handling

### 5. Test Each Service Individually
```bash
# Terminal 1: Start user-service
cd services/user-service
npm start

# Terminal 2: Test it
curl http://localhost:3001/health
curl http://localhost:3001/api/info
```

(Repeat for other services on ports 3002, 3003)

### 6. Document as You Go
Keep track of:
- What you're building
- Challenges encountered
- Solutions found
- Time spent on each part

### 7. Create Docker Compose
Once all services are running individually, create:
- `docker-compose.yml` with all three services
- Test with: `docker-compose up`

### 8. Test Inter-Service Communication
Verify services can call each other using `http://service-name:port`

### 9. Commit Progress
```bash
git add .
git commit -m "Day 2: Create microservices architecture

- Created User Service (Port 3001)
- Created Quiz Service (Port 3002)
- Created Results Service (Port 3003)
- Set up Docker Compose orchestration
- All services communicate independently"
```

## 📋 Day 2 Detailed Walkthrough

When you're ready, I'll guide you through:

### Phase 1: Core Setup (45 mins)
- [ ] Create services folder structure ← **START HERE**
- [ ] Initialize npm for each service
- [ ] Create basic Express servers
- [ ] Set up environment variables
- [ ] Create .gitignore for services

### Phase 2: Build User Service (45 mins)
- [ ] Create server.js with Express setup
- [ ] Add health check endpoint
- [ ] Add register endpoint: `POST /api/users/register`
- [ ] Add login endpoint: `POST /api/users/login`
- [ ] Add profile endpoint: `GET /api/users/profile`
- [ ] Test with curl commands

### Phase 3: Build Quiz Service (45 mins)
- [ ] Create server.js with Express setup
- [ ] Add health check endpoint
- [ ] Add list quizzes: `GET /api/quizzes`
- [ ] Add get quiz: `GET /api/quizzes/:id`
- [ ] Add create quiz: `POST /api/quizzes`
- [ ] Test with curl commands

### Phase 4: Build Results Service (45 mins)
- [ ] Create server.js with Express setup
- [ ] Add health check endpoint
- [ ] Add submit results: `POST /api/results/submit`
- [ ] Add user stats: `GET /api/results/user/:id`
- [ ] Add leaderboard: `GET /api/leaderboard`
- [ ] Call Quiz Service from Results Service

### Phase 5: Docker & Integration (30 mins)
- [ ] Create docker-compose.yml
- [ ] Test with docker-compose up
- [ ] Verify inter-service communication
- [ ] Run full end-to-end test

### Phase 6: Documentation & Commit (15 mins)
- [ ] Create Day 2 progress log
- [ ] Document what you learned
- [ ] Commit all changes to Git
- [ ] Push to GitHub

---

## 🎯 When You're Ready

Say **"Start Day 2"** and we'll begin with Phase 1!

I'll guide you step-by-step, you drive the keyboard, and we'll build this distribution system together.

**Total estimated time: 3-4 hours**

Good luck! 🚀
