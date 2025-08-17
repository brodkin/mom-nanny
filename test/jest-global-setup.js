module.exports = async () => {
  // Set NODE_ENV to test to prevent app.js from starting a server
  process.env.NODE_ENV = 'test';
  
  // Set a unique test database path
  process.env.SQLITE_DB_PATH = './test/test-conversations.db';
  
  console.log('Jest global setup: NODE_ENV set to test, test database configured');
};