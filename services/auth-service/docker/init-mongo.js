// MongoDB initialization script
db = db.getSiblingDB('quiz_platform');

db.createCollection('users');

// Create indexes
db.users.createIndex({ "username": 1 }, { unique: true });
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "created_at": 1 });

print('✅ Database initialized with users collection and indexes');
