// Quiz Service - Port 3002
// Handles: Quiz creation, questions, content delivery

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { verifyToken } = require('./middleware/auth');
require('dotenv').config();


const app = express();
const PORT = process.env.PORT || 3002;
const SERVICE_NAME = process.env.SERVICE_NAME || 'quiz-service';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: SERVICE_NAME,
        timestamp: new Date().toISOString()
    });
});

// Service info endpoint
app.get('/api/info', (req, res) => {
    res.json({
        message: 'Quiz Service API',
        version: '1.0.0',
        service: SERVICE_NAME,
        port: PORT,
        endpoints: {
            health: '/health',
            list: 'GET /api/quizzes',
            get: 'GET /api/quizzes/:id',
            create: 'POST /api/quizzes'
        }
    });
});

// In-memory quiz storage (replace with database later)
const quizzes = [
    {
        id: 1,
        title: 'JavaScript Basics',
        description: 'Test your knowledge of JavaScript fundamentals',
        difficulty: 'beginner',
        questions: [
            {
                id: 1,
                question: 'What is the result of: typeof null?',
                options: ['null', 'object', 'undefined', 'number'],
                correctAnswer: 1
            },
            {
                id: 2,
                question: 'Which method adds an element to the end of an array?',
                options: ['push()', 'pop()', 'shift()', 'unshift()'],
                correctAnswer: 0
            }
        ],
        createdAt: new Date().toISOString()
    }
];
let quizIdCounter = 2;

// Get all quizzes
app.get('/api/quizzes', (req, res) => {
    // Return quizzes without answers
    const quizzesSummary = quizzes.map(quiz => ({
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        difficulty: quiz.difficulty,
        questionCount: quiz.questions.length,
        createdAt: quiz.createdAt
    }));

    res.json({
        quizzes: quizzesSummary,
        total: quizzes.length
    });
});

// Get specific quiz
app.get('/api/quizzes/:id', (req, res) => {
    const quizId = parseInt(req.params.id);
    const quiz = quizzes.find(q => q.id === quizId);

    if (!quiz) {
        return res.status(404).json({
            error: 'Quiz not found',
            quizId
        });
    }

    // Return quiz without correct answers (for taking quiz)
    const quizForTaking = {
        ...quiz,
        questions: quiz.questions.map(q => ({
            id: q.id,
            question: q.question,
            options: q.options
            // correctAnswer omitted for security
        }))
    };

    res.json({ quiz: quizForTaking });
});

// Get quiz with answers (for internal use or admin)
app.get('/api/quizzes/:id/answers', verifyToken, (req, res) => {
    const quizId = parseInt(req.params.id);
    const quiz = quizzes.find(q => q.id === quizId);

    if (!quiz) {
        return res.status(404).json({
            error: 'Quiz not found',
            quizId
        });
    }

    res.json({ quiz });
});

// Create new quiz
app.post('/api/quizzes', verifyToken, (req, res) => {
    const { title, description, difficulty, questions } = req.body;

    // Validation
    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({
            error: 'Missing required fields',
            required: ['title', 'questions (array)']
        });
    }

    // Create new quiz
    const newQuiz = {
        id: quizIdCounter++,
        title,
        description: description || '',
        difficulty: difficulty || 'intermediate',
        questions,
        createdAt: new Date().toISOString()
    };

    quizzes.push(newQuiz);

    res.status(201).json({
        message: 'Quiz created successfully',
        quiz: {
            id: newQuiz.id,
            title: newQuiz.title,
            questionCount: newQuiz.questions.length
        }
    });
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

// Start the server
app.listen(PORT, () => {
    console.log(`📝 Quiz Service running on port ${PORT}`);
    console.log(`📝 Service: ${SERVICE_NAME}`);
    console.log(`🌐 Visit http://localhost:${PORT}/health to verify`);
});

module.exports = app;