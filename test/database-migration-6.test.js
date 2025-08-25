const DatabaseManager = require('../services/database-manager');

describe('Database Migration 6 - Facts vs Memories', () => {
  let dbManager;
  
  beforeAll(async () => {
    // Use in-memory database for isolated testing
    dbManager = new DatabaseManager(':memory:');
    await dbManager.waitForInitialization();
  });

  afterAll(async () => {
    if (dbManager) {
      await dbManager.close();
    }
  });

  describe('Migration 6 Application', () => {
    test('should have applied migration 6', async () => {
      const version = await dbManager.getCurrentMigrationVersion();
      expect(version).toBeGreaterThanOrEqual(6);
    });

    test('should add is_fact column to memories table', async () => {
      // Check that the is_fact column exists
      const tableInfo = await dbManager.all('PRAGMA table_info(memories)');
      const isFactColumn = tableInfo.find(col => col.name === 'is_fact');
      
      expect(isFactColumn).toBeDefined();
      expect(isFactColumn.type).toBe('BOOLEAN');
      expect(isFactColumn.dflt_value).toBe('FALSE'); // SQLite default FALSE
    });

    test('should add is_fact index', async () => {
      const indexes = await dbManager.all(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name='idx_memories_is_fact'
      `);
      
      expect(indexes).toHaveLength(1);
      expect(indexes[0].name).toBe('idx_memories_is_fact');
    });
  });

  describe('Data Integrity After Migration', () => {
    test('should default existing memories to is_fact=false', async () => {
      // Create a memory the old way (before migration awareness)
      await dbManager.run(`
        INSERT INTO memories (memory_key, memory_content, category)
        VALUES ('test_legacy', 'Legacy memory content', 'general')
      `);

      // Verify it defaults to is_fact=false
      const memory = await dbManager.get(`
        SELECT is_fact FROM memories WHERE memory_key = 'test_legacy'
      `);
      
      expect(memory.is_fact).toBe(0); // SQLite boolean false
    });

    test('should allow explicitly setting is_fact=true for facts', async () => {
      // Insert a fact
      await dbManager.run(`
        INSERT INTO memories (memory_key, memory_content, category, is_fact)
        VALUES ('test_fact', 'This is a verified fact', 'family', 1)
      `);

      // Verify it's stored as a fact
      const fact = await dbManager.get(`
        SELECT is_fact FROM memories WHERE memory_key = 'test_fact'
      `);
      
      expect(fact.is_fact).toBe(1); // SQLite boolean true
    });

    test('should allow filtering by is_fact column', async () => {
      // Insert mixed data
      await dbManager.run(`
        INSERT INTO memories (memory_key, memory_content, category, is_fact) VALUES 
        ('fact1', 'Fact content 1', 'family', 1),
        ('fact2', 'Fact content 2', 'health', 1),
        ('memory1', 'Memory content 1', 'general', 0),
        ('memory2', 'Memory content 2', 'preferences', 0)
      `);

      // Query facts only
      const facts = await dbManager.all(`
        SELECT memory_key FROM memories WHERE is_fact = 1 ORDER BY memory_key
      `);
      expect(facts.length).toBeGreaterThanOrEqual(2);
      expect(facts.map(f => f.memory_key)).toEqual(expect.arrayContaining(['fact1', 'fact2']));

      // Query memories only
      const memories = await dbManager.all(`
        SELECT memory_key FROM memories WHERE is_fact = 0 ORDER BY memory_key
      `);
      expect(memories.length).toBeGreaterThanOrEqual(2);
      expect(memories.map(m => m.memory_key)).toEqual(
        expect.arrayContaining(['memory1', 'memory2', 'test_legacy'])
      );
    });
  });


  describe('Backward Compatibility', () => {
    test('should not break existing memory operations', async () => {
      // Test that old-style inserts still work
      await dbManager.run(`
        INSERT INTO memories (memory_key, memory_content, category)
        VALUES ('backward_compat', 'Old style insert', 'general')
      `);

      const memory = await dbManager.get(`
        SELECT memory_key, memory_content, category, is_fact 
        FROM memories WHERE memory_key = 'backward_compat'
      `);

      expect(memory).toBeDefined();
      expect(memory.memory_key).toBe('backward_compat');
      expect(memory.is_fact).toBe(0); // Defaults to false
    });

    test('should handle null values gracefully', async () => {
      // Test that the column handles null values (though it shouldn't happen with DEFAULT)
      const memory = await dbManager.get(`
        SELECT COALESCE(is_fact, 0) as is_fact_safe 
        FROM memories WHERE memory_key = 'backward_compat'
      `);

      expect(memory.is_fact_safe).toBe(0);
    });
  });
});