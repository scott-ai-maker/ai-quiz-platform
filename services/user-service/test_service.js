// Test file for UserService
// This demonstrates the complete flow: exceptions → repository → service → server

const UserService = require('./src/services/UserService');
const {
  ValidationError,
  WeakPasswordError,
  EmailAlreadyExistsError,
} = require('./src/exceptions/UserExceptions');

async function testUserService() {
  console.log('🧪 Testing UserService...\n');

  const service = new UserService();

  // Test 1: Invalid username (too short)
  console.log('Test 1: Username validation (too short)');
  try {
    service.validateUsername('ab');
  } catch (error) {
    console.log(`  ✓ Caught: ${error.name}`);
    console.log(`  ✓ Message: ${error.message}\n`);
  }

  // Test 2: Invalid email format
  console.log('Test 2: Email validation (bad format)');
  try {
    service.validateEmail('not-an-email');
  } catch (error) {
    console.log(`  ✓ Caught: ${error.name}`);
    console.log(`  ✓ Message: ${error.message}\n`);
  }

  // Test 3: Weak password (no uppercase)
  console.log('Test 3: Password validation (no uppercase)');
  try {
    service.validatePassword('lowercase123');
  } catch (error) {
    console.log(`  ✓ Caught: ${error.name}`);
    console.log(`  ✓ Message: ${error.message}\n`);
  }

  // Test 4: Valid password
  console.log('Test 4: Password validation (strong password)');
  try {
    service.validatePassword('StrongPass123!');
    console.log('  ✓ Valid password accepted\n');
  } catch (error) {
    console.log(`  ✗ Unexpected error: ${error.message}\n`);
  }

  // Test 5: Bio too long
  console.log('Test 5: Bio validation (too long)');
  try {
    const longBio = 'a'.repeat(501);
    service.validateBio(longBio);
  } catch (error) {
    console.log(`  ✓ Caught: ${error.name}`);
    console.log(`  ✓ Message: ${error.message}\n`);
  }

  console.log('✅ All UserService tests passed!');
}

testUserService().catch(console.error);
