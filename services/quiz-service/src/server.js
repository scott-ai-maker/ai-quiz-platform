// Quiz Service - Port 3002
// Handles: Quiz creation, questions, content delivery
// Architecture: API Layer → Service Layer → Repository Layer → Database (PostgreSQL + Redis)

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { verifyToken } = require('./middleware/auth');
const { initializeDatabase, closeDatabase } = require('./config/database');
const QuizService = require('./services/QuizService');
require('dotenv').config();

const app = express();
const quizService = new QuizService();
const PORT = process.env.PORT || 3002;
const SERVICE_NAME = process.env.SERVICE_NAME || 'quiz-service';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const health = await quizService.healthCheck();
        res.json(health);
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Service info endpoint
app.get('/api/info', (req, res) => {
    res.json({
        message: 'Quiz Service API - Repository Pattern with PostgreSQL + Redis',
        version: '2.0.0',
        service: SERVICE_NAME,
        port: PORT,
        architecture: 'API → Service → Repository → Database',
        endpoints: {
            health: '/health',
            list: 'GET /api/quizzes',
            get: 'GET /api/quizzes/:id',
            create: 'POST /api/quizzes (requires auth)',
            update: 'PUT /api/quizzes/:id (requires auth)',
            delete: 'DELETE /api/quizzes/:id (requires auth)',
            answers: 'GET /api/quizzes/:id/answers (requires auth)',
            category: 'GET /api/quizzes/category/:category',
            recent: 'GET /api/quizzes/recent',
            stats: 'GET /api/quizzes/:id/stats'
        }
    });
});

// Get all quizzes with optional filters
app.get('/api/quizzes', async (req, res) => {
    try {
        const filters = {
            category: req.query.category,
            difficulty: req.query.difficulty,
            is_active: req.query.is_active !== 'false', // default to true
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0
        };

        const result = await quizService.getAllQuizzes(filters);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch quizzes',
            message: error.message
        });
    }
});

// Create new quiz - requires authentication
app.post('/api/quizzes', verifyToken, async (req, res) => {
    try {
        const quizData = req.body;
        const userId = req.user?.username; // From JWT token

        const result = await quizService.createQuiz(quizData, userId);
        
        res.status(201).json({
            message: 'Quiz created successfully',
            ...result
        });
    } catch (error) {
        if (error.message.startsWith('Validation failed')) {
            return res.status(400).json({
                error: 'Validation failed',
                message: error.message
            });
        }
        res.status(500).json({
            error: 'Failed to create quiz',
            message: error.message
        });
    }
});

// Get recent active quizzes (uses composite index for performance) - SPECIFIC ROUTE BEFORE :id
app.get('/api/quizzes/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const result = await quizService.getRecentQuizzes(limit);
        res.json(result);
    } catch (error) {
        if (error.message.includes('must be between')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({
            error: 'Failed to fetch recent quizzes',
            message: error.message
        });
    }
});

// Get quizzes by category (uses composite index for performance) - SPECIFIC ROUTE BEFORE :id
app.get('/api/quizzes/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const { difficulty } = req.query;

        const result = await quizService.getQuizzesByCategory(category, difficulty);
        res.json(result);
    } catch (error) {
        if (error.message.includes('Invalid')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({
            error: 'Failed to fetch quizzes by category',
            message: error.message
        });
    }
});

// Get specific quiz (without answers - for taking quiz) - GENERIC :id ROUTE
app.get('/api/quizzes/:id', async (req, res) => {
    try {
        const quizId = parseInt(req.params.id);
        
        if (isNaN(quizId)) {
            return res.status(400).json({ error: 'Invalid quiz ID' });
        }

        const quiz = await quizService.getQuizForTaking(quizId);
        res.json({ quiz });
    } catch (error) {
        if (error.message === 'Quiz not found') {
            return res.status(404).json({ error: 'Quiz not found', quizId: req.params.id });
        }
        if (error.message === 'Quiz is not available') {
            return res.status(403).json({ error: 'Quiz is not available' });
        }
        res.status(500).json({ error: 'Failed to fetch quiz', message: error.message });
    }
});

