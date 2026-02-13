// Quiz Service Layer - Business Logic
// This layer sits between the API and Repository, handling business rules and validation

const QuizRepository = require('../repositories/QuizRepository');
const {
    ValidationError,
    QuizNotFoundError,
    QuizCreationLimitError,
    UnauthorizedError,
    DifficultyProgressionError,
    QuestionTypeDistributionError,
    InvalidStateError,
    DatabaseError
} = require('../exceptions/QuizExceptions');

class QuizService {
    constructor() {
        this.repository = new QuizRepository();
        
        // Business Rule Constants
        this.MAX_QUIZZES_PER_USER = 50; // Maximum quizzes a user can create
        this.MAX_QUESTION_TYPE_PERCENTAGE = 0.80; // No single question type should exceed 80%
        this.MIN_QUESTIONS_FOR_PROGRESSION = 3; // Minimum questions to enforce difficulty progression
        this.VALID_CATEGORIES = ['general', 'programming', 'science', 'math', 'history', 'other'];
        this.VALID_DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'expert'];
        this.VALID_QUESTION_TYPES = ['multiple_choice', 'true_false', 'short_answer'];
    }

    // Validate quiz data with comprehensive business rules
    validateQuizData(quizData, enforceProgression = true) {
        const errors = [];

        // Title validation
        if (!quizData.title || quizData.title.trim().length === 0) {
            errors.push('Title is required');
        }

        if (quizData.title && quizData.title.length > 255) {
            errors.push('Title must be less than 255 characters');
        }

        // Category validation
        if (quizData.category && !this.VALID_CATEGORIES.includes(quizData.category)) {
            errors.push(`Invalid category. Must be one of: ${this.VALID_CATEGORIES.join(', ')}`);
        }

        // Difficulty validation
        if (quizData.difficulty && !this.VALID_DIFFICULTIES.includes(quizData.difficulty)) {
            errors.push(`Invalid difficulty level. Must be one of: ${this.VALID_DIFFICULTIES.join(', ')}`);
        }

        // Questions validation
        if (quizData.questions && Array.isArray(quizData.questions)) {
            if (quizData.questions.length === 0) {
                errors.push('At least one question is required');
            }

            quizData.questions.forEach((q, index) => {
                if (!q.question && !q.question_text) {
                    errors.push(`Question ${index + 1}: Question text is required`);
                }

                // Question type validation
                if (q.question_type && !this.VALID_QUESTION_TYPES.includes(q.question_type)) {
                    errors.push(`Question ${index + 1}: Invalid question type. Must be one of: ${this.VALID_QUESTION_TYPES.join(', ')}`);
                }

                if (q.question_type === 'multiple_choice' || !q.question_type) {
                    if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
                        errors.push(`Question ${index + 1}: At least 2 options required for multiple choice`);
                    }

                    const correctAnswer = q.correct_answer !== undefined ? q.correct_answer : q.correctAnswer;
                    if (correctAnswer === undefined || correctAnswer < 0 || correctAnswer >= (q.options?.length || 0)) {
                        errors.push(`Question ${index + 1}: Invalid correct answer index`);
                    }
                }

                // Difficulty validation for each question
                if (q.difficulty && !this.VALID_DIFFICULTIES.includes(q.difficulty)) {
                    errors.push(`Question ${index + 1}: Invalid difficulty level`);
                }
            });

            // Business rule validations (only if basic validation passes)
            if (errors.length === 0 && enforceProgression && quizData.questions.length >= this.MIN_QUESTIONS_FOR_PROGRESSION) {
                try {
                    this.validateDifficultyProgression(quizData.questions);
                } catch (error) {
                    if (error instanceof DifficultyProgressionError) {
                        errors.push(error.message);
                    }
                }

                try {
                    this.validateQuestionTypeDistribution(quizData.questions);
                } catch (error) {
                    if (error instanceof QuestionTypeDistributionError) {
                        errors.push(error.message);
                    }
                }
            }
        }

        if (errors.length > 0) {
            throw new ValidationError('Quiz validation failed', errors);
        }
    }

    /**
     * Validate difficulty progression across question set
     * Ensures quizzes contain adequate difficulty distribution for effective assessment
     * 
     * Constraint: Quizzes with 3+ questions must include at least one question 
     * from beginner, intermediate, and advanced difficulty levels
     */
    validateDifficultyProgression(questions) {
        if (questions.length < this.MIN_QUESTIONS_FOR_PROGRESSION) {
            return; // Not enough questions to enforce progression
        }

        // Extract difficulties from questions
        const difficulties = questions
            .map(q => q.difficulty)
            .filter(d => d); // Filter out undefined/null

        if (difficulties.length === 0) {
            throw new DifficultyProgressionError(
                'Questions must have difficulty levels assigned for progression validation',
                this.VALID_DIFFICULTIES
            );
        }

        // Check for required difficulty levels
        const requiredDifficulties = ['beginner', 'intermediate', 'advanced'];
        const presentDifficulties = new Set(difficulties);
        const missingDifficulties = requiredDifficulties.filter(d => !presentDifficulties.has(d));

        if (missingDifficulties.length > 0) {
            throw new DifficultyProgressionError(
                `Quiz must include questions from all difficulty levels. Missing: ${missingDifficulties.join(', ')}`,
                missingDifficulties,
                Array.from(presentDifficulties)
            );
        }

        // Check progression order (optional enhancement)
        // Questions should generally progress from easier to harder
        const difficultyScores = {
            'beginner': 1,
            'intermediate': 2,
            'advanced': 3,
            'expert': 4
        };

        const scores = difficulties.map(d => difficultyScores[d] || 0);
        let regressions = 0;
        for (let i = 1; i < scores.length; i++) {
            if (scores[i] < scores[i - 1] - 1) { // Allow same or one level back
                regressions++;
            }
        }

        // Warn if too many regressions (more than 30% of transitions)
        if (regressions > scores.length * 0.3) {
            console.warn(`Quiz has unusual difficulty progression: ${regressions} regressions out of ${scores.length - 1} transitions`);
        }
    }

    /**
     * Validate question type distribution
     * Prevents quizzes from being dominated by a single question type
     * 
     * Business Rule: No single question type should exceed 80% of total questions
     */
    validateQuestionTypeDistribution(questions) {
        if (questions.length < 3) {
            return; // Not enough questions to enforce distribution
        }

        // Count question types
        const typeCount = {};
        questions.forEach(q => {
            const type = q.question_type || 'multiple_choice';
            typeCount[type] = (typeCount[type] || 0) + 1;
        });

        // Check if any type exceeds threshold
        const totalQuestions = questions.length;
        for (const [type, count] of Object.entries(typeCount)) {
            const percentage = count / totalQuestions;
            if (percentage > this.MAX_QUESTION_TYPE_PERCENTAGE) {
                throw new QuestionTypeDistributionError(
                    `Question type '${type}' represents ${(percentage * 100).toFixed(1)}% of questions. ` +
                    `Maximum allowed is ${this.MAX_QUESTION_TYPE_PERCENTAGE * 100}% to ensure quiz variety.`,
                    typeCount
                );
            }
        }
    }

    /**
     * Validate user quota - prevents system abuse
     * Business Rule: Users can create a maximum number of quizzes
     */
    async validateUserQuota(userId) {
        if (!userId) {
            return; // No user context, skip quota check
        }

        try {
            const userQuizCount = await this.repository.getCreatorQuizCount(userId);
            
            if (userQuizCount >= this.MAX_QUIZZES_PER_USER) {
                throw new QuizCreationLimitError(userQuizCount, this.MAX_QUIZZES_PER_USER);
            }
        } catch (error) {
            if (error instanceof QuizCreationLimitError) {
                throw error;
            }
            // If repository doesn't have getCreatorQuizCount method, log and continue
            console.warn('User quota validation skipped:', error.message);
        }
    }

    // Create a new quiz with business rule enforcement
    async createQuiz(quizData, userId = null) {
        try {
            // Step 1: Validate user quota (prevent spam/abuse)
            await this.validateUserQuota(userId);

            // Step 2: Validate quiz data structure and business rules
            this.validateQuizData(quizData);

            // Step 3: Add creator information
            if (userId) {
                quizData.created_by = userId;
            }

            // Step 4: Create quiz through repository (data layer)
            const quiz = await this.repository.createQuiz(quizData);

            // Step 5: Return structured response with essential info
            return {
                success: true,
                quiz: {
                    id: quiz.id,
                    title: quiz.title,
                    description: quiz.description,
                    category: quiz.category,
                    difficulty: quiz.difficulty,
                    questionCount: quiz.questions?.length || 0,
                    createdAt: quiz.created_at
                }
            };
        } catch (error) {
            // Re-throw custom exceptions as-is
            if (error instanceof ValidationError || 
                error instanceof QuizCreationLimitError ||
                error instanceof DifficultyProgressionError ||
                error instanceof QuestionTypeDistributionError) {
                throw error;
            }
            
            // Wrap unexpected errors in DatabaseError
            throw new DatabaseError('Failed to create quiz', error);
        }
    }

    // Get quiz by ID with proper error handling
    async getQuizById(quizId, includeAnswers = false) {
        try {
            const quiz = await this.repository.getQuizById(quizId, includeAnswers);
            
            if (!quiz) {
                throw new QuizNotFoundError(quizId);
            }

            return quiz;
        } catch (error) {
            if (error instanceof QuizNotFoundError) {
                throw error;
            }
            throw new DatabaseError('Failed to retrieve quiz', error);
        }
    }

    // Get all quizzes with optional filters
    async getAllQuizzes(filters = {}) {
        try {
            const quizzes = await this.repository.getAllQuizzes(filters);
            
            return {
                quizzes,
                total: quizzes.length,
                filters: filters
            };
        } catch (error) {
            throw new DatabaseError('Failed to retrieve quizzes', error);
        }
    }

    // Update quiz with validation
    async updateQuiz(quizId, updateData, userId = null) {
        try {
            // Validate update data
            if (updateData.title !== undefined) {
                if (!updateData.title || updateData.title.trim().length === 0) {
                    throw new ValidationError('Title cannot be empty');
                }
            }

            if (updateData.category && !this.VALID_CATEGORIES.includes(updateData.category)) {
                throw new ValidationError(`Invalid category. Must be one of: ${this.VALID_CATEGORIES.join(', ')}`);
            }

            if (updateData.difficulty && !this.VALID_DIFFICULTIES.includes(updateData.difficulty)) {
                throw new ValidationError(`Invalid difficulty level. Must be one of: ${this.VALID_DIFFICULTIES.join(', ')}`);
            }

            // If updating questions, validate them too
            if (updateData.questions) {
                this.validateQuizData({ ...updateData, title: 'temp' }, false); // Skip progression for partial updates
            }

            const quiz = await this.repository.updateQuiz(quizId, updateData);
            
            if (!quiz) {
                throw new QuizNotFoundError(quizId);
            }

            return {
                success: true,
                quiz
            };
        } catch (error) {
            if (error instanceof ValidationError || error instanceof QuizNotFoundError) {
                throw error;
            }
            throw new DatabaseError('Failed to update quiz', error);
        }
    }

    // Delete quiz with proper error handling
    async deleteQuiz(quizId, hardDelete = false) {
        try {
            const result = await this.repository.deleteQuiz(quizId, hardDelete);
            
            if (!result) {
                throw new QuizNotFoundError(quizId);
            }

            return {
                success: true,
                message: hardDelete ? 'Quiz permanently deleted' : 'Quiz deactivated',
                quizId: result.id
            };
        } catch (error) {
            if (error instanceof QuizNotFoundError) {
                throw error;
            }
            throw new DatabaseError('Failed to delete quiz', error);
        }
    }

    // Get quizzes by category with validation
    async getQuizzesByCategory(category, difficulty = null) {
        if (!this.VALID_CATEGORIES.includes(category)) {
            throw new ValidationError(`Invalid category. Must be one of: ${this.VALID_CATEGORIES.join(', ')}`);
        }

        if (difficulty && !this.VALID_DIFFICULTIES.includes(difficulty)) {
            throw new ValidationError(`Invalid difficulty level. Must be one of: ${this.VALID_DIFFICULTIES.join(', ')}`);
        }

        try {
            const quizzes = await this.repository.getQuizzesByCategory(category, difficulty);
            
            return {
                category,
                difficulty,
                quizzes,
                count: quizzes.length
            };
        } catch (error) {
            throw new DatabaseError('Failed to retrieve quizzes by category', error);
        }
    }

    // Get recent active quizzes with validation
    async getRecentQuizzes(limit = 10) {
        if (limit < 1 || limit > 100) {
            throw new ValidationError('Limit must be between 1 and 100');
        }

        try {
            const quizzes = await this.repository.getRecentActiveQuizzes(limit);
            
            return {
                quizzes,
                count: quizzes.length
            };
        } catch (error) {
            throw new DatabaseError('Failed to retrieve recent quizzes', error);
        }
    }

    // Get quiz statistics with error handling
    async getQuizStats(quizId) {
        try {
            const stats = await this.repository.getQuizStats(quizId);
            
            if (!stats) {
                throw new QuizNotFoundError(quizId);
            }

            return stats;
        } catch (error) {
            if (error instanceof QuizNotFoundError) {
                throw error;
            }
            throw new DatabaseError('Failed to retrieve quiz statistics', error);
        }
    }

    // Get quiz for taking (without answers) with state validation
    async getQuizForTaking(quizId) {
        try {
            const quiz = await this.repository.getQuizById(quizId, false);
            
            if (!quiz) {
                throw new QuizNotFoundError(quizId);
            }

            if (!quiz.is_active) {
                throw new InvalidStateError(
                    'Quiz is not available for taking',
                    'inactive',
                    'active'
                );
            }

            // Ensure answers are not included (security)
            if (quiz.questions) {
                quiz.questions = quiz.questions.map(q => ({
                    id: q.id,
                    question_text: q.question_text,
                    question_type: q.question_type,
                    options: q.options,
                    points: q.points,
                    difficulty: q.difficulty
                }));
            }

            return quiz;
        } catch (error) {
            if (error instanceof QuizNotFoundError || error instanceof InvalidStateError) {
                throw error;
            }
            throw new DatabaseError('Failed to retrieve quiz for taking', error);
        }
    }

    // Health check for service and database
    async healthCheck() {
        try {
            // Test database connection by getting recent quizzes
            await this.repository.getRecentActiveQuizzes(1);
            
            return {
                status: 'healthy',
                database: 'connected',
                cache: 'available',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = QuizService;
