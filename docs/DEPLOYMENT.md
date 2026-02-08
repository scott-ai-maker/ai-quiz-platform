# Deployment Guide

Production-ready deployment procedures for the AI Quiz Platform microservices.

---

## Overview

The platform is designed for deployment across multiple environments:
- **Development:** Local machine with Docker Compose
- **Staging:** Single Docker Compose instance on staging server
- **Production:** Kubernetes or Docker Swarm with monitoring

This guide covers all deployment scenarios.

---

## Prerequisites

### Required
- Docker and Docker Compose
- Node.js 20+ (for local development)
- MongoDB 5.0+ (for persistence layer)
- Environment configuration files

### Optional
- Kubernetes cluster (for production)
- Prometheus for monitoring
- ELK Stack for logging

---

## Environment Setup

### Development Environment

**1. Create service directories:**
```bash
cd ai-quiz-platform
mkdir -p services/{user-service,quiz-service,results-service}/src
```

**2. Install dependencies:**
```bash
cd services/user-service
npm install --production
```

Repeat for all three services.

**3. Create .env files:**

`services/user-service/.env:`
```bash
NODE_ENV=development
PORT=3001
SERVICE_NAME=user-service
LOG_LEVEL=debug
```

`services/quiz-service/.env:`
```bash
NODE_ENV=development
PORT=3002
SERVICE_NAME=quiz-service
LOG_LEVEL=debug
```

`services/results-service/.env:`
```bash
NODE_ENV=development
PORT=3003
SERVICE_NAME=results-service
QUIZ_SERVICE_URL=http://localhost:3002
LOG_LEVEL=debug
```

**4. Start services:**
```bash
# Option A: Individual terminals
cd services/user-service && npm start
cd services/quiz-service && npm start
cd services/results-service && npm start

# Option B: Docker Compose (recommended)
docker-compose up --build
```

---

### Staging Environment

**1. Build images:**
```bash
docker-compose build
```

**2. Deploy to staging server:**
```bash
# Copy docker-compose.yml and .env files to staging
scp docker-compose.yml user@staging-server:/app/
scp services/**/.env user@staging-server:/app/services/

# Deploy
ssh user@staging-server
cd /app
docker-compose up -d
```

**3. Verify deployment:**
```bash
# Check service health
curl http://staging-server:3001/health
curl http://staging-server:3002/health
curl http://staging-server:3003/health

# Check logs
docker-compose logs -f results-service
```

---

## Production Deployment

### Docker Compose (Small Scale)

For single-machine deployments up to 100K users:

**1. Prepare production environment:**
```bash
# Create application directory
mkdir -p /opt/quiz-platform
cd /opt/quiz-platform

# Copy application files
git clone https://github.com/your-org/ai-quiz-platform.git .
```

**2. Configure production .env:**
```bash
# .env for User Service
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb://db:27017/user-service
JWT_SECRET=<generated-secret-key>
LOG_LEVEL=info

# .env for Quiz Service
NODE_ENV=production
PORT=3002
MONGODB_URI=mongodb://db:27017/quiz-service
LOG_LEVEL=info

# .env for Results Service
NODE_ENV=production
PORT=3003
MONGODB_URI=mongodb://db:27017/results-service
QUIZ_SERVICE_URL=http://quiz-service:3002
LOG_LEVEL=info
```

**3. Create production docker-compose.yml:**
```yaml
version: '3.8'

services:
  user-service:
    build: ./services/user-service
    restart: always
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongodb:27017/user-service
    depends_on:
      - mongodb
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  quiz-service:
    build: ./services/quiz-service
    restart: always
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongodb:27017/quiz-service
    depends_on:
      - mongodb
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  results-service:
    build: ./services/results-service
    restart: always
    ports:
      - "3003:3003"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongodb:27017/results-service
      - QUIZ_SERVICE_URL=http://quiz-service:3002
    depends_on:
      - mongodb
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  mongodb:
    image: mongo:5.0
    restart: always
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: <secure-password>

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - user-service
      - quiz-service
      - results-service

volumes:
  mongodb_data:

networks:
  default:
    name: quiz-network
```

**4. Deploy:**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

**5. Verify:**
```bash
# Check all services
docker-compose ps

# Check logs
docker-compose logs -f

# Health check
for i in 1 2 3; do
  curl http://localhost:300$i/health
done
```

---

### Kubernetes Deployment (Large Scale)

For deployments scaling to 1M+ users:

**1. Create Kubernetes manifests:**

`k8s/user-service-deployment.yaml:`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  labels:
    app: user-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
      - name: user-service
        image: your-registry/user-service:1.0.0
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: mongodb-uri
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
```

**2. Deploy to Kubernetes:**
```bash
kubectl apply -f k8s/

# Check deployment status
kubectl get deployments
kubectl get pods

# Check logs
kubectl logs -f deployment/user-service
```

**3. Scale services:**
```bash
# Increase replicas
kubectl scale deployment user-service --replicas=5

