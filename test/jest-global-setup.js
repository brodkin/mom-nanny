module.exports = async () => {
  // Set NODE_ENV to test to prevent app.js from starting a server
  process.env.NODE_ENV = 'test';
  
  // Use in-memory database for all tests
  process.env.SQLITE_DB_PATH = ':memory:';
  
  console.log('Jest global setup: NODE_ENV set to test, in-memory database configured');
};