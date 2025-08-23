/**
 * Test file for Memory Service is_fact functionality
 * Tests the new capability to distinguish between caller memories and factual information
 * 
 * Following TDD approach:
 * 1. RED: Write failing tests that define expected behavior
 * 2. GREEN: Implement minimal code to make tests pass
 * 3. BLUE: Refactor for quality and maintainability
 */

const MemoryService = require('../services/memory-service');
const DatabaseManager = require('../services/database-manager');
const fs = require('fs');

describe('MemoryService with is_fact functionality', () => {
  let testDb;
  let memoryService;
  const testDbPath = './test-memory-service.db';

  beforeEach(async () => {
    // Remove test database if it exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Create fresh test database
    testDb = new DatabaseManager(testDbPath);
    await testDb.waitForInitialization();
    
    // Create MemoryService instance
    memoryService = new MemoryService(testDb);
    await memoryService.initialize();
  });

  afterEach(async () => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    DatabaseManager.resetInstance();
  });

  describe('saveMemory() with isFact parameter', () => {
    test('should save memory as fact when isFact is true', async () => {
      const result = await memoryService.saveMemory(
        'daughter-name-sarah', 
        'Her daughter is named Sarah', 
        'family', 
        true // isFact = true
      );

      expect(result.status).toBe('success');
      expect(result.action).toBe('created');
      expect(result.key).toBe('daughter-name-sarah');

      // Verify it was saved as a fact in database
      const dbResult = await testDb.get(
        'SELECT memory_key, memory_content, category, is_fact FROM memories WHERE memory_key = ?',
        ['daughter-name-sarah']
      );
      expect(dbResult.is_fact).toBe(1); // SQLite stores boolean as 1/0
    });

    test('should save memory as regular memory when isFact is false', async () => {
      const result = await memoryService.saveMemory(
        'feeling-anxious', 
        'Francine is feeling anxious today', 
        'health', 
        false // isFact = false
      );

      expect(result.status).toBe('success');
      expect(result.action).toBe('created');

      // Verify it was saved as regular memory in database
      const dbResult = await testDb.get(
        'SELECT memory_key, memory_content, category, is_fact FROM memories WHERE memory_key = ?',
        ['feeling-anxious']
      );
      expect(dbResult.is_fact).toBe(0); // SQLite stores boolean as 1/0
    });

    test('should default to false when isFact parameter is not provided (backward compatibility)', async () => {
      const result = await memoryService.saveMemory(
        'likes-tea', 
        'Francine likes chamomile tea', 
        'preferences'
        // isFact parameter omitted - should default to false
      );

      expect(result.status).toBe('success');
      expect(result.action).toBe('created');

      // Verify it was saved as regular memory (default behavior)
      const dbResult = await testDb.get(
        'SELECT memory_key, memory_content, category, is_fact FROM memories WHERE memory_key = ?',
        ['likes-tea']
      );
      expect(dbResult.is_fact).toBe(0); // Should default to false (0)
    });

    test('should update existing memory and preserve is_fact status', async () => {
      // First, save as fact
      await memoryService.saveMemory('son-name', 'Her son is Ryan', 'family', true);

      // Update the content but keep as fact
      const result = await memoryService.saveMemory('son-name', 'Her son Ryan lives in Portland', 'family', true);

      expect(result.status).toBe('success');
      expect(result.action).toBe('updated');

      // Verify it's still a fact
      const dbResult = await testDb.get(
        'SELECT memory_key, memory_content, category, is_fact FROM memories WHERE memory_key = ?',
        ['son-name']
      );
      expect(dbResult.is_fact).toBe(1);
      expect(dbResult.memory_content).toBe('Her son Ryan lives in Portland');
    });

    test('should allow converting memory to fact and vice versa', async () => {
      // Save as regular memory first
      await memoryService.saveMemory('address', 'Lives on Oak Street', 'general', false);
      
      let dbResult = await testDb.get('SELECT is_fact FROM memories WHERE memory_key = ?', ['address']);
      expect(dbResult.is_fact).toBe(0);

      // Update to fact
      await memoryService.saveMemory('address', 'Lives at 123 Oak Street', 'general', true);
      
      dbResult = await testDb.get('SELECT is_fact FROM memories WHERE memory_key = ?', ['address']);
      expect(dbResult.is_fact).toBe(1);

      // Convert back to regular memory
      await memoryService.saveMemory('address', 'Mentioned living near Oak Street', 'general', false);
      
      dbResult = await testDb.get('SELECT is_fact FROM memories WHERE memory_key = ?', ['address']);
      expect(dbResult.is_fact).toBe(0);
    });
  });

  describe('getMemory() returning is_fact status', () => {
    beforeEach(async () => {
      // Set up test data with both facts and memories
      await memoryService.saveMemory('fact-birthday', 'Born on March 15, 1940', 'personal', true);
      await memoryService.saveMemory('memory-mood', 'Was feeling sad yesterday', 'health', false);
    });

    test('should return is_fact: true for factual memories', async () => {
      const result = await memoryService.getMemory('fact-birthday');

      expect(result).not.toBeNull();
      expect(result.key).toBe('fact-birthday');
      expect(result.content).toBe('Born on March 15, 1940');
      expect(result.category).toBe('personal');
      expect(result.is_fact).toBe(true);
    });

    test('should return is_fact: false for regular memories', async () => {
      const result = await memoryService.getMemory('memory-mood');

      expect(result).not.toBeNull();
      expect(result.key).toBe('memory-mood');
      expect(result.content).toBe('Was feeling sad yesterday');
      expect(result.category).toBe('health');
      expect(result.is_fact).toBe(false);
    });

    test('should return null for non-existent memory', async () => {
      const result = await memoryService.getMemory('non-existent');
      expect(result).toBeNull();
    });

    test('should retrieve from cache and include is_fact status', async () => {
      // First retrieval loads into cache
      await memoryService.getMemory('fact-birthday');
      
      // Second retrieval should come from cache and still include is_fact
      const result = await memoryService.getMemory('fact-birthday');
      
      expect(result.is_fact).toBe(true);
    });
  });

  describe('getAllMemoryKeys() returning separated facts and memories', () => {
    beforeEach(async () => {
      // Set up test data with mixed facts and memories
      await memoryService.saveMemory('fact-name', 'Name is Francine', 'personal', true);
      await memoryService.saveMemory('fact-age', 'Age is 84', 'personal', true);
      await memoryService.saveMemory('fact-address', 'Lives at Sunset Manor', 'personal', true);
      await memoryService.saveMemory('memory-anxious', 'Feeling anxious today', 'health', false);
      await memoryService.saveMemory('memory-confused', 'Confused about time', 'health', false);
    });

    test('should return object with facts and memories arrays', async () => {
      const result = await memoryService.getAllMemoryKeys();

      expect(result).toBeInstanceOf(Object);
      expect(result.facts).toBeInstanceOf(Array);
      expect(result.memories).toBeInstanceOf(Array);
    });

    test('should separate facts from memories correctly', async () => {
      const result = await memoryService.getAllMemoryKeys();

      // Check facts array
      expect(result.facts).toHaveLength(3);
      expect(result.facts).toContain('fact-name');
      expect(result.facts).toContain('fact-age');
      expect(result.facts).toContain('fact-address');

      // Check memories array
      expect(result.memories).toHaveLength(2);
      expect(result.memories).toContain('memory-anxious');
      expect(result.memories).toContain('memory-confused');
    });

    test('should return empty arrays when no memories exist', async () => {
      // Clear all test data
      await testDb.run('DELETE FROM memories');
      await memoryService.loadMemoriesIntoCache(); // Reload cache

      const result = await memoryService.getAllMemoryKeys();

      expect(result.facts).toHaveLength(0);
      expect(result.memories).toHaveLength(0);
    });

    test('should work correctly when only facts exist', async () => {
      // Remove all memories, keep only facts
      await testDb.run('DELETE FROM memories WHERE is_fact = 0');
      await memoryService.loadMemoriesIntoCache();

      const result = await memoryService.getAllMemoryKeys();

      expect(result.facts).toHaveLength(3);
      expect(result.memories).toHaveLength(0);
    });

    test('should work correctly when only memories exist', async () => {
      // Remove all facts, keep only memories
      await testDb.run('DELETE FROM memories WHERE is_fact = 1');
      await memoryService.loadMemoriesIntoCache();

      const result = await memoryService.getAllMemoryKeys();

      expect(result.facts).toHaveLength(0);
      expect(result.memories).toHaveLength(2);
    });
  });

  describe('new getFactKeys() method', () => {
    beforeEach(async () => {
      await memoryService.saveMemory('fact-birthday', 'Born March 15, 1940', 'personal', true);
      await memoryService.saveMemory('fact-son', 'Has son named Ryan', 'family', true);
      await memoryService.saveMemory('memory-mood', 'Feeling anxious', 'health', false);
    });

    test('should return only fact keys', async () => {
      const factKeys = await memoryService.getFactKeys();

      expect(factKeys).toBeInstanceOf(Array);
      expect(factKeys).toHaveLength(2);
      expect(factKeys).toContain('fact-birthday');
      expect(factKeys).toContain('fact-son');
      expect(factKeys).not.toContain('memory-mood');
    });

    test('should return empty array when no facts exist', async () => {
      await testDb.run('DELETE FROM memories WHERE is_fact = 1');
      await memoryService.loadMemoriesIntoCache();

      const factKeys = await memoryService.getFactKeys();
      expect(factKeys).toHaveLength(0);
    });
  });

  describe('new getMemoryKeys() method', () => {
    beforeEach(async () => {
      await memoryService.saveMemory('fact-birthday', 'Born March 15, 1940', 'personal', true);
      await memoryService.saveMemory('memory-mood', 'Feeling anxious', 'health', false);
      await memoryService.saveMemory('memory-confused', 'Confused about date', 'health', false);
    });

    test('should return only regular memory keys (not facts)', async () => {
      const memoryKeys = await memoryService.getMemoryKeys();

      expect(memoryKeys).toBeInstanceOf(Array);
      expect(memoryKeys).toHaveLength(2);
      expect(memoryKeys).toContain('memory-mood');
      expect(memoryKeys).toContain('memory-confused');
      expect(memoryKeys).not.toContain('fact-birthday');
    });

    test('should return empty array when no regular memories exist', async () => {
      await testDb.run('DELETE FROM memories WHERE is_fact = 0');
      await memoryService.loadMemoriesIntoCache();

      const memoryKeys = await memoryService.getMemoryKeys();
      expect(memoryKeys).toHaveLength(0);
    });
  });

  describe('SQL queries include is_fact column', () => {
    test('searchMemories() should include is_fact in results', async () => {
      await memoryService.saveMemory('fact-family', 'Has 2 children', 'family', true);
      await memoryService.saveMemory('memory-family', 'Talked about family today', 'family', false);

      const results = await memoryService.searchMemories('family');

      expect(results).toHaveLength(2);
      
      const fact = results.find(r => r.key === 'fact-family');
      const memory = results.find(r => r.key === 'memory-family');
      
      expect(fact.is_fact).toBe(true);
      expect(memory.is_fact).toBe(false);
    });

    test('getMemoriesByCategory() should include is_fact in results', async () => {
      await memoryService.saveMemory('fact-health', 'Has diabetes', 'health', true);
      await memoryService.saveMemory('memory-health', 'Complained of headache', 'health', false);

      const results = await memoryService.getMemoriesByCategory('health');

      expect(results).toHaveLength(2);
      
      const fact = results.find(r => r.key === 'fact-health');
      const memory = results.find(r => r.key === 'memory-health');
      
      expect(fact.is_fact).toBe(true);
      expect(memory.is_fact).toBe(false);
    });
  });

  describe('backward compatibility', () => {
    test('existing code calling saveMemory without isFact should continue working', async () => {
      // Simulate existing code pattern (3 parameters)
      const result = await memoryService.saveMemory('old-style', 'Old style memory', 'general');

      expect(result.status).toBe('success');
      
      // Should default to false for is_fact
      const dbResult = await testDb.get('SELECT is_fact FROM memories WHERE memory_key = ?', ['old-style']);
      expect(dbResult.is_fact).toBe(0);
    });

    test('existing code calling getAllMemoryKeys should work but get new format', async () => {
      await memoryService.saveMemory('test-key', 'Test content', 'general');

      const result = await memoryService.getAllMemoryKeys();
      
      // Should return object with facts and memories arrays (not simple array)
      expect(result).toHaveProperty('facts');
      expect(result).toHaveProperty('memories');
      expect(result.memories).toContain('test-key');
    });

    test('cache operations should handle is_fact correctly', async () => {
      await memoryService.saveMemory('cached-fact', 'Test fact', 'general', true);
      
      // First access loads into cache
      let result = await memoryService.getMemory('cached-fact');
      expect(result.is_fact).toBe(true);
      
      // Second access should come from cache with is_fact
      result = await memoryService.getMemory('cached-fact');
      expect(result.is_fact).toBe(true);
    });
  });

  describe('statistics should include fact/memory breakdown', () => {
    test('getStatistics() should include fact vs memory counts', async () => {
      await memoryService.saveMemory('fact1', 'Fact 1', 'personal', true);
      await memoryService.saveMemory('fact2', 'Fact 2', 'family', true);
      await memoryService.saveMemory('memory1', 'Memory 1', 'health', false);

      const stats = await memoryService.getStatistics();

      expect(stats.totalMemories).toBe(3);
      expect(stats.factCount).toBe(2);
      expect(stats.memoryCount).toBe(1);
    });
  });
});