# Auto-scale based on CPU
kubectl autoscale deployment user-service --min=2 --max=10 --cpu-percent=80
```

---

## SSL/TLS Configuration

### NGINX Reverse Proxy with Let's Encrypt

**1. Install Certbot:**
```bash
apt-get install certbot python3-certbot-nginx
```

**2. Obtain certificate:**
```bash
certbot certonly --standalone -d quiz-platform.example.com
```

**3. Configure NGINX:**
```nginx
server {
    listen 443 ssl;
    server_name quiz-platform.example.com;

    ssl_certificate /etc/letsencrypt/live/quiz-platform.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/quiz-platform.example.com/privkey.pem;

    location /api/users {
        proxy_pass http://user-service:3001;
    }

    location /api/quizzes {
        proxy_pass http://quiz-service:3002;
    }

    location /api/results {
        proxy_pass http://results-service:3003;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name quiz-platform.example.com;
    return 301 https://$server_name$request_uri;
}
```

**4. Auto-renew certificates:**
```bash
# Add to crontab
0 3 * * * certbot renew --quiet
```

---

## Database Migration

### MongoDB Setup

**1. Initialize databases:**
```bash
mongo admin --eval "
db.createUser({
  user: 'root',
  pwd: '<password>',
  roles: [{role: 'root', db: 'admin'}]
})
"
```

**2. Create service databases:**
```bash
mongo -u root -p <password> --authenticationDatabase admin <<EOF
use user-service
db.users.createIndex({username: 1}, {unique: true})

use quiz-service
db.quizzes.createIndex({title: 1})

use results-service
db.results.createIndex({userId: 1, quizId: 1})
db.leaderboard.createIndex({score: -1})
EOF
```

**3. Backup strategy:**
```bash
# Daily backups
0 2 * * * mongodump --out /backups/$(date +\%Y-\%m-\%d) --authenticationDatabase admin -u root -p "<password>"

# Cleanup old backups (keep 30 days)
0 3 * * * find /backups -type d -mtime +30 -exec rm -rf {} \;
```

---

## Monitoring & Logging

### Health Checks

All services expose health endpoints for monitoring:

```bash
# Add to alerting system (Prometheus, DataDog, etc.)
curl -f http://localhost:3001/health || alert "User Service down"
curl -f http://localhost:3002/health || alert "Quiz Service down"
curl -f http://localhost:3003/health || alert "Results Service down"
```

### Logging

Configure centralized logging:

```bash
# Docker logs rotation
docker-compose up -d --log-driver json-file --log-opt max-size=10m --log-opt max-file=3

# ELK Stack integration (future)
# Logstash will collect logs from all containers and forward to Elasticsearch
```

### Performance Monitoring

Track key metrics:
- Request latency (target: <100ms p99)
- Error rate (target: <0.1%)
- Service availability (target: 99.99%)
- Database query performance

---

## Security Checklist

**Before Production Deployment:**

- [ ] Environment variables in .env (not committed)
- [ ] MongoDB user authentication enabled
- [ ] HTTPS/TLS certificates installed
- [ ] Firewall rules configured (only expose needed ports)
- [ ] Rate limiting enabled
- [ ] CORS origins whitelist configured
- [ ] Input validation on all endpoints
- [ ] Secrets stored in vault or secrets manager
- [ ] Logs configured (sensitive data masked)
- [ ] Database backups tested and validated
- [ ] Disaster recovery plan documented
- [ ] Security updates for dependencies
- [ ] API authentication tokens configured
- [ ] Database indexes created for performance
- [ ] Load testing completed

---

## Scaling Strategy

### Horizontal Scaling

As traffic grows:

**Phase 1 (0-10K users):**
- Single Docker Compose instance
- Shared MongoDB instance
- NGINX load balancer

**Phase 2 (10K-100K users):**
- Kubernetes cluster (3-5 nodes)
- MongoDB replica set
- Horizontal pod autoscaling

**Phase 3 (100K-1M+ users):**
- Multi-region Kubernetes
- MongoDB sharding
- CDN for static content
- Cache layer (Redis)

---

## Rollback Procedures

If deployment fails:

```bash
# Docker Compose
docker-compose down
git checkout previous-tag
docker-compose up -d

# Kubernetes
kubectl rollout undo deployment/user-service
kubectl rollout undo deployment/quiz-service
kubectl rollout undo deployment/results-service
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs user-service

# Check port availability
netstat -tlnp | grep 3001

# Verify dependency (MongoDB)
docker-compose logs mongodb
```

### Inter-Service Communication Fails

```bash
# Test from Results Service container
docker-compose exec results-service curl http://quiz-service:3002/health

# Check network connectivity
docker-compose exec results-service ping quiz-service
```

### Database Connection Issues

```bash
# Verify MongoDB is running
docker-compose ps mongodb

# Test connection
mongo mongodb://localhost:27017 -u root -p "<password>"

# Check MONGODB_URI environment variable
docker-compose exec user-service env | grep MONGODB_URI
```

---

## Maintenance

### Regular Tasks

**Daily:**
- Monitor health check endpoints
- Review error logs
- Check database disk space

**Weekly:**
- Review performance metrics
- Test backup restoration
- Update security patches

**Monthly:**
- Full system performance review
- Database optimization
- Capacity planning

---

## Support & Escalation

If issues occur in production:

1. **Immediate:** Check health endpoints and logs
2. **5 min:** Review recent deployments/changes
3. **15 min:** Check database connectivity
4. **30 min:** Assess rollback vs. fix-forward decision
5. **1 hour:** Escalate to on-call engineer if unresolved

---

## Next Steps

- Implement Phase 3 features (JWT auth, MongoDB persistence)
- Set up monitoring and alerting
- Configure CI/CD pipeline
- Conduct load testing
- Plan for scaling to higher user counts

