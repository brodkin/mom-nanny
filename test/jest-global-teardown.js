const fs = require('fs');
const path = require('path');

module.exports = async () => {
  // Clean up test database
  const testDbPath = './test/test-conversations.db';
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
      console.log('Jest global teardown: Test database cleaned up');
    } catch (error) {
      console.warn('Jest global teardown: Could not remove test database:', error.message);
    }
  }
};