// Get quiz statistics - SPECIFIC :id/stats ROUTE
app.get('/api/quizzes/:id/stats', async (req, res) => {
    try {
        const quizId = parseInt(req.params.id);
        
        if (isNaN(quizId)) {
            return res.status(400).json({ error: 'Invalid quiz ID' });
        }

        const stats = await quizService.getQuizStats(quizId);
        res.json(stats);
    } catch (error) {
        if (error.message === 'Quiz not found') {
            return res.status(404).json({ error: 'Quiz not found' });
        }
        res.status(500).json({
            error: 'Failed to fetch quiz statistics',
            message: error.message
        });
    }
});

// Get quiz with answers (for internal use or admin) - requires authentication
app.get('/api/quizzes/:id/answers', verifyToken, async (req, res) => {
    try {
        const quizId = parseInt(req.params.id);
        
        if (isNaN(quizId)) {
            return res.status(400).json({ error: 'Invalid quiz ID' });
        }

        const quiz = await quizService.getQuizById(quizId, true);
        res.json({ quiz });
    } catch (error) {
        if (error.message === 'Quiz not found') {
            return res.status(404).json({ error: 'Quiz not found', quizId: req.params.id });
        }
        res.status(500).json({ error: 'Failed to fetch quiz', message: error.message });
    }
});

// Update quiz - requires authentication
app.put('/api/quizzes/:id', verifyToken, async (req, res) => {
    try {
        const quizId = parseInt(req.params.id);
        
        if (isNaN(quizId)) {
            return res.status(400).json({ error: 'Invalid quiz ID' });
        }

        const updateData = req.body;
        const userId = req.user?.username;

        const result = await quizService.updateQuiz(quizId, updateData, userId);
        
        res.json({
            message: 'Quiz updated successfully',
            ...result
        });
    } catch (error) {
        if (error.message === 'Quiz not found') {
            return res.status(404).json({ error: 'Quiz not found' });
        }
        if (error.message.includes('cannot be empty') || error.message.includes('Invalid')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({
            error: 'Failed to update quiz',
            message: error.message
        });
    }
});

// Delete quiz - requires authentication
app.delete('/api/quizzes/:id', verifyToken, async (req, res) => {
    try {
        const quizId = parseInt(req.params.id);
        
        if (isNaN(quizId)) {
            return res.status(400).json({ error: 'Invalid quiz ID' });
        }

        const hardDelete = req.query.hard === 'true';
        const result = await quizService.deleteQuiz(quizId, hardDelete);
        
        res.json(result);
    } catch (error) {
        if (error.message === 'Quiz not found') {
            return res.status(404).json({ error: 'Quiz not found' });
        }
        res.status(500).json({
            error: 'Failed to delete quiz',
            message: error.message
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.path,
        method: req.method
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Initialize database and start server
async function startServer() {
    try {
        // Initialize database (PostgreSQL + Redis)
        console.log('🔄 Initializing database...');
        await initializeDatabase();
        
        // Start the server
        const server = app.listen(PORT, () => {
            console.log(`📝 Quiz Service running on port ${PORT}`);
            console.log(`📝 Service: ${SERVICE_NAME}`);
            console.log(`🗄️  Database: PostgreSQL with Redis caching`);
            console.log(`🏗️  Architecture: Repository Pattern`);
            console.log(`🌐 Visit http://localhost:${PORT}/health to verify`);
            console.log(`📚 API Info: http://localhost:${PORT}/api/info`);
        });

        // Graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('🔄 SIGTERM received, closing server...');
            server.close(async () => {
                console.log('🔄 HTTP server closed');
                await closeDatabase();
                process.exit(0);
            });
        });

        process.on('SIGINT', async () => {
            console.log('🔄 SIGINT received, closing server...');
            server.close(async () => {
                console.log('🔄 HTTP server closed');
                await closeDatabase();
                process.exit(0);
            });
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();