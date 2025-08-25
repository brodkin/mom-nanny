// Jest setup file
const DatabaseManager = require('../services/database-manager');

// Ensure NODE_ENV is set for all tests
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Use in-memory database for tests
if (!process.env.SQLITE_DB_PATH) {
  process.env.SQLITE_DB_PATH = ':memory:';
}

// Global test teardown for database cleanup
beforeEach(async () => {
  // Reset database singleton before each test
  DatabaseManager.resetInstance();
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