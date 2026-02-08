const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true,
    maxlength: [500, 'Question cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: ['multiple-choice', 'true-false', 'short-answer'],
    required: [true, 'Question type is required']
  },
  options: [{
    text: {
      type: String,
      required: [true, 'Option text is required']
    },
    isCorrect: {
      type: Boolean,
      default: false
    }
  }],
  correctAnswer: {
    type: String,
    // For short-answer questions
  },
  explanation: {
    type: String,
    maxlength: [1000, 'Explanation cannot exceed 1000 characters'],
    // Why the answer is correct - helps learning
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  points: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  tags: [String],
  // Track which user created this question
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  }
}, {
  timestamps: true
});

// Pre-save validation: ensure multiple choice questions are valid
questionSchema.pre('save', function(next) {
  if (this.type === 'multiple-choice') {
    // Must have at least 2 options
    if (!this.options || this.options.length < 2) {
      return next(new Error('Multiple choice questions must have at least 2 options'));
    }
    
    // Must have at least 1 correct answer
    const correctAnswers = this.options.filter(opt => opt.isCorrect);
    if (correctAnswers.length === 0) {
      return next(new Error('Multiple choice questions must have at least one correct answer'));
    }
  }
  
  if (this.type === 'true-false') {
    // True/false should have exactly 2 options
    if (!this.options || this.options.length !== 2) {
      return next(new Error('True/False questions must have exactly 2 options'));
    }
  }
  
  next();
});

module.exports = mongoose.model('Question', questionSchema);
