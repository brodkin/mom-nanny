const DatabaseManager = require('../services/database-manager');
const fs = require('fs');
const path = require('path');

describe('DatabaseManager Regression Tests', () => {
  let dbManager;
  const testDbPath = './test-regression.db';

  beforeEach(async () => {
    // Clean up any existing test database files
    [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`].forEach(file => {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch (err) {
          // Ignore errors - file might be in use
        }
      }
    });
    
    // Reset singleton to ensure clean state
    DatabaseManager.resetInstance();
    
    dbManager = new DatabaseManager(testDbPath);
    await dbManager.waitForInitialization();
  });

  afterEach(async () => {
    if (dbManager) {
      await dbManager.close();
    }
    
    // Clean up test database files
    [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`].forEach(file => {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch (err) {
          // Ignore errors
        }
      }
    });
    
    // Reset singleton after test
    DatabaseManager.resetInstance();
  });

  describe('singleton isolation', () => {
    test('should not interfere with direct instantiation', async () => {
      // This test verifies that direct instantiation doesn't interfere with singleton
      const directInstance = new DatabaseManager('./test-direct-isolation.db');
      await directInstance.waitForInitialization();
      
      // Get singleton instance
      const singletonInstance = DatabaseManager.getInstance('./test-singleton-isolation.db');
      await singletonInstance.waitForInitialization();
      
      // Verify they are different instances with different paths (now absolute)
      expect(directInstance).not.toBe(singletonInstance);
      expect(directInstance.dbPath).toBe(path.resolve(__dirname, '..', 'test-direct-isolation.db'));
      expect(singletonInstance.dbPath).toBe(path.resolve(__dirname, '..', 'test-singleton-isolation.db'));
      
      // Verify both work independently
      const directResult = await directInstance.query('SELECT COUNT(*) as count FROM conversations');
      const singletonResult = await singletonInstance.query('SELECT COUNT(*) as count FROM conversations');
      
      expect(directResult).toEqual([{ count: 0 }]);
      expect(singletonResult).toEqual([{ count: 0 }]);
      
      // Clean up
      await directInstance.close();
      await singletonInstance.close();
      
      // Remove test files
      if (fs.existsSync('./test-direct-isolation.db')) {
        fs.unlinkSync('./test-direct-isolation.db');
      }
      if (fs.existsSync('./test-singleton-isolation.db')) {
        fs.unlinkSync('./test-singleton-isolation.db');
      }
    });

    test('should handle singleton reset properly', async () => {
      // Create singleton instance
      const instance1 = DatabaseManager.getInstance('./test-reset.db');
      await instance1.waitForInitialization();
      
      // Reset singleton
      DatabaseManager.resetInstance();
      
      // Create new singleton instance
      const instance2 = DatabaseManager.getInstance('./test-reset2.db');
      await instance2.waitForInitialization();
      
      // Verify they are different instances (paths now absolute)
      expect(instance1).not.toBe(instance2);
      expect(instance1.dbPath).toBe(path.resolve(__dirname, '..', 'test-reset.db'));
      expect(instance2.dbPath).toBe(path.resolve(__dirname, '..', 'test-reset2.db'));
      
      // Clean up
      await instance2.close();
      
      // Remove test files
      if (fs.existsSync('./test-reset.db')) {
        fs.unlinkSync('./test-reset.db');
      }
      if (fs.existsSync('./test-reset2.db')) {
        fs.unlinkSync('./test-reset2.db');
      }
    });
  });

  describe('migration consistency', () => {
    test('should always reach migration version 4', async () => {
      // Test multiple database creations to ensure consistent migration
      for (let i = 0; i < 5; i++) {
        const testPath = `./test-migration-${i}.db`;
        const db = new DatabaseManager(testPath);
        await db.waitForInitialization();
        
        const version = await db.getCurrentMigrationVersion();
        expect(version).toBe(5);
        
        const tables = await db.getTables();
        expect(tables).toEqual(
          expect.arrayContaining([
            'conversations',
            'summaries', 
            'messages',
            'analytics',
            'memories',
            'settings',
            'emotional_metrics'
          ])
        );
        
        await db.close();
        
        // Clean up
        if (fs.existsSync(testPath)) {
          fs.unlinkSync(testPath);
        }
      }
    });

    test('should handle rapid initialization correctly', async () => {
      // Test rapid database creation and initialization
      const promises = [];
      const instances = [];
      
      for (let i = 0; i < 3; i++) {
        const db = new DatabaseManager(`./test-rapid-${i}.db`);
        instances.push(db);
        promises.push(db.waitForInitialization());
      }
      
      // Wait for all to initialize
      await Promise.all(promises);
      
      // Verify all are properly initialized
      for (let i = 0; i < instances.length; i++) {
        const version = await instances[i].getCurrentMigrationVersion();
        expect(version).toBe(5);
        
        const tables = await instances[i].getTables();
        expect(tables).toHaveLength(7); // conversations, summaries, messages, analytics, memories, settings, emotional_metrics
      }
      
      // Clean up
      for (let i = 0; i < instances.length; i++) {
        await instances[i].close();
        const testPath = `./test-rapid-${i}.db`;
        if (fs.existsSync(testPath)) {
          fs.unlinkSync(testPath);
        }
      }
    });
  });

  describe('async operation safety', () => {
    test('should handle concurrent queries safely', async () => {
      // Insert test data first
      await dbManager.query(
        'INSERT INTO conversations (call_sid, start_time, end_time, duration) VALUES (?, ?, ?, ?)',
        ['test-concurrent', '2024-01-01T10:00:00Z', '2024-01-01T10:05:00Z', 300]
      );
      
      // Run multiple concurrent queries
      const promises = Array.from({ length: 10 }, (_, i) => {
        return dbManager.query('SELECT * FROM conversations WHERE call_sid = ?', ['test-concurrent']);
      });

      const results = await Promise.all(promises);
      
      // All should return the same result
      results.forEach(result => {
        expect(result).toHaveLength(1);
        expect(result[0].call_sid).toBe('test-concurrent');
      });
    });

    test('should maintain consistency during rapid close/reopen', async () => {
      // Insert test data
      await dbManager.query(
        'INSERT INTO conversations (call_sid, start_time, end_time, duration) VALUES (?, ?, ?, ?)',
        ['test-rapid-close', '2024-01-01T10:00:00Z', '2024-01-01T10:05:00Z', 300]
      );
      
      // Close current instance
      await dbManager.close();
      
      // Immediately create new instance with same path
      dbManager = new DatabaseManager(testDbPath);
      await dbManager.waitForInitialization();
      
      // Verify data is still there
      const result = await dbManager.query('SELECT * FROM conversations WHERE call_sid = ?', ['test-rapid-close']);
      expect(result).toHaveLength(1);
      expect(result[0].call_sid).toBe('test-rapid-close');
    });
  });

  describe('error recovery', () => {
    test('should handle invalid path gracefully', () => {
      // This should not throw during construction
      expect(() => new DatabaseManager('./nonexistent/deep/path/test.db')).not.toThrow();
    });

    test('should properly close and prevent further operations', async () => {
      await dbManager.close();
      
      // Subsequent operations should fail
      await expect(dbManager.query('SELECT 1')).rejects.toThrow('Database connection is closed');
    });
  });
});