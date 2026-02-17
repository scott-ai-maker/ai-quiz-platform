// User not found exception
class UserNotFoundError extends Error {
  constructor(userId) {
    super(`User with ID ${userId} not found`);
    this.name = "UserNotFoundError";
    this.errorCode = "USER_NOT_FOUND";
    this.statusCode = 404;
    this.userId = userId;
    Error.captureStackTrace(this, this.constructor);
  }
  toJSON() {
    return {
      userId: this.userId,
      error: this.name,
      message: this.message,
      errorCode: this.errorCode,
      statusCode: this.statusCode,
    };
  }
}

// Email already exists exception
class EmailAlreadyExistsError extends Error {
  constructor(email) {
    super("Email already exists: " + email);
    this.name = "EmailAlreadyExistsError";
    this.errorCode = "EMAIL_ALREADY_EXISTS";
    this.statusCode = 409;
    this.email = email;
    Error.captureStackTrace(this, this.constructor);
  }
  toJSON() {
    return {
      email: this.email,
      error: this.name,
      message: this.message,
      errorCode: this.errorCode,
      statusCode: this.statusCode,
    };
  }
}

// Username already taken exception
class UsernameTakenError extends Error {
  constructor(username) {
    super("Username already taken: " + username);
    this.name = "UsernameTakenError";
    this.errorCode = "USERNAME_TAKEN";
    this.statusCode = 409;
    this.username = username;
    Error.captureStackTrace(this, this.constructor);
  }
  toJSON() {
    return {
      username: this.username,
      error: this.name,
      message: this.message,
      errorCode: this.errorCode,
      statusCode: this.statusCode,
    };
  }
}

// Invalid password (400 Bad Request)
class WeakPasswordError extends Error {
  constructor(reason) {
    super("Weak password: " + reason);
    this.name = "WeakPasswordError";
    this.errorCode = "WEAK_PASSWORD";
    this.statusCode = 400;
    this.reason = reason;
    Error.captureStackTrace(this, this.constructor);
  }
  toJSON() {
    return {
      reason: this.reason,
      error: this.name,
      message: this.message,
      errorCode: this.errorCode,
      statusCode: this.statusCode,
    };
  }
}

// Profile update limit exceeded (429 Too Many Requests)
class ProfileUpdateLimitError extends Error {
  constructor(todayCount, maxAllowed) {
    super(
      "Profile update limit exceeded. You have updated your profile " +
        todayCount +
        " times today, maximum allowed is " +
        maxAllowed,
    );
    this.name = "ProfileUpdateLimitError";
    this.errorCode = "PROFILE_UPDATE_LIMIT_EXCEEDED";
    this.statusCode = 429;
    this.todayCount = todayCount;
    this.maxAllowed = maxAllowed;
    Error.captureStackTrace(this, this.constructor);
  }
  toJSON() {
    return {
      todayCount: this.todayCount,
      maxAllowed: this.maxAllowed,
      error: this.name,
      message: this.message,
      errorCode: this.errorCode,
      statusCode: this.statusCode,
    };
  }
}

// Base validation error (400)
class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = "ValidationError";
    this.errorCode = "VALIDATION_ERROR";
    this.statusCode = 400;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
  toJSON() {
    return {
      errors: this.errors,
      error: this.name,
      message: this.message,
      errorCode: this.errorCode,
      statusCode: this.statusCode,
    };
  }
}

module.exports = {
  UserNotFoundError,
  EmailAlreadyExistsError,
  UsernameTakenError,
  WeakPasswordError,
  ProfileUpdateLimitError,
  ValidationError,
};
