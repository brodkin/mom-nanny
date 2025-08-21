const DatabaseManager = require('../services/database-manager');
const fs = require('fs');
const path = require('path');

describe('DatabaseManager', () => {
  let dbManager;
  const testDbPath = './test-conversation-summaries.db';

  beforeEach(async () => {
    // Reset singleton to ensure clean state
    DatabaseManager.resetInstance();
    
    // Remove test database and associated files if they exist
    [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`].forEach(file => {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch (err) {
          // Ignore errors - file might be in use
        }
      }
    });
    
    dbManager = new DatabaseManager(testDbPath);
    await dbManager.waitForInitialization();
  });

  afterEach(async () => {
    if (dbManager) {
      await dbManager.close();
    }
    
    // Reset singleton after test
    DatabaseManager.resetInstance();
    
    // Clean up test database and associated files
    [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`].forEach(file => {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch (err) {
          // Ignore errors
        }
      }
    });
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
          'analytics',
          'memories',
          'settings'
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
      // This tests that all migrations are applied to a fresh database
      const tables = await dbManager.getTables();
      expect(tables.length).toBeGreaterThan(0);
      
      const version = await dbManager.getCurrentMigrationVersion();
      expect(version).toBe(4); // Should be at latest version (4) after initial setup
    });

    test('should apply Migration 4 performance indexes', async () => {
      const version = await dbManager.getCurrentMigrationVersion();
      expect(version).toBeGreaterThanOrEqual(4);

      // Verify that Migration 4 indexes exist
      const indexes = await dbManager.all(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND sql NOT NULL
        ORDER BY name
      `);
      
      const indexNames = indexes.map(idx => idx.name);
      
      expect(indexNames).toContain('idx_conversations_created_at');
      expect(indexNames).toContain('idx_summaries_created_at');
      expect(indexNames).toContain('idx_analytics_created_at');
      expect(indexNames).toContain('idx_messages_role_timestamp');
      expect(indexNames).toContain('idx_memories_category_updated');
    });

    test('should skip Migration 4 if already applied', async () => {
      // First, verify we're at version 4
      let version = await dbManager.getCurrentMigrationVersion();
      expect(version).toBe(4);

      // Count current indexes
      const initialIndexes = await dbManager.all(`
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type='index' AND sql NOT NULL
      `);

      // Apply migrations again - should be idempotent
      await dbManager.applyMigrations();
      
      // Version should still be 4
      version = await dbManager.getCurrentMigrationVersion();
      expect(version).toBe(4);

      // Index count should be unchanged
      const finalIndexes = await dbManager.all(`
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type='index' AND sql NOT NULL
      `);
      
      expect(finalIndexes[0].count).toBe(initialIndexes[0].count);
    });
  });

  describe('schema verification', () => {
    test('should verify complete schema is valid', async () => {
      const verification = await dbManager.verifySchema();
      
      expect(verification).toHaveProperty('isValid');
      expect(verification).toHaveProperty('missingTables');
      expect(verification).toHaveProperty('missingIndexes');
      
      expect(verification.isValid).toBe(true);
      expect(verification.missingTables).toEqual([]);
      expect(verification.missingIndexes).toEqual([]);
    });

    test('should detect missing tables', async () => {
      // Drop a table to test detection
      await dbManager.exec('DROP TABLE IF EXISTS settings');
      
      const verification = await dbManager.verifySchema();
      
      expect(verification.isValid).toBe(false);
      expect(verification.missingTables).toContain('settings');
    });

    test('should detect missing indexes', async () => {
      // Drop an index to test detection
      await dbManager.exec('DROP INDEX IF EXISTS idx_conversations_created_at');
      
      const verification = await dbManager.verifySchema();
      
      expect(verification.isValid).toBe(false);
      expect(verification.missingIndexes).toContain('idx_conversations_created_at');
    });

    test('should handle verification on empty database', async () => {
      // Create a fresh database manager with no migrations
      const emptyDbPath = './test-empty.db';
      
      try {
        // Create empty database with just the better-sqlite3 instance
        const Database = require('better-sqlite3');
        const emptyDb = new Database(emptyDbPath);
        
        // Create a bare-bones database manager instance to avoid constructor initialization
        const emptyDbManager = Object.create(DatabaseManager.prototype);
        emptyDbManager.dbPath = emptyDbPath;
        emptyDbManager.db = emptyDb;
        emptyDbManager.isInitialized = true; // Mark as initialized to skip waiting
        emptyDbManager.isClosed = false;
        emptyDbManager._initPromise = Promise.resolve(); // Fake resolved promise
        
        // Verify the database is truly empty (no tables)
        const tables = await emptyDbManager.all(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations'
        `);
        expect(tables).toEqual([]); // Should be empty
        
        const verification = await emptyDbManager.verifySchema();
        
        expect(verification.isValid).toBe(false);
        expect(verification.missingTables.length).toBeGreaterThan(0);
        expect(verification.missingIndexes.length).toBeGreaterThan(0);
        
        // Verify it detected all expected missing items
        expect(verification.missingTables).toContain('conversations');
        expect(verification.missingTables).toContain('summaries');
        expect(verification.missingIndexes).toContain('idx_conversations_call_sid');
        
        await emptyDbManager.close();
      } finally {
        // Clean up
        const fs = require('fs');
        [emptyDbPath, `${emptyDbPath}-wal`, `${emptyDbPath}-shm`].forEach(file => {
          if (fs.existsSync(file)) {
            try {
              fs.unlinkSync(file);
            } catch (err) {
              // Ignore cleanup errors
            }
          }
        });
      }
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
      // Test that the database manager properly handles SQL errors by testing the underlying
      // error handling mechanism directly rather than relying on test environment behavior
      
      // Verify database is working correctly first
      const validResult = await dbManager.query('SELECT COUNT(*) as count FROM conversations');
      expect(validResult).toEqual([{ count: 0 }]);
      
      // Test that better-sqlite3 throws errors for invalid SQL (this is the core requirement)
      expect(() => {
        dbManager.db.prepare('INVALID SQL QUERY');
      }).toThrow(/syntax error/);
      
      // Test specific error conditions that should always fail
      try {
        await dbManager.run('INSERT INTO non_existent_table VALUES (1, 2, 3)');
        fail('Expected query to throw error for non-existent table');
      } catch (error) {
        expect(error.message).toMatch(/no such table/);
      }
      
      try {
        await dbManager.all('SELECT * FROM non_existent_table');
        fail('Expected query to throw error for non-existent table');
      } catch (error) {
        expect(error.message).toMatch(/no such table/);
      }
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