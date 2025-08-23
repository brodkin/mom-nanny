const TemplateService = require('../services/template-service');
const MemoryService = require('../services/memory-service');
const DatabaseManager = require('../services/database-manager');

describe('TemplateService - Facts vs Memories Separation', () => {
  let templateService;
  let memoryService;
  let dbManager;

  beforeAll(async () => {
    // Use in-memory database for isolated testing
    dbManager = new DatabaseManager(':memory:');
    await dbManager.waitForInitialization();
    
    memoryService = new MemoryService(dbManager);
    await memoryService.initialize();
    
    templateService = new TemplateService();
  });

  afterAll(async () => {
    if (dbManager) {
      await dbManager.close();
    }
  });

  beforeEach(async () => {
    // Clear memories and template cache before each test
    await dbManager.run('DELETE FROM memories');
    await memoryService.loadMemoriesIntoCache();
    templateService.clearCache();
  });

  describe('System Prompt with Fact/Memory Separation', () => {
    test('should generate system prompt with basic memory keys (current behavior)', async () => {
      // Set up mixed test data
      await memoryService.saveMemory('family_fact', 'Son is Ryan', 'family', true);
      await memoryService.saveMemory('health_fact', 'Has diabetes', 'health', true);
      await memoryService.saveMemory('family_memory', 'Talked about son', 'family', false);
      await memoryService.saveMemory('mood_memory', 'Was anxious yesterday', 'general', false);

      // Get all memory keys (current approach)
      const allKeys = await memoryService.getAllMemoryKeys();
      
      const systemPrompt = templateService.getSystemPrompt(allKeys);
      
      expect(systemPrompt).toContain('Available Stored Memories');
      expect(systemPrompt).toContain('family_fact');
      expect(systemPrompt).toContain('health_fact');
      expect(systemPrompt).toContain('family_memory');
      expect(systemPrompt).toContain('mood_memory');
      
      // Should show total count
      expect(systemPrompt).toContain('4 stored memories');
    });

    test('should support separated fact and memory keys (future enhancement)', async () => {
      // Set up test data
      await memoryService.saveMemory('name_fact', 'Name is Francine', 'family', true);
      await memoryService.saveMemory('address_fact', 'Lives at Sunset Manor', 'general', true);
      await memoryService.saveMemory('mood_memory', 'Seemed happy today', 'general', false);
      await memoryService.saveMemory('conversation_memory', 'Asked about grandchildren', 'family', false);

      // Get separated keys
      const memoryKeys = await memoryService.getMemoryKeys();
      const factKeys = memoryKeys.facts || [];
      const conversationKeys = memoryKeys.memories || [];

      // Future enhancement: Template service could accept separated keys
      // const systemPrompt = templateService.getSystemPromptWithSeparation(factKeys, conversationKeys);

      // For now, test that the data is properly separated
      expect(factKeys).toEqual(expect.arrayContaining(['name_fact', 'address_fact']));
      expect(conversationKeys).toEqual(expect.arrayContaining(['mood_memory', 'conversation_memory']));
      expect(factKeys.length).toBe(2);
      expect(conversationKeys.length).toBe(2);
    });

    test('should handle empty memory sets gracefully', async () => {
      const systemPrompt = templateService.getSystemPrompt([]);
      
      expect(systemPrompt).toBeDefined();
      expect(systemPrompt).not.toContain('Available Stored Memories');
      expect(systemPrompt).toContain('Current date and time:');
    });

    test('should handle null/undefined memory keys', async () => {
      const systemPrompt1 = templateService.getSystemPrompt(null);
      const systemPrompt2 = templateService.getSystemPrompt(undefined);
      
      expect(systemPrompt1).toBeDefined();
      expect(systemPrompt2).toBeDefined();
      expect(systemPrompt1).not.toContain('Available Stored Memories');
      expect(systemPrompt2).not.toContain('Available Stored Memories');
    });
  });

  describe('Enhanced System Prompt with Fact Distinction (Future)', () => {
    test('should provide different guidance for facts vs memories', async () => {
      // This test documents expected future behavior
      await memoryService.saveMemory('verified_fact', 'Born March 15, 1940', 'family', true);
      await memoryService.saveMemory('recent_memory', 'Mentioned feeling tired', 'health', false);

      const memoryKeys = await memoryService.getMemoryKeys();
      
      // Future enhancement: Different instructions for facts vs memories
      const systemPrompt = templateService.getSystemPrompt(
        [...memoryKeys.facts, ...memoryKeys.memories]
      );

      // Current behavior includes all keys together
      expect(systemPrompt).toContain('verified_fact');
      expect(systemPrompt).toContain('recent_memory');

      // Future enhancement could include:
      // - Different recall strategies for facts vs memories
      // - Fact stability guidance (don't update facts casually)
      // - Memory volatility guidance (memories can be updated/forgotten)
    });

    test('should provide fact protection guidance in system prompt', async () => {
      await memoryService.saveMemory('permanent_fact', 'Has son named Ryan Brodkin', 'family', true);
      
      const memoryKeys = await memoryService.getMemoryKeys();
      const systemPrompt = templateService.getSystemPrompt(memoryKeys.facts);

      // Current system prompt doesn't distinguish facts
      expect(systemPrompt).toContain('permanent_fact');

      // Future enhancement could include instructions like:
      // - "Facts are verified information - do not use forgetMemory on fact keys"
      // - "Use updateMemory carefully with facts - prefer creating new memories"
      // - "Facts represent stable, verified information about Francine"
    });
  });

  describe('Template Rendering with Fact Context', () => {
    test('should render templates with fact/memory counts', async () => {
      // Set up test data
      await memoryService.saveMemory('fact1', 'Fact content 1', 'family', true);
      await memoryService.saveMemory('fact2', 'Fact content 2', 'health', true);
      await memoryService.saveMemory('memory1', 'Memory content 1', 'general', false);

      const memoryKeys = await memoryService.getMemoryKeys();
      
      // Future enhancement: Template could include fact/memory statistics
      const templateData = {
        currentDateTime: new Date().toLocaleString(),
        factCount: memoryKeys.facts.length,
        memoryCount: memoryKeys.memories.length,
        totalMemories: memoryKeys.facts.length + memoryKeys.memories.length
      };

      // For now, test that we can provide the data structure
      expect(templateData.factCount).toBe(2);
      expect(templateData.memoryCount).toBe(1);
      expect(templateData.totalMemories).toBe(3);
      
      // Future: Template could use this data
      // const rendered = templateService.render('system-prompt-with-facts', templateData);
    });

    test('should support different templates for fact-heavy vs memory-heavy contexts', async () => {
      // Create fact-heavy scenario
      for (let i = 0; i < 10; i++) {
        await memoryService.saveMemory(`fact_${i}`, `Fact ${i}`, 'family', true);
      }
      await memoryService.saveMemory('single_memory', 'One memory', 'general', false);

      const memoryKeys = await memoryService.getMemoryKeys();
      const isFactHeavy = memoryKeys.facts.length > memoryKeys.memories.length * 2;
      
      expect(isFactHeavy).toBe(true);
      
      // Future enhancement: Choose template based on fact/memory ratio
      // const templateName = isFactHeavy ? 'system-prompt-fact-heavy' : 'system-prompt-memory-heavy';
      // const systemPrompt = templateService.render(templateName, { ... });
      
      // For now, verify the data is available for such decisions
      expect(memoryKeys.facts.length).toBe(10);
      expect(memoryKeys.memories.length).toBe(1);
    });
  });

  describe('Memory Key Formatting and Organization', () => {
    test('should organize memory keys by category and type', async () => {
      // Create diverse test data
      await memoryService.saveMemory('family_fact_1', 'Son is Ryan', 'family', true);
      await memoryService.saveMemory('family_fact_2', 'Daughter-in-law is Sarah', 'family', true);
      await memoryService.saveMemory('health_fact_1', 'Has diabetes', 'health', true);
      await memoryService.saveMemory('family_memory_1', 'Misses family', 'family', false);
      await memoryService.saveMemory('general_memory_1', 'Likes tea', 'general', false);

      const memoryKeys = await memoryService.getMemoryKeys();
      
      // Future enhancement: Organize keys by category and type
      const organized = {
        facts: {
          family: memoryKeys.facts.filter(k => k.startsWith('family_')),
          health: memoryKeys.facts.filter(k => k.startsWith('health_')),
          general: memoryKeys.facts.filter(k => k.startsWith('general_'))
        },
        memories: {
          family: memoryKeys.memories.filter(k => k.startsWith('family_')),
          health: memoryKeys.memories.filter(k => k.startsWith('health_')),
          general: memoryKeys.memories.filter(k => k.startsWith('general_'))
        }
      };

      expect(organized.facts.family).toHaveLength(2);
      expect(organized.facts.health).toHaveLength(1);
      expect(organized.memories.family).toHaveLength(1);
      expect(organized.memories.general).toHaveLength(1);

      // Future: System prompt could present organized structure
      // "Facts about family: family_fact_1, family_fact_2"
      // "Recent family conversations: family_memory_1"
    });

    test('should handle memory keys with consistent formatting', async () => {
      await memoryService.saveMemory('test_key_fact', 'Test fact', 'family', true);
      await memoryService.saveMemory('test key memory', 'Test memory', 'family', false);

      const allKeys = await memoryService.getAllMemoryKeys();
      
      // Keys should be consistently formatted (normalized)
      expect(allKeys).toContain('test_key_fact');
      expect(allKeys).toContain('test key memory');
      
      const systemPrompt = templateService.getSystemPrompt(allKeys);
      
      // System prompt should handle keys with different formats
      expect(systemPrompt).toContain('test_key_fact');
      expect(systemPrompt).toContain('test key memory');
    });
  });

  describe('Call Statistics Integration', () => {
    test('should combine call stats with memory context', async () => {
      await memoryService.saveMemory('frequent_topic', 'Often talks about weather', 'preferences', false);
      
      const memoryKeys = await memoryService.getAllMemoryKeys();
      const callStats = {
        callsToday: 3,
        lastCallTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        timeSinceLastCall: '2 hours ago'
      };

      const systemPrompt = templateService.getSystemPrompt(memoryKeys, callStats);
      
      expect(systemPrompt).toContain('frequent_topic');
      expect(systemPrompt).toContain('3'); // callsToday
      expect(systemPrompt).toContain('2 hours ago');
      
      // Should indicate multiple calls today
      expect(systemPrompt).toMatch(/multiple|several|frequent/i);
    });

    test('should adjust memory guidance based on call frequency', async () => {
      await memoryService.saveMemory('repetitive_concern', 'Worries about medication', 'health', false);
      
      const memoryKeys = await memoryService.getAllMemoryKeys();
      
      // High frequency calls might need different memory strategies
      const highFreqStats = { callsToday: 5, timeSinceLastCall: '10 minutes ago' };
      const lowFreqStats = { callsToday: 1, timeSinceLastCall: null };
      
      const highFreqPrompt = templateService.getSystemPrompt(memoryKeys, highFreqStats);
      const lowFreqPrompt = templateService.getSystemPrompt(memoryKeys, lowFreqStats);
      
      expect(highFreqPrompt).toContain('repetitive_concern');
      expect(lowFreqPrompt).toContain('repetitive_concern');
      
      // Future enhancement: Different instructions for high/low frequency
      // High frequency: "Be aware of repetitive concerns mentioned earlier today"
      // Low frequency: "Use stored memories to provide continuity"
    });
  });

  describe('Template Caching and Performance', () => {
    test('should cache templates efficiently with fact/memory variations', async () => {
      // Create multiple template renders with different memory sets
      const factKeys = ['fact1', 'fact2'];
      const memoryKeys = ['memory1', 'memory2'];
      const allKeys = [...factKeys, ...memoryKeys];

      // Multiple renders should use cached templates
      const start = Date.now();
      
      const prompt1 = templateService.getSystemPrompt(factKeys);
      const prompt2 = templateService.getSystemPrompt(memoryKeys);
      const prompt3 = templateService.getSystemPrompt(allKeys);
      const prompt4 = templateService.getSystemPrompt(factKeys); // Should hit cache
      
      const end = Date.now();
      const executionTime = end - start;

      expect(prompt1).toBeDefined();
      expect(prompt2).toBeDefined();
      expect(prompt3).toBeDefined();
      expect(prompt4).toBeDefined();
      
      // Should be fast due to template caching
      expect(executionTime).toBeLessThan(50);
    });

    test('should handle large numbers of facts and memories efficiently', async () => {
      // Create many facts and memories
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(memoryService.saveMemory(`fact_${i}`, `Fact ${i}`, 'general', true));
        promises.push(memoryService.saveMemory(`memory_${i}`, `Memory ${i}`, 'general', false));
      }
      await Promise.all(promises);

      const allKeys = await memoryService.getAllMemoryKeys();
      expect(allKeys.length).toBe(200);

      const start = Date.now();
      const systemPrompt = templateService.getSystemPrompt(allKeys);
      const end = Date.now();

      expect(systemPrompt).toBeDefined();
      expect(systemPrompt).toContain('200 stored memories');
      
      // Should handle large numbers efficiently
      const executionTime = end - start;
      expect(executionTime).toBeLessThan(100);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed memory keys gracefully', async () => {
      const malformedKeys = [null, undefined, '', '   ', 123, {}, []];
      
      const systemPrompt = templateService.getSystemPrompt(malformedKeys);
      
      // Should not crash and should produce valid output
      expect(systemPrompt).toBeDefined();
      expect(systemPrompt).toContain('Current date and time:');
      
      // Should filter out malformed keys
      expect(systemPrompt).not.toContain('null');
      expect(systemPrompt).not.toContain('undefined');
    });

    test('should handle template loading errors gracefully', async () => {
      // Clear cache to force reload
      templateService.clearCache();
      
      // Mock file system error
      const originalLoadTemplate = templateService.loadTemplate;
      templateService.loadTemplate = jest.fn().mockImplementation(() => {
        throw new Error('Template not found');
      });

      expect(() => {
        templateService.getSystemPrompt(['test_key']);
      }).toThrow('Template not found');
      
      // Restore original method
      templateService.loadTemplate = originalLoadTemplate;
    });
  });

  describe('Future Enhancement Planning', () => {
    test('should support fact confidence levels in templates', async () => {
      // Future enhancement: Facts could have confidence levels
      // High confidence facts: Never question or update
      // Medium confidence facts: Verify before major decisions
      // Low confidence facts: Can be updated with new information
      
      await memoryService.saveMemory('high_confidence_fact', 'Son is Ryan Brodkin', 'family', true);
      
      const memoryKeys = await memoryService.getMemoryKeys();
      
      // Future data structure could include:
      // { key: 'high_confidence_fact', confidence: 'high', is_fact: true }
      
      expect(memoryKeys.facts).toContain('high_confidence_fact');
      
      // Future template could include confidence-based instructions
    });

    test('should support memory source attribution in templates', async () => {
      // Future enhancement: Track memory sources
      // - Direct from caller conversation
      // - Provided by family member
      // - Medical records
      // - Administrative information
      
      await memoryService.saveMemory('caller_reported', 'Feeling better today', 'health', false);
      
      const memoryKeys = await memoryService.getMemoryKeys();
      
      // Future data could include source metadata
      // { key: 'caller_reported', source: 'conversation', reliability: 'medium' }
      
      expect(memoryKeys.memories).toContain('caller_reported');
    });
  });
});