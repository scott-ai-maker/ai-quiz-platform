// Database Configuration
const { Pool } = require('pg');
const redis = require('redis');
require('dotenv').config();

// PostgreSQL Pool Configuration
const pgConfig = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'quiz_db',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    max: 20, // Maximum number of connections in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

// Create PostgreSQL connection pool
const pool = new Pool(pgConfig);

// Pool event handlers
pool.on('connect', () => {
    console.log('📊 Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected PostgreSQL error:', err);
    process.exit(-1);
});

// Redis Client Configuration
const redisConfig = {
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
    },
    password: process.env.REDIS_PASSWORD || undefined,
};

let redisClient = null;

// Initialize Redis connection
async function initializeRedis() {
    if (!redisClient) {
        redisClient = redis.createClient(redisConfig);
        
        redisClient.on('error', (err) => {
            console.error('❌ Redis Client Error:', err);
        });
        
        redisClient.on('connect', () => {
            console.log('🔴 Connected to Redis cache');
        });
        
        await redisClient.connect();
    }
    return redisClient;
}

// Database initialization function
async function initializeDatabase() {
    try {
        // Test PostgreSQL connection
        const client = await pool.connect();
        console.log('✅ PostgreSQL connection pool ready');
        
        // Run migrations (create tables if they don't exist)
        await runMigrations(client);
        
        client.release();
        
        // Initialize Redis
        await initializeRedis();
        
        console.log('✅ Database initialization complete');
        return true;
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    }
}

// Database migrations
async function runMigrations(client) {
    try {
        // Create quizzes table with optimized indexes
        await client.query(`
            CREATE TABLE IF NOT EXISTS quizzes (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                category VARCHAR(100) DEFAULT 'general',
                difficulty VARCHAR(50) DEFAULT 'intermediate',
                is_active BOOLEAN DEFAULT true,
                created_by VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create questions table
        await client.query(`
            CREATE TABLE IF NOT EXISTS questions (
                id SERIAL PRIMARY KEY,
                quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
                question_text TEXT NOT NULL,
                question_type VARCHAR(50) DEFAULT 'multiple_choice',
                options JSONB,
                correct_answer INTEGER,
                points INTEGER DEFAULT 1,
                order_index INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create composite indexes for optimized query performance
        // idx_quiz_category_difficulty: Optimizes category-filtered queries
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_quiz_category_difficulty 
            ON quizzes(category, difficulty)
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_quiz_active_created 
            ON quizzes(is_active, created_at DESC)
        `);
        
        // Create index for questions by quiz_id
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_questions_quiz_id 
            ON questions(quiz_id, order_index)
        `);
        
        console.log('✅ Database migrations completed');
    } catch (error) {
        console.error('❌ Migration error:', error);
        throw error;
    }
}

// Graceful shutdown
async function closeDatabase() {
    try {
        await pool.end();
        if (redisClient) {
            await redisClient.quit();
        }
        console.log('👋 Database connections closed');
    } catch (error) {
        console.error('❌ Error closing database:', error);
    }
}

module.exports = {
    pool,
    getRedisClient: () => redisClient,
    initializeDatabase,
    initializeRedis,
    closeDatabase,
};
