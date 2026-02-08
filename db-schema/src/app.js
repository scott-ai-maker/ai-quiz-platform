require('dotenv').config();
const express = require('express');
const connectDatabase = require('../config/database');
const { User, Quiz, Question, Attempt } = require('../models');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// Connect to MongoDB on startup
connectDatabase();

// ========================================
// TEST ROUTES
// ========================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'db-schema',
    timestamp: new Date().toISOString()
  });
});

// Test: Create a user and verify password hashing
app.get('/api/test-user', async (req, res) => {
  try {
    // Delete test user if exists
    await User.deleteOne({ username: 'testuser' });

    // Create new test user
    const testUser = new User({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      profile: {
        firstName: 'Test',
        lastName: 'User'
      }
    });

    const savedUser = await testUser.save();

    // Verify password was hashed
    const plainPassword = 'password123';
    const isPasswordCorrect = await savedUser.comparePassword(plainPassword);

    res.json({
      message: '✅ User schema test passed',
      user: {
        id: savedUser._id,
        username: savedUser.username,
        email: savedUser.email,
        passwordIsHashed: savedUser.password !== plainPassword,
        passwordVerified: isPasswordCorrect
      }
    });
  } catch (error) {
    res.status(500).json({
      message: '❌ User schema test failed',
      error: error.message
    });
  }
});

// Test: Create a question with validation
app.get('/api/test-question', async (req, res) => {
  try {
    // Get the test user first
    let user = await User.findOne({ username: 'testuser' });
    if (!user) {
      return res.status(400).json({ error: 'Test user not found. Call /api/test-user first' });
    }

    // Delete previous test questions
    await Question.deleteMany({ creator: user._id });

    // Create test question
    const testQuestion = new Question({
      question: 'What is 2 + 2?',
      type: 'multiple-choice',
      options: [
        { text: '3', isCorrect: false },
        { text: '4', isCorrect: true },
        { text: '5', isCorrect: false }
      ],
      explanation: 'Basic arithmetic: 2 + 2 equals 4',
      difficulty: 'easy',
      points: 1,
      creator: user._id
    });

    const savedQuestion = await testQuestion.save();

    res.json({
      message: '✅ Question schema test passed',
      question: {
        id: savedQuestion._id,
        question: savedQuestion.question,
        type: savedQuestion.type,
        optionCount: savedQuestion.options.length,
        correctAnswerCount: savedQuestion.options.filter(o => o.isCorrect).length
      }
    });
  } catch (error) {
    res.status(500).json({
      message: '❌ Question schema test failed',
      error: error.message
    });
  }
});

// Test: Create a quiz with questions
app.get('/api/test-quiz', async (req, res) => {
  try {
    // Get test user
    let user = await User.findOne({ username: 'testuser' });
    if (!user) {
      return res.status(400).json({ error: 'Test user not found. Call /api/test-user first' });
    }

    // Get test question
    let question = await Question.findOne({ creator: user._id });
    if (!question) {
      return res.status(400).json({ error: 'Test question not found. Call /api/test-question first' });
    }

    // Delete previous test quiz
    await Quiz.deleteOne({ creator: user._id });

    // Create test quiz
    const testQuiz = new Quiz({
      title: 'Basic Math Quiz',
      description: 'A simple quiz for testing schema',
      creator: user._id,
      category: 'math',
      difficulty: 'easy',
      timeLimit: 10,
      questions: [question._id],
      settings: {
        isPublic: true,
        allowRetakes: true,
        showCorrectAnswers: true,
        randomizeQuestions: false
      }
    });

    const savedQuiz = await testQuiz.save();

    res.json({
      message: '✅ Quiz schema test passed',
      quiz: {
        id: savedQuiz._id,
        title: savedQuiz.title,
        creator: savedQuiz.creator,
        questionCount: savedQuiz.questions.length,
        timeLimit: savedQuiz.timeLimit,
        settings: savedQuiz.settings
      }
    });
  } catch (error) {
    res.status(500).json({
      message: '❌ Quiz schema test failed',
      error: error.message
    });
  }
});

