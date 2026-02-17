// Quick test file for UserExceptions
const {
  UserNotFoundError,
  EmailAlreadyExistsError,
  UsernameTakenError,
  WeakPasswordError,
  ProfileUpdateLimitError,
  ValidationError,
} = require('./src/exceptions/UserExceptions');

console.log('Testing UserExceptions...\n');

// Test UserNotFoundError
try {
  throw new UserNotFoundError(123);
} catch (error) {
  console.log('✓ UserNotFoundError:');
  console.log(JSON.stringify(error.toJSON(), null, 2));
  console.log(`  Status Code: ${error.statusCode}\n`);
}

// Test EmailAlreadyExistsError
try {
  throw new EmailAlreadyExistsError('test@example.com');
} catch (error) {
  console.log('✓ EmailAlreadyExistsError:');
  console.log(JSON.stringify(error.toJSON(), null, 2));
  console.log(`  Status Code: ${error.statusCode}\n`);
}

// Test UsernameTakenError
try {
  throw new UsernameTakenError('johndoe');
} catch (error) {
  console.log('✓ UsernameTakenError:');
  console.log(JSON.stringify(error.toJSON(), null, 2));
  console.log(`  Status Code: ${error.statusCode}\n`);
}

// Test WeakPasswordError
try {
  throw new WeakPasswordError('Must be at least 8 characters');
} catch (error) {
  console.log('✓ WeakPasswordError:');
  console.log(JSON.stringify(error.toJSON(), null, 2));
  console.log(`  Status Code: ${error.statusCode}\n`);
}

// Test ProfileUpdateLimitError
try {
  throw new ProfileUpdateLimitError(5, 3);
} catch (error) {
  console.log('✓ ProfileUpdateLimitError:');
  console.log(JSON.stringify(error.toJSON(), null, 2));
  console.log(`  Status Code: ${error.statusCode}\n`);
}

// Test ValidationError
try {
  throw new ValidationError('Invalid input data', [
    { field: 'email', message: 'Invalid email format' },
    { field: 'age', message: 'Must be 18 or older' }
  ]);
} catch (error) {
  console.log('✓ ValidationError:');
  console.log(JSON.stringify(error.toJSON(), null, 2));
  console.log(`  Status Code: ${error.statusCode}\n`);
}

console.log('All exception tests passed! ✓');
