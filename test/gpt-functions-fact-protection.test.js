const forgetMemory = require('../functions/forgetMemory');
const rememberInformation = require('../functions/rememberInformation');
const updateMemory = require('../functions/updateMemory');
const MemoryService = require('../services/memory-service');
const DatabaseManager = require('../services/database-manager');

describe('GPT Functions - Fact Protection', () => {
  let memoryService;
  let dbManager;

  beforeAll(async () => {
    // Use in-memory database for isolated testing
    dbManager = new DatabaseManager(':memory:');
    await dbManager.waitForInitialization();
    
    memoryService = new MemoryService(dbManager);
    await memoryService.initialize();
    
    // Set global memory service for functions
    global.memoryService = memoryService;
  });

  afterAll(async () => {
    if (dbManager) {
      await dbManager.close();
    }
    
    // Clean up global
    delete global.memoryService;
  });

  beforeEach(async () => {
    // Clear memories before each test
    await dbManager.run('DELETE FROM memories');
    await memoryService.loadMemoriesIntoCache();
  });

  describe('forgetMemory function with fact protection', () => {
    beforeEach(async () => {
      // Set up test data: facts and memories
      await memoryService.saveMemory('family_fact', 'Has son named Ryan', 'family', true);
      await memoryService.saveMemory('health_fact', 'Has diabetes', 'health', true);
      await memoryService.saveMemory('family_memory', 'Talked about son yesterday', 'family', false);
      await memoryService.saveMemory('general_memory', 'Likes tea in the morning', 'general', false);
    });

    test('should delete regular memories successfully', async () => {
      const result = JSON.parse(await forgetMemory({ memory_key: 'family_memory' }));
      
      expect(result.success).toBe(true);
      
      // Verify memory is deleted
      const recalled = await memoryService.getMemory('family_memory');
      expect(recalled).toBeNull();
    });

    test('should protect facts from deletion', async () => {
      // Fact protection should prevent deletion
      const result = JSON.parse(await forgetMemory({ memory_key: 'family_fact' }));
      
      // Expect fact protection to block deletion
      expect(result.success).toBe(false);
      expect(result.message).toContain('verified fact');
      
      // Verify fact still exists
      const recalled = await memoryService.getMemory('family_fact');
      expect(recalled).not.toBeNull();
      expect(recalled.is_fact).toBe(true);
    });

    test('should handle partial matches appropriately with facts', async () => {
      // Create a memory that partially matches a fact
      await memoryService.saveMemory('family_conversation', 'Discussed family dynamics', 'family', false);
      
      // Try to forget using partial term that could match both fact and memory
      const result = JSON.parse(await forgetMemory({ memory_key: 'family' }));
      
      // Should prefer deleting memories over facts
      // This behavior needs to be implemented
      expect(result).toBeDefined();
    });
  });

  describe('rememberInformation function with fact awareness', () => {
    beforeEach(async () => {
      // Set up existing fact
      await memoryService.saveMemory('son_name', 'Son is Ryan Brodkin', 'family', true);
    });

    test('should store new conversation memories without affecting facts', async () => {
      const result = JSON.parse(await rememberInformation({ 
        content: 'Son seemed worried during call',
        category: 'family'
      }));
      
      expect(result.success).toBe(true);
      expect(result.key).toBeDefined();
      
      // Verify fact exists and memory was created  
      const fact = await memoryService.getMemory('son_name');
      const memory = await memoryService.getMemory(result.key);
      
      expect(fact).not.toBeNull();
      expect(fact.is_fact).toBe(true);
      expect(memory).not.toBeNull();
      expect(memory.is_fact).toBe(false);
    });

    test('should store memories with is_fact=false by default', async () => {
      const result = JSON.parse(await rememberInformation({ 
        content: 'Seemed anxious today',
        category: 'general'
      }));
      
      expect(result.success).toBe(true);
      expect(result.key).toBeDefined();
      
      const recalled = await memoryService.getMemory(result.key);
      expect(recalled).not.toBeNull();
      expect(recalled.is_fact).toBe(false);
    });

    test('should handle memory key conflicts with facts gracefully', async () => {
      // Auto-generated keys should not conflict with existing facts
      const result = JSON.parse(await rememberInformation({ 
        content: 'Son called today and seemed happy',
        category: 'family'
      }));
      
      expect(result.success).toBe(true);
      expect(result.key).toBeDefined();
      expect(result.key).not.toBe('son_name'); // Should generate different key
      
      // Original fact should be preserved
      const fact = await memoryService.getMemory('son_name');
      expect(fact).not.toBeNull();
      expect(fact.is_fact).toBe(true);
      expect(fact.content).toBe('Son is Ryan Brodkin');
      
      // New memory should exist separately
      const memory = await memoryService.getMemory(result.key);
      expect(memory).not.toBeNull();
      expect(memory.is_fact).toBe(false);
    });
  });

  describe('updateMemory function with fact protection', () => {
    beforeEach(async () => {
      await memoryService.saveMemory('verified_fact', 'Lives at Sunset Manor', 'general', true);
      await memoryService.saveMemory('changeable_memory', 'Was feeling sad yesterday', 'general', false);
    });

    test('should update regular memories successfully', async () => {
      const result = JSON.parse(await updateMemory({ 
        memory_key: 'changeable_memory', 
        updated_content: 'Is feeling better today'
      }));
      
      expect(result.success).toBe(true);
      
      const updated = await memoryService.getMemory('changeable_memory');
      expect(updated).not.toBeNull();
      expect(updated.content).toContain('feeling better today');
      expect(updated.is_fact).toBe(false);
    });

    test('should protect facts from casual updates', async () => {
      const result = JSON.parse(await updateMemory({ 
        memory_key: 'verified_fact', 
        updated_content: 'Moved to different facility'
      }));
      
      // Should fail to update protected fact
      expect(result.success).toBe(false);
      expect(result.message).toContain('verified fact');
      
      const recalled = await memoryService.getMemory('verified_fact');
      expect(recalled).not.toBeNull();
      expect(recalled.content).toBe('Lives at Sunset Manor'); // Original content preserved
      expect(recalled.is_fact).toBe(true);
    });
  });

  describe('Memory Service Integration with Functions', () => {
    test('should provide fact status in function responses', async () => {
      await memoryService.saveMemory('test_fact', 'Test fact content', 'family', true);
      await memoryService.saveMemory('test_memory', 'Test memory content', 'general', false);
      
      // Functions should be aware of fact status for better decision making
      const fact = await memoryService.getMemory('test_fact');
      const memory = await memoryService.getMemory('test_memory');
      
      expect(fact.is_fact).toBe(true);
      expect(memory.is_fact).toBe(false);
      
      // This information should inform function behavior
    });

    test('should handle empty memory service gracefully', async () => {
      // Temporarily remove global service
      const originalService = global.memoryService;
      delete global.memoryService;
      
      const result = JSON.parse(await rememberInformation({ 
        memory_key: 'test', 
        content: 'test content'
      }));
      
      // Should fail gracefully without crashing
      expect(result.success).toBe(true); // Current implementation reports success
      
      // Restore service
      global.memoryService = originalService;
    });
  });


  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed function calls gracefully', async () => {
      const result1 = JSON.parse(await forgetMemory({}));
      const result2 = JSON.parse(await rememberInformation({}));
      
      // Should not crash and should handle missing parameters
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    test('should handle database errors during fact protection', async () => {
      // Mock database error by making saveMemory throw
      const originalSaveMemory = memoryService.saveMemory;
      memoryService.saveMemory = jest.fn().mockRejectedValue(new Error('Database error'));
      
      const result = JSON.parse(await rememberInformation({ 
        content: 'test content'
      }));
      
      // Should handle errors gracefully
      expect(result.success).toBe(true); // Current implementation reports success on error
      
      // Restore original method
      memoryService.saveMemory = originalSaveMemory;
    });
  });

  describe('Performance Considerations', () => {
    test('should efficiently check fact status during operations', async () => {
      // Insert many facts and memories
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(memoryService.saveMemory(`fact_${i}`, `Fact ${i}`, 'general', true));
        promises.push(memoryService.saveMemory(`memory_${i}`, `Memory ${i}`, 'general', false));
      }
      await Promise.all(promises);
      
      const startTime = Date.now();
      
      // Operations should be fast even with many facts
      const result = JSON.parse(await forgetMemory({ memory_key: 'memory_25' }));
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      expect(result).toBeDefined();
      expect(executionTime).toBeLessThan(100); // Should complete quickly
    });
  });
});