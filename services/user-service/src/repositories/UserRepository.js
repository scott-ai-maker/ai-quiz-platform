const { pool, getRedisClient } = require("../config/database");

class UserRepository {
  constructor() {
    this.CACHE_TTL = 3600; // 1 hour
    this.CACHE_PREFIX = "user:";
  }

  buildCacheKey(key) {
    const normalizedKey = String(key);
    if (normalizedKey.startsWith(this.CACHE_PREFIX)) {
      return normalizedKey;
    }
    return `${this.CACHE_PREFIX}${normalizedKey}`;
  }

  async invalidateCache(...keys) {
    const redisClient = getRedisClient();
    if (!redisClient || keys.length === 0) {
      return;
    }
    const normalizedKeys = keys.map((key) => this.buildCacheKey(key));
    await redisClient.del(normalizedKeys);
  }

  async getCached(key) {
    const redisClient = getRedisClient();
    if (!redisClient) {
      return null;
    }
    const cacheKey = this.buildCacheKey(key);
    const cachedValue = await redisClient.get(cacheKey);
    if (!cachedValue) {
      return null;
    }
    return JSON.parse(cachedValue);
  }

  async setCached(key, value) {
    const redisClient = getRedisClient();
    if (!redisClient) {
      return;
    }
    const cacheKey = this.buildCacheKey(key);
    await redisClient.setEx(cacheKey, this.CACHE_TTL, JSON.stringify(value));
  }

  async createUser(userData) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Fields: username, email, password_hash, full_name, bio, avatar_url
      // Return created user object
      const userQuery = `
                INSERT INTO users (username, email, password_hash, full_name, bio, avatar_url)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
                `;
      const userValues = [
        userData.username,
        userData.email,
        userData.password_hash,
        userData.full_name || null,
        userData.bio || null,
        userData.avatar_url || null,
      ];
      const res = await client.query(userQuery, userValues);
      const newUser = res.rows[0];

      await client.query("COMMIT");

      // Invalidate cache if necessary
      await this.invalidateCache(
        `${this.CACHE_PREFIX}${newUser.id}`,
        `${this.CACHE_PREFIX}email:${newUser.email}`,
        `${this.CACHE_PREFIX}username:${newUser.username}`,
      );

      return newUser;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserById(userId, useCache = true) {
    const cacheKey = `id:${userId}`;
    if (useCache) {
      const cached = await this.getCached(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const client = await pool.connect();
    try {
      const query = "SELECT * FROM users WHERE id = $1";
      const res = await client.query(query, [userId]);
      const user = res.rows[0] || null;

      if (user) {
        await this.setCached(cacheKey, user);
      }

      return user;
    } finally {
      client.release();
    }
  }

  async getUserByEmail(email, useCache = true) {
    const cacheKey = `email:${email}`;
    if (useCache) {
      const cached = await this.getCached(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const client = await pool.connect();
    try {
      const query = "SELECT * FROM users WHERE email = $1";
      const res = await client.query(query, [email]);
      const user = res.rows[0] || null;

      if (user) {
        await this.setCached(cacheKey, user);
      }

      return user;
    } finally {
      client.release();
    }
  }

  async getUserByUsername(username, useCache = true) {
    const cacheKey = `username:${username}`;
    if (useCache) {
      const cached = await this.getCached(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const client = await pool.connect();
    try {
      const query = "SELECT * FROM users WHERE username = $1";
      const res = await client.query(query, [username]);
      const user = res.rows[0] || null;

      if (user) {
        await this.setCached(cacheKey, user);
      }

      return user;
    } finally {
      client.release();
    }
  }

  async updateUser(userId, updateData) {
    const client = await pool.connect();
    try {
      // Build dynamic SET clause from updateData keys
      const keys = Object.keys(updateData).filter(
        (key) => key !== "id" && key !== "userId"
      );
      if (keys.length === 0) {
        return null;
      }

      const setClause = keys
        .map((key, index) => `${key} = $${index + 1}`)
        .join(", ");
      const values = keys.map((key) => updateData[key]);
      values.push(userId);

      const query = `
        UPDATE users
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${keys.length + 1}
        RETURNING *
      `;

      const res = await client.query(query, values);
      const updatedUser = res.rows[0] || null;

      // Invalidate relevant caches
      if (updatedUser) {
        await this.invalidateCache(
          `${this.CACHE_PREFIX}id:${userId}`,
          `${this.CACHE_PREFIX}email:${updatedUser.email}`,
          `${this.CACHE_PREFIX}username:${updatedUser.username}`
        );
      }

      return updatedUser;
    } finally {
      client.release();
    }
  }

  async getUserUpdateCountToday(userId) {
    const client = await pool.connect();
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM user_update_log
        WHERE user_id = $1
        AND DATE(updated_at) = CURRENT_DATE
      `;
      const res = await client.query(query, [userId]);
      return parseInt(res.rows[0].count, 10);
    } finally {
      client.release();
    }
  }

  async logUserUpdate(userId) {
    const client = await pool.connect();
    try {
      const query = `
        INSERT INTO user_update_log (user_id, updated_at)
        VALUES ($1, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      const res = await client.query(query, [userId]);
      return res.rows[0];
    } finally {
      client.release();
    }
  }
}

module.exports = UserRepository;
