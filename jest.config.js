module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  collectCoverageFrom: [
    'services/**/*.js',
    'functions/**/*.js',
    'routes/**/*.js',
    '!**/node_modules/**',
    '!**/test/**'
  ],
  testMatch: ['**/test/**/*.test.js'],
  verbose: true,
  // Set NODE_ENV to test for all Jest runs
  globalSetup: '<rootDir>/test/jest-global-setup.js',
  globalTeardown: '<rootDir>/test/jest-global-teardown.js',
  // Run tests serially to avoid database conflicts
  maxWorkers: 1,
  // Increase timeout for database operations
  testTimeout: 10000
};