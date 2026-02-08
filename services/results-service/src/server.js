// Results Service - Port 3003
// Handles: Scoring, leaderboards, and analytics

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
const axios = require('axios');
const QUIZ_SERVICE_URL = process.env.QUIZ_SERVICE_URL || 'http://localhost:3002';

const app = express();
const PORT = process.env.PORT || 3003;
const SERVICE_NAME = process.env.SERVICE_NAME || 'results-service';

//Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

//Health check endpoint
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
        message: 'Results Service API',
        version: '1.0.0',
        service: SERVICE_NAME,
        port: PORT,
        endpoints: {
            health: '/health',
            submit: 'POST /api/results/submit',
            leaderboard: 'GET /api/leaderboard',
            userStats: 'GET /api/results/user/:id'
        }
    });
});

// In-memory results storage (replace with database later)
const results = [];
let resultIdCounter = 1;

// Submit quiz results
app.post('/api/results/submit', async (req, res) => {
    const { userId, quizId, answers } = req.body;

    // Validation
    if (!userId || !quizId || !answers || !Array.isArray(answers)) {
        return res.status(400).json({
            error: 'Missing required fields',
            required: ['userId', 'quizId', 'answers (array)']
        });
    }

    // Fetch correct answers from Quiz Service
    const quizResponse = await axios.get(`${QUIZ_SERVICE_URL}/api/quizzes/${quizId}/answers`);
    const correctQuestions = quizResponse.data.quiz.questions;

    // Calculate real score
    let correctAnswers = 0;
    answers.forEach((userAnswer, index) => {
        if (correctQuestions[index] && userAnswer === correctQuestions[index].correctAnswer) {
            correctAnswers++;
        }
    });
    const totalQuestions = answers.length;
    const score = Math.round((correctAnswers / totalQuestions) * 100);

    const result = {
        id: resultIdCounter++,
        userId,
        quizId,
        score,
        correctAnswers,
        totalQuestions,
        answers,
        submittedAt: new Date().toISOString()
    };

    results.push(result);

    res.status(201).json({
        message: 'Quiz submitted successfully',
        result: {
            id: result.id,
            score: result.score,
            correctAnswers: result.correctAnswers,
            totalQuestions: result.totalQuestions
        }
    });
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
    const quizId = req.query.quizId ? parseInt(req.query.quizId) : null;

    // Filter by quizId if provided
    let filteredResults = quizId
        ? results.filter(r => r.quizId === quizId)
        : results;

    // Sort by score descending
    const leaderboard = filteredResults
        .sort((a, b) => b.score - a.score)
        .slice(0, 10) // Top 10
        .map((r, index) => ({
            rank: index + 1,
            userId: r.userId,
            quizId: r.quizId,
            score: r.score,
            submittedAt: r.submittedAt
        }));

    res.json({
        leaderboard,
        total: filteredResults.length,
        quizId: quizId || 'all'
    });
});

// Get user's quiz history
app.get('/api/results/user/:id', (req, res) => {
    const userId = parseInt(req.params.id);

    const userResults = results
        .filter(r => r.userId === userId)
        .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
        .map(r => ({
            id: r.id,
            quizId: r.quizId,
            score: r.score,
            correctAnswers: r.correctAnswers,
            totalQuestions: r.totalQuestions,
            submittedAt: r.submittedAt
        }));

    res.json({
        userId,
        results: userResults,
        total: userResults.length,
        averageScore: userResults.length > 0
            ? Math.round(userResults.reduce((sum, r) => sum + r.score, 0) / userResults.length)
            : 0
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
        message: process.env.NODE_ENV == 'development' ? err.message : undefined
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`🏆 Results Service running on port ${PORT}`);
    console.log(`🏆 Service: ${SERVICE_NAME}`);
    console.log(`🌐 Visit http://localhost:${PORT}/health to verify`);
});

module.exports = app;