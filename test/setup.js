// Jest setup file
const DatabaseManager = require('../services/database-manager');
const fs = require('fs');

// Ensure NODE_ENV is set for all tests
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Use test database path
if (!process.env.SQLITE_DB_PATH) {
  process.env.SQLITE_DB_PATH = './test/test-conversations.db';
}

// Create test database directory if it doesn't exist
const testDbDir = './test';
if (!fs.existsSync(testDbDir)) {
  fs.mkdirSync(testDbDir, { recursive: true });
}

// Global test teardown for database cleanup
beforeEach(async () => {
  // Reset database singleton before each test
  DatabaseManager.resetInstance();
  
  // Clean up test database file to ensure fresh state
  const testDbPath = './test/test-conversations.db';
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch (error) {
      // Ignore errors - database might be in use
    }
  }
});

afterEach(async () => {
  // Reset database singleton after each test
  DatabaseManager.resetInstance();
  
  // Add a small delay to allow database connections to close
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Suppress console output during tests unless specifically needed
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});