// Test: Create an attempt and score it
app.get('/api/test-attempt', async (req, res) => {
  try {
    // Get test user
    let user = await User.findOne({ username: 'testuser' });
    if (!user) {
      return res.status(400).json({ error: 'Test user not found. Call /api/test-user first' });
    }

    // Get test quiz
    let quiz = await Quiz.findOne({ creator: user._id }).populate('questions');
    if (!quiz) {
      return res.status(400).json({ error: 'Test quiz not found. Call /api/test-quiz first' });
    }

    // Delete previous test attempt
    await Attempt.deleteOne({ user: user._id, quiz: quiz._id });

    // Get question info
    const question = quiz.questions[0];
    const correctOption = question.options.find(o => o.isCorrect);

    // Create attempt
    const testAttempt = new Attempt({
      user: user._id,
      quiz: quiz._id,
      answers: [
        {
          question: question._id,
          userAnswer: correctOption.text,  // Answer correctly
          isCorrect: true,
          pointsEarned: question.points,
          timeSpent: 15
        }
      ],
      score: {
        maxPoints: question.points
      },
      timing: {
        startedAt: new Date(Date.now() - 15000),
        completedAt: new Date()
      },
      status: 'completed'
    });

    const savedAttempt = await testAttempt.save();

    res.json({
      message: '✅ Attempt schema test passed',
      attempt: {
        id: savedAttempt._id,
        user: savedAttempt.user,
        quiz: savedAttempt.quiz,
        answersCount: savedAttempt.answers.length,
        score: {
          earned: savedAttempt.score.totalPoints,
          max: savedAttempt.score.maxPoints,
          percentage: Math.round(savedAttempt.score.percentage) + '%'
        },
        timeSpent: savedAttempt.timing.totalTime + ' seconds',
        status: savedAttempt.status
      }
    });
  } catch (error) {
    res.status(500).json({
      message: '❌ Attempt schema test failed',
      error: error.message
    });
  }
});

// Test: Run all tests in sequence
app.get('/api/test-all', async (req, res) => {
  try {
    console.log('Running full schema tests...');

    // Test 1: User
    let user = await User.findOne({ username: 'testuser' });
    if (!user) {
      const newUser = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        profile: { firstName: 'Test', lastName: 'User' }
      });
      user = await newUser.save();
    }

    // Test 2: Question
    let question = await Question.findOne({ creator: user._id });
    if (!question) {
      const newQuestion = new Question({
        question: 'What is 2 + 2?',
        type: 'multiple-choice',
        options: [
          { text: '3', isCorrect: false },
          { text: '4', isCorrect: true },
          { text: '5', isCorrect: false }
        ],
        difficulty: 'easy',
        points: 1,
        creator: user._id
      });
      question = await newQuestion.save();
    }

    // Test 3: Quiz
    let quiz = await Quiz.findOne({ creator: user._id });
    if (!quiz) {
      const newQuiz = new Quiz({
        title: 'Basic Math Quiz',
        creator: user._id,
        category: 'math',
        questions: [question._id]
      });
      quiz = await newQuiz.save();
    }

    // Test 4: Attempt
    const correctOption = question.options.find(o => o.isCorrect);
    const attempt = new Attempt({
      user: user._id,
      quiz: quiz._id,
      answers: [{
        question: question._id,
        userAnswer: correctOption.text,
        isCorrect: true,
        pointsEarned: question.points,
        timeSpent: 15
      }],
      score: { maxPoints: question.points },
      timing: {
        startedAt: new Date(Date.now() - 15000),
        completedAt: new Date()
      },
      status: 'completed'
    });
    const savedAttempt = await attempt.save();

    res.json({
      message: '✅ All schema tests passed successfully!',
      results: {
        user: { id: user._id, username: user.username },
        question: { id: question._id, type: question.type },
        quiz: { id: quiz._id, title: quiz.title },
        attempt: {
          id: savedAttempt._id,
          score: `${Math.round(savedAttempt.score.percentage)}%`
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      message: '❌ Schema tests failed',
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   Quiz Platform DB Schema Server      ║
║   Listening on port ${PORT}           ║
╚═══════════════════════════════════════╝

Test the schemas with these routes:
  GET http://localhost:${PORT}/health
  GET http://localhost:${PORT}/api/test-user
  GET http://localhost:${PORT}/api/test-question
  GET http://localhost:${PORT}/api/test-quiz
  GET http://localhost:${PORT}/api/test-attempt
  GET http://localhost:${PORT}/api/test-all

Or visit: http://localhost:${PORT}/api/test-all to run all tests
  `);
});

module.exports = app;
