// Quiz Repository - Implements the Repository Pattern
// This layer handles all data access logic, caching, and database operations

const { pool, getRedisClient } = require('../config/database');

class QuizRepository {
    constructor() {
        this.CACHE_TTL = 3600; // 1 hour cache TTL
        this.CACHE_PREFIX = 'quiz:';
    }

    // Helper: Get cache key
    getCacheKey(key) {
        return `${this.CACHE_PREFIX}${key}`;
    }

    // Helper: Cache get with JSON parsing
    async getCached(key) {
        try {
            const redis = getRedisClient();
            if (!redis) return null;
            
            const cached = await redis.get(this.getCacheKey(key));
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }

    // Helper: Cache set with JSON stringification
    async setCached(key, value, ttl = this.CACHE_TTL) {
        try {
            const redis = getRedisClient();
            if (!redis) return false;
            
            await redis.setEx(
                this.getCacheKey(key),
                ttl,
                JSON.stringify(value)
            );
            return true;
        } catch (error) {
            console.error('Cache set error:', error);
            return false;
        }
    }

    // Helper: Cache invalidation
    async invalidateCache(pattern) {
        try {
            const redis = getRedisClient();
            if (!redis) return;
            
            const keys = await redis.keys(this.getCacheKey(pattern));
            if (keys.length > 0) {
                await redis.del(keys);
            }
        } catch (error) {
            console.error('Cache invalidation error:', error);
        }
    }

    // Create a new quiz with questions
    async createQuiz(quizData) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Insert quiz
            const quizQuery = `
                INSERT INTO quizzes (title, description, category, difficulty, created_by)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `;
            const quizValues = [
                quizData.title,
                quizData.description || '',
                quizData.category || 'general',
                quizData.difficulty || 'intermediate',
                quizData.created_by || 'system'
            ];
            const quizResult = await client.query(quizQuery, quizValues);
            const quiz = quizResult.rows[0];

            // Insert questions if provided
            if (quizData.questions && quizData.questions.length > 0) {
                const questionQuery = `
                    INSERT INTO questions (quiz_id, question_text, question_type, options, correct_answer, points, order_index)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING *
                `;

                const questions = [];
                for (let i = 0; i < quizData.questions.length; i++) {
                    const q = quizData.questions[i];
                    const questionValues = [
                        quiz.id,
                        q.question || q.question_text,
                        q.question_type || 'multiple_choice',
                        JSON.stringify(q.options || []),
                        q.correct_answer || q.correctAnswer || 0,
                        q.points || 1,
                        q.order_index || i
                    ];
                    const questionResult = await client.query(questionQuery, questionValues);
                    questions.push(questionResult.rows[0]);
                }
                quiz.questions = questions;
            }

            await client.query('COMMIT');

            // Invalidate cache
            await this.invalidateCache('*');

            return quiz;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Get quiz by ID with questions (cached)
    async getQuizById(quizId, includeAnswers = false) {
        // Check cache first
        const cacheKey = `id:${quizId}:answers:${includeAnswers}`;
        const cached = await this.getCached(cacheKey);
        if (cached) {
            return cached;
        }

        // Query database
        const client = await pool.connect();
        try {
            // Get quiz
            const quizQuery = 'SELECT * FROM quizzes WHERE id = $1';
            const quizResult = await client.query(quizQuery, [quizId]);
            
            if (quizResult.rows.length === 0) {
                return null;
            }

            const quiz = quizResult.rows[0];

            // Get questions
            const questionQuery = `
                SELECT id, quiz_id, question_text, question_type, options, 
                       ${includeAnswers ? 'correct_answer,' : ''} points, order_index
                FROM questions
                WHERE quiz_id = $1
                ORDER BY order_index ASC
            `;
            const questionResult = await client.query(questionQuery, [quizId]);
            
            // Parse JSON options
            quiz.questions = questionResult.rows.map(q => ({
                ...q,
                options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options
            }));

            // Cache the result
            await this.setCached(cacheKey, quiz);

            return quiz;
        } finally {
            client.release();
        }
    }

    // Get all quizzes with filters (cached)
    async getAllQuizzes(filters = {}) {
        const { category, difficulty, is_active = true, limit = 50, offset = 0 } = filters;

        // Build cache key from filters
        const cacheKey = `all:${JSON.stringify(filters)}`;
        const cached = await this.getCached(cacheKey);
        if (cached) {
            return cached;
        }

        // Build dynamic query
        const conditions = [];
        const values = [];
        let paramIndex = 1;

        if (is_active !== undefined) {
            conditions.push(`is_active = $${paramIndex++}`);
            values.push(is_active);
        }

        if (category) {
            conditions.push(`category = $${paramIndex++}`);
            values.push(category);
        }

        if (difficulty) {
            conditions.push(`difficulty = $${paramIndex++}`);
            values.push(difficulty);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        
        const query = `
            SELECT q.*, COUNT(qu.id) as question_count
            FROM quizzes q
            LEFT JOIN questions qu ON q.id = qu.quiz_id
            ${whereClause}
            GROUP BY q.id
            ORDER BY q.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `;
        
        values.push(limit, offset);

        const client = await pool.connect();
        try {
            const result = await client.query(query, values);
            const quizzes = result.rows;

            // Cache the result
            await this.setCached(cacheKey, quizzes, 1800); // 30 minutes for list

            return quizzes;
        } finally {
            client.release();
        }
    }

    // Update quiz
    async updateQuiz(quizId, updateData) {
        const client = await pool.connect();
        try {
            const fields = [];
            const values = [];
            let paramIndex = 1;

            // Build dynamic update query
            const allowedFields = ['title', 'description', 'category', 'difficulty', 'is_active'];
            for (const field of allowedFields) {
                if (updateData[field] !== undefined) {
                    fields.push(`${field} = $${paramIndex++}`);
                    values.push(updateData[field]);
                }
            }

            if (fields.length === 0) {
                throw new Error('No valid fields to update');
            }

            fields.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(quizId);

            const query = `
                UPDATE quizzes
                SET ${fields.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING *
            `;

            const result = await client.query(query, values);

            // Invalidate cache for this quiz
            await this.invalidateCache(`id:${quizId}*`);
            await this.invalidateCache('all:*');

            return result.rows[0];
        } finally {
            client.release();
        }
    }

    // Delete quiz (soft delete by setting is_active = false)
    async deleteQuiz(quizId, hardDelete = false) {
        const client = await pool.connect();
        try {
            let query;
            if (hardDelete) {
                // Hard delete - CASCADE will delete questions too
                query = 'DELETE FROM quizzes WHERE id = $1 RETURNING id';
            } else {
                // Soft delete
                query = 'UPDATE quizzes SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *';
            }

            const result = await client.query(query, [quizId]);

            // Invalidate cache
            await this.invalidateCache(`id:${quizId}*`);
            await this.invalidateCache('all:*');

            return result.rows[0];
        } finally {
            client.release();
        }
    }

    // Get quizzes by category (optimized with composite index)
    async getQuizzesByCategory(category, difficulty = null) {
        const cacheKey = `category:${category}:diff:${difficulty || 'all'}`;
        const cached = await this.getCached(cacheKey);
        if (cached) {
            return cached;
        }

        // This query uses the idx_quiz_category_difficulty composite index
        const client = await pool.connect();
        try {
            let query, values;
            if (difficulty) {
                query = `
                    SELECT q.*, COUNT(qu.id) as question_count
                    FROM quizzes q
                    LEFT JOIN questions qu ON q.id = qu.quiz_id
                    WHERE q.category = $1 AND q.difficulty = $2 AND q.is_active = true
                    GROUP BY q.id
                    ORDER BY q.created_at DESC
                `;
                values = [category, difficulty];
            } else {
                query = `
                    SELECT q.*, COUNT(qu.id) as question_count
                    FROM quizzes q
                    LEFT JOIN questions qu ON q.id = qu.quiz_id
                    WHERE q.category = $1 AND q.is_active = true
                    GROUP BY q.id
                    ORDER BY q.created_at DESC
                `;
                values = [category];
            }

            const result = await client.query(query, values);
            const quizzes = result.rows;

            // Cache the result
            await this.setCached(cacheKey, quizzes, 1800);

            return quizzes;
        } finally {
            client.release();
        }
    }

    // Get recent active quizzes (optimized with composite index)
    async getRecentActiveQuizzes(limit = 10) {
        const cacheKey = `recent:${limit}`;
        const cached = await this.getCached(cacheKey);
        if (cached) {
            return cached;
        }

        // This query uses the idx_quiz_active_created composite index
        const client = await pool.connect();
        try {
            const query = `
                SELECT q.*, COUNT(qu.id) as question_count
                FROM quizzes q
                LEFT JOIN questions qu ON q.id = qu.quiz_id
                WHERE q.is_active = true
                GROUP BY q.id
                ORDER BY q.created_at DESC
                LIMIT $1
            `;

            const result = await client.query(query, [limit]);
            const quizzes = result.rows;

            // Cache the result
            await this.setCached(cacheKey, quizzes, 300); // 5 minutes for recent

            return quizzes;
        } finally {
            client.release();
        }
    }

    // Get quiz statistics
    async getQuizStats(quizId) {
        const cacheKey = `stats:${quizId}`;
        const cached = await this.getCached(cacheKey);
        if (cached) {
            return cached;
        }

        const client = await pool.connect();
        try {
            const query = `
                SELECT 
                    q.id,
                    q.title,
                    q.category,
                    q.difficulty,
                    COUNT(qu.id) as total_questions,
                    SUM(qu.points) as total_points,
                    q.created_at
                FROM quizzes q
                LEFT JOIN questions qu ON q.id = qu.quiz_id
                WHERE q.id = $1
                GROUP BY q.id
            `;

            const result = await client.query(query, [quizId]);
            const stats = result.rows[0];

            if (stats) {
                // Cache the result
                await this.setCached(cacheKey, stats, 3600);
            }

            return stats;
        } finally {
            client.release();
        }
    }
}

module.exports = QuizRepository;
