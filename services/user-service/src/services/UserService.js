const bcrypt = require('bcrypt');
const UserRepository = require('../repositories/UserRepository');
const {
  UserNotFoundError,
  EmailAlreadyExistsError,
  UsernameTakenError,
  WeakPasswordError,
  ProfileUpdateLimitError,
  ValidationError,
} = require('../exceptions/UserExceptions');

class UserService {
  constructor() {
    this.repository = new UserRepository();

    // Business rule constants
    this.MIN_USERNAME_LENGTH = 3;
    this.MAX_USERNAME_LENGTH = 50;
    this.MIN_PASSWORD_LENGTH = 8;
    this.MAX_PROFILE_UPDATES_PER_DAY = 10;
    this.MAX_BIO_LENGTH = 500;
    this.BCRYPT_ROUNDS = 10;
  }

  // ========== Validation Methods ==========

  validateUsername(username) {
    if (!username || typeof username !== 'string') {
      throw new ValidationError('Username must be a non-empty string');
    }

    if (username.length < this.MIN_USERNAME_LENGTH) {
      throw new ValidationError(
        `Username must be at least ${this.MIN_USERNAME_LENGTH} characters`
      );
    }

    if (username.length > this.MAX_USERNAME_LENGTH) {
      throw new ValidationError(
        `Username must not exceed ${this.MAX_USERNAME_LENGTH} characters`
      );
    }

    // Only alphanumeric and underscore allowed
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      throw new ValidationError(
        'Username can only contain letters, numbers, and underscores'
      );
    }
  }

  validateEmail(email) {
    if (!email || typeof email !== 'string') {
      throw new ValidationError('Email must be a non-empty string');
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format');
    }
  }

  validatePassword(password) {
    if (!password || typeof password !== 'string') {
      throw new WeakPasswordError('Password must be a non-empty string');
    }

    if (password.length < this.MIN_PASSWORD_LENGTH) {
      throw new WeakPasswordError(
        `Password must be at least ${this.MIN_PASSWORD_LENGTH} characters`
      );
    }

    if (!/[A-Z]/.test(password)) {
      throw new WeakPasswordError('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      throw new WeakPasswordError('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      throw new WeakPasswordError('Password must contain at least one number');
    }
  }

  validateBio(bio) {
    if (!bio) {
      return; // Bio is optional
    }

    if (typeof bio !== 'string') {
      throw new ValidationError('Bio must be a string');
    }

    if (bio.length > this.MAX_BIO_LENGTH) {
      throw new ValidationError(`Bio must not exceed ${this.MAX_BIO_LENGTH} characters`);
    }
  }

  async validateUniqueEmail(email) {
    const existing = await this.repository.getUserByEmail(email, false);
    if (existing) {
      throw new EmailAlreadyExistsError(email);
    }
  }

  async validateUniqueUsername(username) {
    const existing = await this.repository.getUserByUsername(username, false);
    if (existing) {
      throw new UsernameTakenError(username);
    }
  }

  async validateUpdateQuota(userId) {
    const updateCount = await this.repository.getUserUpdateCountToday(userId);
    if (updateCount >= this.MAX_PROFILE_UPDATES_PER_DAY) {
      throw new ProfileUpdateLimitError(updateCount, this.MAX_PROFILE_UPDATES_PER_DAY);
    }
  }

  // ========== Business Operations ==========

  async createUser(userData) {
    // Validate input fields
    this.validateUsername(userData.username);
    this.validateEmail(userData.email);
    this.validatePassword(userData.password);
    this.validateBio(userData.bio);

    // Check uniqueness constraints
    await this.validateUniqueEmail(userData.email);
    await this.validateUniqueUsername(userData.username);

    // Hash password
    const passwordHash = await bcrypt.hash(userData.password, this.BCRYPT_ROUNDS);

    // Create user in database
    const createdUser = await this.repository.createUser({
      username: userData.username,
      email: userData.email,
      password_hash: passwordHash,
      full_name: userData.full_name || null,
      bio: userData.bio || null,
      avatar_url: userData.avatar_url || null,
    });

    // Return user without password hash
    return this.formatUserResponse(createdUser);
  }

  async getUserProfile(userId) {
    const user = await this.repository.getUserById(userId);

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    return this.formatUserResponse(user);
  }

  async updateProfile(userId, updateData) {
    // Validate that user exists first
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    // Check update quota
    await this.validateUpdateQuota(userId);

    // Validate fields if present
    if (updateData.bio !== undefined) {
      this.validateBio(updateData.bio);
    }

    if (updateData.full_name !== undefined && updateData.full_name !== null) {
      if (typeof updateData.full_name !== 'string') {
        throw new ValidationError('Full name must be a string');
      }
    }

    // Build update data (exclude sensitive fields)
    const allowedFields = ['full_name', 'bio', 'avatar_url'];
    const updatePayload = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updatePayload[field] = updateData[field];
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    // Perform update
    const updatedUser = await this.repository.updateUser(userId, updatePayload);

    // Log the update for quota tracking
    await this.repository.logUserUpdate(userId);

    return this.formatUserResponse(updatedUser);
  }

  async searchUsers(query, limit = 10) {
    if (!query || typeof query !== 'string') {
      throw new ValidationError('Search query must be a non-empty string');
    }

    if (query.length < 2) {
      throw new ValidationError('Search query must be at least 2 characters');
    }

    if (limit < 1 || limit > 100) {
      throw new ValidationError('Limit must be between 1 and 100');
    }

    // Search by username
    const user = await this.repository.getUserByUsername(query);
    if (user) {
      return [this.formatUserResponse(user)];
    }

    return [];
  }

  // ========== Helper Methods ==========

  formatUserResponse(user) {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      bio: user.bio,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}

module.exports = UserService;
