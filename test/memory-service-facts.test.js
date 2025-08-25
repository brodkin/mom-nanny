const MemoryService = require('../services/memory-service');
const DatabaseManager = require('../services/database-manager');

describe('MemoryService - Facts vs Memories Distinction', () => {
  let memoryService;
  let dbManager;
  
  beforeAll(async () => {
    // Use in-memory database for isolated testing
    dbManager = new DatabaseManager(':memory:');
    await dbManager.waitForInitialization();
    
    memoryService = new MemoryService(dbManager);
    await memoryService.initialize();
  });

  afterAll(async () => {
    if (dbManager) {
      await dbManager.close();
    }
  });

  beforeEach(async () => {
    // Clear memories before each test
    await dbManager.run('DELETE FROM memories');
    await memoryService.loadMemoriesIntoCache();
  });

  describe('saveMemory with isFact parameter', () => {
    test('should save memory with isFact=false by default', async () => {
      const result = await memoryService.saveMemory('test_memory', 'Memory content', 'general');
      
      expect(result.status).toBe('success');
      
      // Check database directly (key gets normalized to 'testmemory')
      const memory = await dbManager.get(`
        SELECT is_fact FROM memories WHERE memory_key = 'testmemory'
      `);
      expect(memory.is_fact).toBe(0); // SQLite boolean false
    });

    test('should save memory with explicit isFact=false', async () => {
      const result = await memoryService.saveMemory('test_memory', 'Memory content', 'general', false);
      
      expect(result.status).toBe('success');
      
      const memory = await dbManager.get(`
        SELECT is_fact FROM memories WHERE memory_key = 'testmemory'
      `);
      expect(memory.is_fact).toBe(0);
    });

    test('should save fact with isFact=true', async () => {
      const result = await memoryService.saveMemory('test_fact', 'Fact content', 'family', true);
      
      expect(result.status).toBe('success');
      
      const fact = await dbManager.get(`
        SELECT is_fact FROM memories WHERE memory_key = 'testfact'
      `);
      expect(fact.is_fact).toBe(1); // SQLite boolean true
    });

    test('should update cache with isFact value', async () => {
      await memoryService.saveMemory('test_fact', 'Fact content', 'family', true);
      await memoryService.saveMemory('test_memory', 'Memory content', 'general', false);
      
      // Check cache directly (keys are normalized)
      const factCache = memoryService.memoryCache.get('testfact');
      const memoryCache = memoryService.memoryCache.get('testmemory');
      
      expect(factCache.is_fact).toBe(true);
      expect(memoryCache.is_fact).toBe(false);
    });

    test('should handle updating existing memory fact status', async () => {
      // Create as memory first
      await memoryService.saveMemory('convertible', 'Initial content', 'general', false);
      
      // Update to fact
      const result = await memoryService.saveMemory('convertible', 'Updated fact content', 'family', true);
      
      expect(result.status).toBe('success');
      
      const updated = await dbManager.get(`
        SELECT is_fact FROM memories WHERE memory_key = 'convertible'
      `);
      expect(updated.is_fact).toBe(1);
      
      // Check cache too
      const cached = memoryService.memoryCache.get('convertible');
      expect(cached.is_fact).toBe(true);
    });
  });

  describe('getMemory with fact information', () => {
    beforeEach(async () => {
      // Set up test data
      await memoryService.saveMemory('fact_key', 'This is a fact', 'family', true);
      await memoryService.saveMemory('memory_key', 'This is a memory', 'general', false);
    });

    test('should return fact with is_fact=true', async () => {
      const result = await memoryService.getMemory('fact_key');
      
      expect(result).not.toBeNull();
      expect(result.content).toBe('This is a fact');
      expect(result.is_fact).toBe(true);
    });

    test('should return memory with is_fact=false', async () => {
      const result = await memoryService.getMemory('memory_key');
      
      expect(result).not.toBeNull();
      expect(result.content).toBe('This is a memory');
      expect(result.is_fact).toBe(false);
    });
  });

  describe('getMemoryKeys with fact/memory separation', () => {
    beforeEach(async () => {
      // Create mixed test data
      await memoryService.saveMemory('family_fact', 'Dad is Ryan', 'family', true);
      await memoryService.saveMemory('health_fact', 'Has diabetes', 'health', true);
      await memoryService.saveMemory('family_memory', 'Misses her son', 'family', false);
      await memoryService.saveMemory('general_memory', 'Likes tea', 'general', false);
    });

    test('should return separate facts and memories', async () => {
      const result = await memoryService.getAllMemoryKeys();
      
      expect(result.facts).toEqual(expect.arrayContaining(['familyfact', 'healthfact']));
      expect(result.memories).toEqual(expect.arrayContaining(['familymemory', 'generalmemory']));
      
      // Ensure no overlap
      const intersection = result.facts.filter(f => result.memories.includes(f));
      expect(intersection).toHaveLength(0);
    });

    test('should handle empty results gracefully', async () => {
      // Clear all memories
      await dbManager.run('DELETE FROM memories');
      await memoryService.loadMemoriesIntoCache();
      
      const result = await memoryService.getAllMemoryKeys();
      
      expect(result.facts).toEqual([]);
      expect(result.memories).toEqual([]);
    });
  });

  describe('getFactKeys method', () => {
    beforeEach(async () => {
      await memoryService.saveMemory('fact1', 'Fact content 1', 'family', true);
      await memoryService.saveMemory('fact2', 'Fact content 2', 'health', true);
      await memoryService.saveMemory('memory1', 'Memory content 1', 'general', false);
    });

    test('should return only fact keys', async () => {
      const factKeys = await memoryService.getFactKeys();
      
      expect(factKeys).toEqual(expect.arrayContaining(['fact1', 'fact2']));
      expect(factKeys).not.toContain('memory1');
      expect(factKeys).toHaveLength(2);
    });

    test('should return empty array when no facts exist', async () => {
      // Delete facts, keep memories
      await dbManager.run('DELETE FROM memories WHERE is_fact = 1');
      await memoryService.loadMemoriesIntoCache();
      
      const factKeys = await memoryService.getFactKeys();
      expect(factKeys).toEqual([]);
    });
  });

  describe('getMemoryKeys method (memories only)', () => {
    beforeEach(async () => {
      await memoryService.saveMemory('fact1', 'Fact content 1', 'family', true);
      await memoryService.saveMemory('memory1', 'Memory content 1', 'general', false);
      await memoryService.saveMemory('memory2', 'Memory content 2', 'preferences', false);
    });

    test('should return only memory keys', async () => {
      const memoryKeys = await memoryService.getMemoryKeys();
      
      expect(memoryKeys).toEqual(expect.arrayContaining(['memory1', 'memory2']));
      expect(memoryKeys).not.toContain('fact1');
      expect(memoryKeys).toHaveLength(2);
    });

    test('should return empty array when no memories exist', async () => {
      // Delete memories, keep facts
      await dbManager.run('DELETE FROM memories WHERE is_fact = 0');
      await memoryService.loadMemoriesIntoCache();
      
      const memoryKeys = await memoryService.getMemoryKeys();
      expect(memoryKeys).toEqual([]);
    });
  });

  describe('searchMemoriesByPattern with fact information', () => {
    beforeEach(async () => {
      await memoryService.saveMemory('family-fact-ryan', 'Son is Ryan Brodkin', 'family', true);
      await memoryService.saveMemory('family-memory-ryan', 'Talked about son Ryan yesterday', 'family', false);
    });

    test('should include is_fact in search results', async () => {
      const results = await memoryService.searchMemories('ryan');
      
      expect(results).toHaveLength(2);
      
      const fact = results.find(r => r.key === 'family-fact-ryan');
      const memory = results.find(r => r.key === 'family-memory-ryan');
      
      expect(fact.is_fact).toBe(true);
      expect(memory.is_fact).toBe(false);
    });
  });

  describe('getMemoriesByCategory with fact information', () => {
    beforeEach(async () => {
      await memoryService.saveMemory('family_fact', 'Has son named Ryan', 'family', true);
      await memoryService.saveMemory('family_memory', 'Misses family', 'family', false);
      await memoryService.saveMemory('general_fact', 'Lives at Sunset Manor', 'general', true);
    });

    test('should include is_fact in category results', async () => {
      const familyMemories = await memoryService.getMemoriesByCategory('family');
      
      expect(familyMemories).toHaveLength(2);
      
      const fact = familyMemories.find(m => m.key === 'familyfact');
      const memory = familyMemories.find(m => m.key === 'familymemory');
      
      expect(fact.is_fact).toBe(true);
      expect(memory.is_fact).toBe(false);
    });
  });

  describe('getMemoryStatistics with fact/memory counts', () => {
    beforeEach(async () => {
      // Create test data across categories
      await memoryService.saveMemory('fact1', 'Fact 1', 'family', true);
      await memoryService.saveMemory('fact2', 'Fact 2', 'health', true);
      await memoryService.saveMemory('memory1', 'Memory 1', 'family', false);
      await memoryService.saveMemory('memory2', 'Memory 2', 'general', false);
      await memoryService.saveMemory('memory3', 'Memory 3', 'preferences', false);
    });

    test('should include fact and memory counts in statistics', async () => {
      const stats = await memoryService.getStatistics();
      
      expect(stats.totalMemories).toBe(5);
      expect(stats.factCount).toBe(2);
      expect(stats.memoryCount).toBe(3);
      expect(stats.categoriesUsed).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Cache Operations with Facts', () => {
    test('should load facts correctly into cache', async () => {
      // Insert directly to database to test cache loading
      await dbManager.run(`
        INSERT INTO memories (memory_key, memory_content, category, is_fact) VALUES
        ('cache_fact', 'Cache fact content', 'family', 1),
        ('cache_memory', 'Cache memory content', 'general', 0)
      `);

      // Reload cache
      await memoryService.loadMemoriesIntoCache();
      
      // Check cache contents
      const factCache = memoryService.memoryCache.get('cache_fact');
      const memoryCache = memoryService.memoryCache.get('cache_memory');
      
      expect(factCache.is_fact).toBe(true);
      expect(memoryCache.is_fact).toBe(false);
    });

    test('should maintain cache consistency when updating fact status', async () => {
      await memoryService.saveMemory('test_key', 'Initial content', 'general', false);
      
      // Verify initial cache state (key normalized to 'testkey')
      let cached = memoryService.memoryCache.get('testkey');
      expect(cached.is_fact).toBe(false);
      
      // Update to fact
      await memoryService.saveMemory('test_key', 'Updated content', 'family', true);
      
      // Verify cache is updated
      cached = memoryService.memoryCache.get('testkey');
      expect(cached.is_fact).toBe(true);
      expect(cached.category).toBe('family');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid isFact parameter gracefully', async () => {
      // The service should handle non-boolean isFact values using JavaScript semantics
      const result1 = await memoryService.saveMemory('test1', 'Content', 'general', 'invalid'); // truthy -> 1
      const result2 = await memoryService.saveMemory('test2', 'Content', 'general', null); // falsy -> 0
      const result3 = await memoryService.saveMemory('test3', 'Content', 'general', undefined); // falsy -> 0
      
      // Should all succeed
      expect(result1.status).toBe('success');
      expect(result2.status).toBe('success');
      expect(result3.status).toBe('success');
      
      // Check they follow JavaScript truthy/falsy semantics
      const memory1 = await dbManager.get('SELECT is_fact FROM memories WHERE memory_key = ?', ['test1']);
      const memory2 = await dbManager.get('SELECT is_fact FROM memories WHERE memory_key = ?', ['test2']);
      const memory3 = await dbManager.get('SELECT is_fact FROM memories WHERE memory_key = ?', ['test3']);
      
      expect(memory1.is_fact).toBe(1); // 'invalid' is truthy
      expect(memory2.is_fact).toBe(0); // null is falsy
      expect(memory3.is_fact).toBe(0); // undefined is falsy
    });
  });
});