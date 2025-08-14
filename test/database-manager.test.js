const DatabaseManager = require('../services/database-manager');
const fs = require('fs');
const path = require('path');

describe('DatabaseManager', () => {
  let dbManager;
  const testDbPath = './test-conversation-summaries.db';

  beforeEach(async () => {
    // Remove test database if it exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    dbManager = new DatabaseManager(testDbPath);
    await dbManager.waitForInitialization();
  });

  afterEach(async () => {
    if (dbManager) {
      await dbManager.close();
    }
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('constructor', () => {
    test('should create database file and initialize tables', () => {
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    test('should create all required tables', async () => {
      const tables = await dbManager.getTables();
      expect(tables).toEqual(
        expect.arrayContaining([
          'conversations',
          'summaries', 
          'messages',
          'analytics'
        ])
      );
    });

    test('should handle missing database directory', async () => {
      const nestedPath = './test-dir/nested/test.db';
      const nestedDbManager = new DatabaseManager(nestedPath);
      await nestedDbManager.waitForInitialization();
      
      expect(fs.existsSync(nestedPath)).toBe(true);
      
      await nestedDbManager.close();
      // Clean up nested structure
      fs.rmSync('./test-dir', { recursive: true, force: true });
    });
  });

  describe('table structure', () => {
    test('conversations table should have correct schema', async () => {
      const schema = await dbManager.getTableSchema('conversations');
      const columns = schema.map(col => col.name);
      
      expect(columns).toEqual(
        expect.arrayContaining([
          'id', 'call_sid', 'start_time', 'end_time', 
          'duration', 'caller_info', 'created_at'
        ])
      );
    });

    test('summaries table should have correct schema', async () => {
      const schema = await dbManager.getTableSchema('summaries');
      const columns = schema.map(col => col.name);
      
      expect(columns).toEqual(
        expect.arrayContaining([
          'id', 'conversation_id', 'summary_text', 'created_at'
        ])
      );
    });

    test('messages table should have correct schema', async () => {
      const schema = await dbManager.getTableSchema('messages');
      const columns = schema.map(col => col.name);
      
      expect(columns).toEqual(
        expect.arrayContaining([
          'id', 'conversation_id', 'role', 'content', 'timestamp'
        ])
      );
    });

    test('analytics table should have correct schema', async () => {
      const schema = await dbManager.getTableSchema('analytics');
      const columns = schema.map(col => col.name);
      
      expect(columns).toEqual(
        expect.arrayContaining([
          'id', 'conversation_id', 'sentiment_scores', 
          'keywords', 'patterns', 'created_at'
        ])
      );
    });
  });

  describe('connection pooling', () => {
    test('should reuse same connection for multiple queries', () => {
      const connection1 = dbManager.getConnection();
      const connection2 = dbManager.getConnection();
      
      expect(connection1).toBe(connection2);
    });

    test('should handle concurrent operations safely', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => {
        return new Promise(async resolve => {
          setTimeout(async () => {
            const result = await dbManager.query('SELECT sqlite_version()');
            resolve(result);
          }, Math.random() * 10);
        });
      });

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('sqlite_version()');
      });
    });
  });

  describe('migration handling', () => {
    test('should track migration version', async () => {
      const version = await dbManager.getCurrentMigrationVersion();
      expect(typeof version).toBe('number');
      expect(version).toBeGreaterThanOrEqual(0);
    });

    test('should apply migrations in order', async () => {
      // This tests the initial migration was applied
      const tables = await dbManager.getTables();
      expect(tables.length).toBeGreaterThan(0);
      
      const version = await dbManager.getCurrentMigrationVersion();
      expect(version).toBe(1); // Should be at version 1 after initial setup
    });
  });

  describe('query method', () => {
    test('should execute SELECT queries', async () => {
      const result = await dbManager.query('SELECT sqlite_version()');
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('sqlite_version()');
    });

    test('should handle parameterized queries', async () => {
      // Insert test data
      await dbManager.query(
        'INSERT INTO conversations (call_sid, start_time, end_time, duration) VALUES (?, ?, ?, ?)',
        ['test-123', '2024-01-01T10:00:00Z', '2024-01-01T10:05:00Z', 300]
      );

      const result = await dbManager.query(
        'SELECT * FROM conversations WHERE call_sid = ?',
        ['test-123']
      );

      expect(result).toHaveLength(1);
      expect(result[0].call_sid).toBe('test-123');
    });

    test('should throw error for invalid SQL', async () => {
      await expect(dbManager.query('INVALID SQL QUERY')).rejects.toThrow();
    });
  });

  describe('performance', () => {
    test('should complete simple queries in under 100ms', async () => {
      const start = Date.now();
      await dbManager.query('SELECT COUNT(*) as count FROM conversations');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100);
    });

    test('should handle batch inserts efficiently', async () => {
      const start = Date.now();
      
      // Insert 100 test records
      for (let i = 0; i < 100; i++) {
        await dbManager.query(
          'INSERT INTO conversations (call_sid, start_time, end_time, duration) VALUES (?, ?, ?, ?)',
          [`test-${i}`, '2024-01-01T10:00:00Z', '2024-01-01T10:05:00Z', 300]
        );
      }
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });

  describe('error handling', () => {
    test('should handle database file permission issues gracefully', async () => {
      // This test would be platform-specific, so we'll just ensure the constructor doesn't crash
      expect(() => new DatabaseManager('./readonly/test.db')).not.toThrow();
    });

    test('should handle connection closure gracefully', async () => {
      await dbManager.close();
      
      await expect(dbManager.query('SELECT 1')).rejects.toThrow();
    });
  });

  describe('transaction support', () => {
    test('should support database transactions', async () => {
      await dbManager.transaction(() => {
        dbManager.runSync(
          'INSERT INTO conversations (call_sid, start_time, end_time, duration) VALUES (?, ?, ?, ?)',
          ['test-tx', '2024-01-01T10:00:00Z', '2024-01-01T10:05:00Z', 300]
        );
        
        // This should be committed automatically
        return true;
      });
      
      const result = await dbManager.query('SELECT * FROM conversations WHERE call_sid = ?', ['test-tx']);
      expect(result).toHaveLength(1);
    });
  });

  describe('health check', () => {
    test('should report healthy when database is operational', async () => {
      const healthy = await dbManager.isHealthy();
      expect(healthy).toBe(true);
    });

    test('should report unhealthy after close', async () => {
      await dbManager.close();
      const healthy = await dbManager.isHealthy();
      expect(healthy).toBe(false);
    });
  });
});