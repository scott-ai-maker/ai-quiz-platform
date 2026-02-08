const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Quiz title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  // Who created this quiz? Reference to User
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  },
  category: {
    type: String,
    enum: ['math', 'science', 'history', 'literature', 'technology', 'general'],
    required: [true, 'Category is required']
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  // Time limit in minutes
  timeLimit: {
    type: Number,
    default: 30,
    min: [1, 'Time limit must be at least 1 minute'],
    max: [180, 'Time limit cannot exceed 180 minutes']
  },
  // Array of question references
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  // Settings control quiz behavior
  settings: {
    isPublic: {
      type: Boolean,
      default: true
      // Can other users take this quiz?
    },
    allowRetakes: {
      type: Boolean,
      default: true
      // Can users retake the quiz?
    },
    showCorrectAnswers: {
      type: Boolean,
      default: true
      // Show answers after completion?
    },
    randomizeQuestions: {
      type: Boolean,
      default: false
      // Shuffle question order?
    },
    randomizeOptions: {
      type: Boolean,
      default: false
      // Shuffle answer options?
    }
  },
  // Stats updated as users take quiz
  stats: {
    totalAttempts: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    },
    completionRate: {
      type: Number,
      default: 0
      // Percentage of people who completed vs started
    }
  },
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Calculate total points from all questions
quizSchema.virtual('totalPoints').get(function() {
  // This would be calculated when questions are populated
  return 0;
});

module.exports = mongoose.model('Quiz', quizSchema);
