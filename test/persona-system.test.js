const TemplateService = require('../services/template-service');
const { GptService } = require('../services/gpt-service');
const { ChatSession } = require('../services/chat-session');
const DatabaseManager = require('../services/database-manager');

// Mock dependencies
jest.mock('../services/memory-service');
jest.mock('../services/conversation-analyzer');

describe('Persona System', () => {
  let templateService;
  let testDb;
  
  beforeAll(async () => {
    // Use in-memory database for tests
    testDb = new DatabaseManager(':memory:');
    await testDb.waitForInitialization();
  });

  beforeEach(() => {
    templateService = new TemplateService();
  });

  afterEach(() => {
    templateService.clearCache();
  });

  describe('TemplateService Persona Integration', () => {
    test('should use default jessica persona', () => {
      const prompt = templateService.getSystemPrompt();
      
      // Test that Jessica persona is active
      expect(prompt).toContain('You are **Jessica**');
      expect(prompt).toContain('Northwestern Memorial Hospital'); // Hospital reference
      expect(prompt).toContain('Max'); // Pet reference
    });

    test('should handle jessica persona explicitly', () => {
      const prompt = templateService.getSystemPrompt([], null, 'jessica');
      
      // Test that Jessica persona is active when explicitly requested
      expect(prompt).toContain('You are **Jessica**');
      expect(prompt).toContain('Northwestern Memorial Hospital'); // Hospital reference
      expect(prompt).toContain('Chicago'); // Location reference
    });

    test('should handle non-jessica persona', () => {
      const prompt = templateService.getSystemPrompt([], null, 'sarah');
      
      // Should not contain Jessica-specific content
      expect(prompt).not.toContain('You are **Jessica**');
      expect(prompt).not.toContain('Northwestern Memorial Hospital');
      expect(prompt).not.toContain('golden retriever Max'); // More specific - avoid "Maximum"
      
      // Should still contain common elements
      expect(prompt).toContain('Francine'); // Patient name always present
      expect(prompt).toContain('Memory Management'); // Core functionality always present
    });

    test('should handle undefined persona as jessica default', () => {
      const prompt = templateService.getSystemPrompt([], null, undefined);
      
      expect(prompt).toContain('You are **Jessica**');
    });

    test('should handle empty string persona', () => {
      const prompt = templateService.getSystemPrompt([], null, '');
      
      // Empty string is not 'jessica', so Jessica section won't render
      expect(prompt).not.toContain('You are **Jessica**');
    });

    test('should handle case sensitivity', () => {
      const promptLower = templateService.getSystemPrompt([], null, 'jessica');
      const promptUpper = templateService.getSystemPrompt([], null, 'JESSICA');
      const promptMixed = templateService.getSystemPrompt([], null, 'Jessica');
      
      expect(promptLower).toContain('You are **Jessica**');
      expect(promptUpper).not.toContain('You are **Jessica**'); // Case sensitive
      expect(promptMixed).not.toContain('You are **Jessica**'); // Case sensitive
    });
  });

  describe('GptService Persona Integration', () => {
    test('should initialize with default jessica persona', () => {
      const mockMarkService = { on: jest.fn() };
      const gptService = new GptService(mockMarkService);
      
      expect(gptService.persona).toBe('jessica');
    });

    test('should initialize with custom persona', () => {
      const mockMarkService = { on: jest.fn() };
      const gptService = new GptService(mockMarkService, null, null, null, 'sarah');
      
      expect(gptService.persona).toBe('sarah');
    });

    test('should use persona in system prompt generation', async () => {
      const mockMarkService = { on: jest.fn() };
      const gptService = new GptService(mockMarkService, null, null, null, 'jessica');
      
      // Initialize the service (this loads the system prompt)
      await gptService.initialize();
      
      expect(gptService.systemPrompt).toContain('You are **Jessica**');
    });

    test('should use different persona in system prompt', async () => {
      const mockMarkService = { on: jest.fn() };
      const gptService = new GptService(mockMarkService, null, null, null, 'sarah');
      
      // Initialize the service
      await gptService.initialize();
      
      expect(gptService.systemPrompt).not.toContain('You are **Jessica**');
    });
  });

  describe('ChatSession Persona Integration', () => {
    test('should create chat session with default persona', () => {
      const chatSession = new ChatSession(); // Uses default debugMode=false, persona='jessica'
      
      expect(chatSession.persona).toBe('jessica');
      expect(chatSession.gptService.persona).toBe('jessica');
    });

    test('should create chat session with custom persona', () => {
      const chatSession = new ChatSession(false, 'sarah'); // debugMode=false, persona='sarah'
      
      expect(chatSession.persona).toBe('sarah');
      expect(chatSession.gptService.persona).toBe('sarah');
    });
  });

  describe('Template Conditional Logic', () => {
    test('should render Jessica-specific content only for jessica persona', () => {
      const jessicaPrompt = templateService.render('system-prompt', {
        currentDateTime: 'Test Time',
        persona: 'jessica',
        isJessica: true
      });
      
      const otherPrompt = templateService.render('system-prompt', {
        currentDateTime: 'Test Time',
        persona: 'sarah',
        isJessica: false
      });
      
      expect(jessicaPrompt).toContain('You are **Jessica**');
      expect(jessicaPrompt).toContain('Northwestern Memorial Hospital');
      expect(otherPrompt).not.toContain('You are **Jessica**');
      expect(otherPrompt).not.toContain('Northwestern Memorial Hospital');
    });

    test('should handle call frequency with persona', () => {
      const prompt = templateService.getSystemPrompt(
        [], 
        { callsToday: 3, timeSinceLastCall: '2 hours ago' }, 
        'jessica'
      );
      
      expect(prompt).toContain('You are **Jessica**');
      expect(prompt).toContain('called 3 times today');
    });

    test('should handle memory keys with persona', () => {
      const memoryKeys = ['family-info', 'health-concerns'];
      const prompt = templateService.getSystemPrompt(memoryKeys, null, 'jessica');
      
      expect(prompt).toContain('You are **Jessica**');
      expect(prompt).toContain('Available Stored Memories');
      expect(prompt).toContain('family-info');
    });
  });

  describe('Persona Parameter Validation', () => {
    test('should handle null persona', () => {
      const prompt = templateService.getSystemPrompt([], null, null);
      
      // null is not 'jessica', so Jessica section won't render
      expect(prompt).not.toContain('You are **Jessica**');
    });

    test('should handle numeric persona', () => {
      const prompt = templateService.getSystemPrompt([], null, 123);
      
      // Number is not 'jessica', so Jessica section won't render
      expect(prompt).not.toContain('You are **Jessica**');
    });

    test('should handle boolean persona', () => {
      const promptTrue = templateService.getSystemPrompt([], null, true);
      const promptFalse = templateService.getSystemPrompt([], null, false);
      
      expect(promptTrue).not.toContain('You are **Jessica**');
      expect(promptFalse).not.toContain('You are **Jessica**');
    });

    test('should handle array persona', () => {
      const prompt = templateService.getSystemPrompt([], null, ['jessica']);
      
      // Array is not 'jessica', so Jessica section won't render
      expect(prompt).not.toContain('You are **Jessica**');
    });

    test('should handle object persona', () => {
      const prompt = templateService.getSystemPrompt([], null, { name: 'jessica' });
      
      // Object is not 'jessica', so Jessica section won't render
      expect(prompt).not.toContain('You are **Jessica**');
    });
  });

  describe('Integration with Other System Components', () => {
    test('should maintain persona consistency across template service calls', () => {
      const persona = 'custom-nurse';
      
      // Multiple calls should maintain the same persona behavior
      const prompt1 = templateService.getSystemPrompt([], null, persona);
      const prompt2 = templateService.getSystemPrompt(['memory1'], null, persona);
      const prompt3 = templateService.getSystemPrompt([], { callsToday: 1 }, persona);
      
      // All should consistently not contain Jessica
      expect(prompt1).not.toContain('You are **Jessica**');
      expect(prompt2).not.toContain('You are **Jessica**');
      expect(prompt3).not.toContain('You are **Jessica**');
      
      // All should contain core content
      expect(prompt1).toContain('Francine');
      expect(prompt2).toContain('Francine');
      expect(prompt3).toContain('Francine');
    });

    test('should work with template caching', () => {
      // Load template with caching
      const result1 = templateService.render('system-prompt', {
        currentDateTime: 'Test Time',
        isJessica: true
      });
      
      // Load again (should use cache)
      const result2 = templateService.render('system-prompt', {
        currentDateTime: 'Different Time',
        isJessica: false
      });
      
      expect(result1).toContain('You are **Jessica**');
      expect(result2).not.toContain('You are **Jessica**');
    });
  });
});