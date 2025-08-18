module.exports = {
  // Use different test environments based on test name pattern
  projects: [
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: ['**/test/**/*.test.js'],
      testPathIgnorePatterns: ['<rootDir>/test/modal-viewport.test.js'],
      setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
      globalSetup: '<rootDir>/test/jest-global-setup.js',
      globalTeardown: '<rootDir>/test/jest-global-teardown.js',
      maxWorkers: 1
    },
    {
      displayName: 'dom',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/test/modal-viewport.test.js']
    }
  ],
  collectCoverageFrom: [
    'services/**/*.js',
    'functions/**/*.js',
    'routes/**/*.js',
    'admin/**/*.{js,css}',
    '!**/node_modules/**',
    '!**/test/**'
  ],
  verbose: true
};