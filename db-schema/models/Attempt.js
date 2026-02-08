const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
  // Who took the quiz
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  // Which quiz
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: [true, 'Quiz is required']
  },
  // Array of answers (one per question)
  answers: [{
    // Which question
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true
    },
    // What did user answer? Can be string, number, or boolean
    userAnswer: mongoose.Schema.Types.Mixed,
    // Was it correct? Calculated automatically
    isCorrect: Boolean,
    // How many points earned for this question
    pointsEarned: {
      type: Number,
      default: 0
    },
    // How long did user spend on this question? (seconds)
    timeSpent: Number
  }],
  // Final score data
  score: {
    totalPoints: {
      type: Number,
      default: 0
    },
    maxPoints: {
      type: Number,
      required: [true, 'Max points is required']
    },
    percentage: {
      type: Number,
      default: 0
      // 0-100
    }
  },
  // Timing info
  timing: {
    startedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: Date,
    totalTime: Number
    // Total time in seconds
  },
  // Status tracking
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'abandoned'],
    default: 'in-progress'
  }
}, {
  timestamps: true
});

// Pre-save: Calculate final score automatically before saving
attemptSchema.pre('save', function(next) {
  if (this.status === 'completed') {
    // Sum up all points earned
    this.score.totalPoints = this.answers.reduce((sum, answer) => {
      return sum + (answer.pointsEarned || 0);
    }, 0);
    
    // Calculate percentage
    if (this.score.maxPoints > 0) {
      this.score.percentage = (this.score.totalPoints / this.score.maxPoints) * 100;
    }
    
    // Fill in completion time if not set
    if (!this.timing.completedAt) {
      this.timing.completedAt = new Date();
      // Calculate total time in seconds
      this.timing.totalTime = Math.floor(
        (this.timing.completedAt - this.timing.startedAt) / 1000
      );
    }
  }
  
  next();
});

// Method to evaluate an answer and update the attempt
attemptSchema.methods.evaluateAnswer = async function(questionId, userAnswer, questionData) {
  const answerIndex = this.answers.findIndex(
    a => a.question.toString() === questionId.toString()
  );
  
  if (answerIndex === -1) {
    throw new Error('Question not found in attempt');
  }
  
  const answer = this.answers[answerIndex];
  
  // Determine if answer is correct based on question type
  if (questionData.type === 'multiple-choice') {
    const correctOption = questionData.options.find(opt => opt.isCorrect);
    answer.isCorrect = userAnswer === correctOption.text;
  } else if (questionData.type === 'true-false') {
    answer.isCorrect = userAnswer === questionData.correctAnswer;
  } else if (questionData.type === 'short-answer') {
    // Case-insensitive comparison
    answer.isCorrect = userAnswer.toLowerCase() === questionData.correctAnswer.toLowerCase();
  }
  
  // Award points if correct
  if (answer.isCorrect) {
    answer.pointsEarned = questionData.points;
  } else {
    answer.pointsEarned = 0;
  }
  
  return answer;
};

module.exports = mongoose.model('Attempt', attemptSchema);
