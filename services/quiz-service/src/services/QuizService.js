// Quiz Service Layer - Business Logic
// This layer sits between the API and Repository, handling business rules and validation

const QuizRepository = require('../repositories/QuizRepository');

class QuizService {
    constructor() {
        this.repository = new QuizRepository();
    }

    // Validate quiz data
    validateQuizData(quizData) {
        const errors = [];

        if (!quizData.title || quizData.title.trim().length === 0) {
            errors.push('Title is required');
        }

        if (quizData.title && quizData.title.length > 255) {
            errors.push('Title must be less than 255 characters');
        }

        if (quizData.category && !['general', 'programming', 'science', 'math', 'history', 'other'].includes(quizData.category)) {
            errors.push('Invalid category');
        }

        if (quizData.difficulty && !['beginner', 'intermediate', 'advanced', 'expert'].includes(quizData.difficulty)) {
            errors.push('Invalid difficulty level');
        }

        if (quizData.questions && Array.isArray(quizData.questions)) {
            if (quizData.questions.length === 0) {
                errors.push('At least one question is required');
            }

            quizData.questions.forEach((q, index) => {
                if (!q.question && !q.question_text) {
                    errors.push(`Question ${index + 1}: Question text is required`);
                }

                if (q.question_type === 'multiple_choice' || !q.question_type) {
                    if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
                        errors.push(`Question ${index + 1}: At least 2 options required`);
                    }

                    const correctAnswer = q.correct_answer !== undefined ? q.correct_answer : q.correctAnswer;
                    if (correctAnswer === undefined || correctAnswer < 0 || correctAnswer >= (q.options?.length || 0)) {
                        errors.push(`Question ${index + 1}: Invalid correct answer index`);
                    }
                }
            });
        }

        return errors;
    }

    // Create a new quiz
    async createQuiz(quizData, userId = null) {
        // Validate quiz data
        const validationErrors = this.validateQuizData(quizData);
        if (validationErrors.length > 0) {
            throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
        }

        // Add creator information
        if (userId) {
            quizData.created_by = userId;
        }

        // Create quiz through repository
        const quiz = await this.repository.createQuiz(quizData);

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
    }

    // Get quiz by ID
    async getQuizById(quizId, includeAnswers = false) {
        const quiz = await this.repository.getQuizById(quizId, includeAnswers);
        
        if (!quiz) {
            throw new Error('Quiz not found');
        }

        return quiz;
    }

    // Get all quizzes with optional filters
    async getAllQuizzes(filters = {}) {
        const quizzes = await this.repository.getAllQuizzes(filters);
        
        return {
            quizzes,
            total: quizzes.length,
            filters: filters
        };
    }

    // Update quiz
    async updateQuiz(quizId, updateData, userId = null) {
        // Validate update data
        if (updateData.title !== undefined) {
            if (!updateData.title || updateData.title.trim().length === 0) {
                throw new Error('Title cannot be empty');
            }
        }

        if (updateData.category && !['general', 'programming', 'science', 'math', 'history', 'other'].includes(updateData.category)) {
            throw new Error('Invalid category');
        }

        if (updateData.difficulty && !['beginner', 'intermediate', 'advanced', 'expert'].includes(updateData.difficulty)) {
            throw new Error('Invalid difficulty level');
        }

        const quiz = await this.repository.updateQuiz(quizId, updateData);
        
        if (!quiz) {
            throw new Error('Quiz not found');
        }

        return {
            success: true,
            quiz
        };
    }

    // Delete quiz
    async deleteQuiz(quizId, hardDelete = false) {
        const result = await this.repository.deleteQuiz(quizId, hardDelete);
        
        if (!result) {
            throw new Error('Quiz not found');
        }

        return {
            success: true,
            message: hardDelete ? 'Quiz permanently deleted' : 'Quiz deactivated',
            quizId: result.id
        };
    }

    // Get quizzes by category
    async getQuizzesByCategory(category, difficulty = null) {
        const validCategories = ['general', 'programming', 'science', 'math', 'history', 'other'];
        if (!validCategories.includes(category)) {
            throw new Error('Invalid category');
        }

        if (difficulty) {
            const validDifficulties = ['beginner', 'intermediate', 'advanced', 'expert'];
            if (!validDifficulties.includes(difficulty)) {
                throw new Error('Invalid difficulty level');
            }
        }

        const quizzes = await this.repository.getQuizzesByCategory(category, difficulty);
        
        return {
            category,
            difficulty,
            quizzes,
            count: quizzes.length
        };
    }

    // Get recent active quizzes
    async getRecentQuizzes(limit = 10) {
        if (limit < 1 || limit > 100) {
            throw new Error('Limit must be between 1 and 100');
        }

        const quizzes = await this.repository.getRecentActiveQuizzes(limit);
        
        return {
            quizzes,
            count: quizzes.length
        };
    }

    // Get quiz statistics
    async getQuizStats(quizId) {
        const stats = await this.repository.getQuizStats(quizId);
        
        if (!stats) {
            throw new Error('Quiz not found');
        }

        return stats;
    }

    // Get quiz for taking (without answers)
    async getQuizForTaking(quizId) {
        const quiz = await this.repository.getQuizById(quizId, false);
        
        if (!quiz) {
            throw new Error('Quiz not found');
        }

        if (!quiz.is_active) {
            throw new Error('Quiz is not available');
        }

        // Ensure answers are not included
        if (quiz.questions) {
            quiz.questions = quiz.questions.map(q => ({
                id: q.id,
                question_text: q.question_text,
                question_type: q.question_type,
                options: q.options,
                points: q.points
            }));
        }

        return quiz;
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
