const SqliteStorageService = require('../services/sqlite-storage-service');
const DatabaseManager = require('../services/database-manager');

describe('Message Persistence', () => {
  let storageService;
  let dbManager;

  beforeEach(() => {
    // Create fresh in-memory database for each test
    dbManager = new DatabaseManager(':memory:');
    storageService = new SqliteStorageService(dbManager);
  });

  afterEach(() => {
    if (dbManager) {
      dbManager.close();
    }
  });

  describe('saveMessages', () => {
    test('should save conversation messages to database', async () => {
      // First, create a conversation with summary
      const mockSummary = {
        callSid: 'test-call-messages-1',
        startTime: '2024-01-15T14:30:00Z',
        endTime: '2024-01-15T14:35:00Z',
        callMetadata: { duration: 300 },
        conversationMetrics: {},
        mentalStateIndicators: {},
        careIndicators: {},
        behavioralPatterns: {},
        clinicalObservations: {},
        supportEffectiveness: {},
        caregiverInsights: {}
      };

      const result = await storageService.saveSummary(mockSummary);
      const _conversationId = result.conversationId;
      const numericId = result.numericId;

      const messages = [
        {
          role: 'user',
          content: 'Hello, how are you?',
          timestamp: '2024-01-15T14:30:15Z'
        },
        {
          role: 'assistant', 
          content: 'Hi Francine! I\'m doing well, thank you for asking. How are you feeling today?',
          timestamp: '2024-01-15T14:30:20Z'
        },
        {
          role: 'user',
          content: 'I\'m feeling a bit worried about my medication.',
          timestamp: '2024-01-15T14:31:00Z'
        },
        {
          role: 'assistant',
          content: 'I understand you might be concerned about your medication. Can you tell me what specifically is worrying you?',
          timestamp: '2024-01-15T14:31:05Z'
        }
      ];

      await storageService.saveMessages(numericId, messages);

      // Verify messages were saved by querying directly
      const savedMessages = await dbManager.all(
        'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
        [numericId]
      );

      expect(savedMessages).toHaveLength(4);
      expect(savedMessages[0].role).toBe('user');
      expect(savedMessages[0].content).toBe('Hello, how are you?');
      expect(savedMessages[0].timestamp).toBe('2024-01-15T14:30:15Z');
      expect(savedMessages[1].role).toBe('assistant');
      expect(savedMessages[3].content).toContain('Can you tell me what specifically');
    });

    test('should handle empty messages array gracefully', async () => {
      const mockSummary = {
        callSid: 'test-call-empty-messages',
        startTime: '2024-01-15T14:30:00Z',
        endTime: '2024-01-15T14:35:00Z',
        callMetadata: { duration: 300 },
        conversationMetrics: {},
        mentalStateIndicators: {},
        careIndicators: {},
        behavioralPatterns: {},
        clinicalObservations: {},
        supportEffectiveness: {},
        caregiverInsights: {}
      };

      const result = await storageService.saveSummary(mockSummary);
      const _conversationId = result.conversationId;
      const numericId = result.numericId;

      await storageService.saveMessages(numericId, []);

      const savedMessages = await dbManager.all(
        'SELECT * FROM messages WHERE conversation_id = ?',
        [numericId]
      );

      expect(savedMessages).toHaveLength(0);
    });

    test('should handle batch inserts efficiently', async () => {
      const mockSummary = {
        callSid: 'test-call-batch-messages',
        startTime: '2024-01-15T14:30:00Z',
        endTime: '2024-01-15T14:35:00Z',
        callMetadata: { duration: 300 },
        conversationMetrics: {},
        mentalStateIndicators: {},
        careIndicators: {},
        behavioralPatterns: {},
        clinicalObservations: {},
        supportEffectiveness: {},
        caregiverInsights: {}
      };

      const result = await storageService.saveSummary(mockSummary);
      const _conversationId = result.conversationId;
      const numericId = result.numericId;

      // Generate large batch of messages
      const messages = [];
      for (let i = 0; i < 50; i++) {
        messages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i + 1}`,
          timestamp: new Date(2024, 0, 15, 14, 30 + i, 0).toISOString()
        });
      }

      const start = Date.now();
      await storageService.saveMessages(numericId, messages);
      const duration = Date.now() - start;

      // Should complete batch insert quickly
      expect(duration).toBeLessThan(200);

      const savedMessages = await dbManager.all(
        'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?',
        [numericId]
      );

      expect(savedMessages[0].count).toBe(50);
    });

    test('should validate message structure', async () => {
      const mockSummary = {
        callSid: 'test-call-validation',
        startTime: '2024-01-15T14:30:00Z',
        endTime: '2024-01-15T14:35:00Z',
        callMetadata: { duration: 300 },
        conversationMetrics: {},
        mentalStateIndicators: {},
        careIndicators: {},
        behavioralPatterns: {},
        clinicalObservations: {},
        supportEffectiveness: {},
        caregiverInsights: {}
      };

      const result = await storageService.saveSummary(mockSummary);
      const _conversationId = result.conversationId;
      const numericId = result.numericId;

      const invalidMessages = [
        {
          role: 'invalid_role', // Invalid role
          content: 'Test message',
          timestamp: '2024-01-15T14:30:15Z'
        }
      ];

      await expect(storageService.saveMessages(numericId, invalidMessages))
        .rejects
        .toThrow();
    });

    test('should use transactions for data consistency', async () => {
      const mockSummary = {
        callSid: 'test-call-transaction',
        startTime: '2024-01-15T14:30:00Z',
        endTime: '2024-01-15T14:35:00Z',
        callMetadata: { duration: 300 },
        conversationMetrics: {},
        mentalStateIndicators: {},
        careIndicators: {},
        behavioralPatterns: {},
        clinicalObservations: {},
        supportEffectiveness: {},
        caregiverInsights: {}
      };

      const result = await storageService.saveSummary(mockSummary);
      const _conversationId = result.conversationId;
      const numericId = result.numericId;

      const messages = [
        {
          role: 'user',
          content: 'Valid message 1',
          timestamp: '2024-01-15T14:30:15Z'
        },
        {
          role: 'assistant',
          content: 'Valid message 2',
          timestamp: '2024-01-15T14:30:20Z'
        },
        {
          role: 'invalid_role', // This will cause transaction to fail
          content: 'Invalid message',
          timestamp: '2024-01-15T14:30:25Z'
        }
      ];

      await expect(storageService.saveMessages(numericId, messages))
        .rejects
        .toThrow();

      // Verify no messages were saved due to transaction rollback
      const savedMessages = await dbManager.all(
        'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?',
        [numericId]
      );

      expect(savedMessages[0].count).toBe(0);
    });
  });

  describe('loadMessages', () => {
    test('should load conversation messages from database', async () => {
      // Setup: create conversation and save messages
      const mockSummary = {
        callSid: 'test-call-load-1',
        startTime: '2024-01-15T14:30:00Z',
        endTime: '2024-01-15T14:35:00Z',
        callMetadata: { duration: 300 },
        conversationMetrics: {},
        mentalStateIndicators: {},
        careIndicators: {},
        behavioralPatterns: {},
        clinicalObservations: {},
        supportEffectiveness: {},
        caregiverInsights: {}
      };

      const result = await storageService.saveSummary(mockSummary);
      const _conversationId = result.conversationId;
      const numericId = result.numericId;

      const originalMessages = [
        {
          role: 'user',
          content: 'How are you doing today?',
          timestamp: '2024-01-15T14:30:15Z'
        },
        {
          role: 'assistant',
          content: 'I\'m doing well, thank you! How about you?',
          timestamp: '2024-01-15T14:30:20Z'
        },
        {
          role: 'user',
          content: 'I\'m feeling good today.',
          timestamp: '2024-01-15T14:31:00Z'
        }
      ];

      await storageService.saveMessages(numericId, originalMessages);

      // Test: load messages back
      const loadedMessages = await storageService.loadMessages(_conversationId);

      expect(loadedMessages).toHaveLength(3);
      expect(loadedMessages[0].role).toBe('user');
      expect(loadedMessages[0].content).toBe('How are you doing today?');
      expect(loadedMessages[0].timestamp).toBe('2024-01-15T14:30:15Z');
      expect(loadedMessages[1].role).toBe('assistant');
      expect(loadedMessages[2].content).toBe('I\'m feeling good today.');
    });

    test('should return empty array for conversation with no messages', async () => {
      const mockSummary = {
        callSid: 'test-call-no-messages',
        startTime: '2024-01-15T14:30:00Z',
        endTime: '2024-01-15T14:35:00Z',
        callMetadata: { duration: 300 },
        conversationMetrics: {},
        mentalStateIndicators: {},
        careIndicators: {},
        behavioralPatterns: {},
        clinicalObservations: {},
        supportEffectiveness: {},
        caregiverInsights: {}
      };

      const result = await storageService.saveSummary(mockSummary);

      const messages = await storageService.loadMessages(result.conversationId);

      expect(messages).toHaveLength(0);
      expect(Array.isArray(messages)).toBe(true);
    });

    test('should throw error for invalid conversation ID', async () => {
      await expect(storageService.loadMessages('conversation-999999'))
        .rejects
        .toThrow('Conversation not found');
    });

    test('should throw error for malformed conversation ID', async () => {
      await expect(storageService.loadMessages('invalid-id'))
        .rejects
        .toThrow('Invalid conversation ID format');
    });

    test('should return messages in chronological order', async () => {
      const mockSummary = {
        callSid: 'test-call-order',
        startTime: '2024-01-15T14:30:00Z',
        endTime: '2024-01-15T14:35:00Z',
        callMetadata: { duration: 300 },
        conversationMetrics: {},
        mentalStateIndicators: {},
        careIndicators: {},
        behavioralPatterns: {},
        clinicalObservations: {},
        supportEffectiveness: {},
        caregiverInsights: {}
      };

      const result = await storageService.saveSummary(mockSummary);
      const _conversationId = result.conversationId;
      const numericId = result.numericId;

      // Insert messages in non-chronological order
      const messagesOutOfOrder = [
        {
          role: 'user',
          content: 'Third message',
          timestamp: '2024-01-15T14:32:00Z'
        },
        {
          role: 'user',
          content: 'First message',
          timestamp: '2024-01-15T14:30:15Z'
        },
        {
          role: 'assistant',
          content: 'Second message',
          timestamp: '2024-01-15T14:31:00Z'
        }
      ];

      await storageService.saveMessages(numericId, messagesOutOfOrder);

      const loadedMessages = await storageService.loadMessages(_conversationId);

      expect(loadedMessages).toHaveLength(3);
      expect(loadedMessages[0].content).toBe('First message');
      expect(loadedMessages[1].content).toBe('Second message');
      expect(loadedMessages[2].content).toBe('Third message');
    });
  });

  describe('integration with saveSummary', () => {
    test('saveSummary should return conversation ID that can be used for messages', async () => {
      const mockSummary = {
        callSid: 'test-integration-1',
        startTime: '2024-01-15T14:30:00Z',
        endTime: '2024-01-15T14:35:00Z',
        callMetadata: { duration: 300 },
        conversationMetrics: {},
        mentalStateIndicators: {},
        careIndicators: {},
        behavioralPatterns: {},
        clinicalObservations: {},
        supportEffectiveness: {},
        caregiverInsights: {}
      };

      const result = await storageService.saveSummary(mockSummary);
      
      // Conversation ID should be in the expected format
      expect(result.conversationId).toMatch(/^conversation-\d+$/);
      expect(typeof result.numericId).toBe('number');
      expect(result.numericId).toBeGreaterThan(0);

      const messages = [
        {
          role: 'user',
          content: 'Test integration message',
          timestamp: '2024-01-15T14:30:15Z'
        }
      ];

      // Should not throw error  
      await expect(storageService.saveMessages(result.numericId, messages))
        .resolves
        .not
        .toThrow();
    });

    test('should maintain referential integrity between conversations and messages', async () => {
      const mockSummary = {
        callSid: 'test-integrity-1',
        startTime: '2024-01-15T14:30:00Z',
        endTime: '2024-01-15T14:35:00Z',
        callMetadata: { duration: 300 },
        conversationMetrics: {},
        mentalStateIndicators: {},
        careIndicators: {},
        behavioralPatterns: {},
        clinicalObservations: {},
        supportEffectiveness: {},
        caregiverInsights: {}
      };

      const result = await storageService.saveSummary(mockSummary);
      const _conversationId = result.conversationId;
      const numericId = result.numericId;

      const messages = [
        {
          role: 'user',
          content: 'Test message',
          timestamp: '2024-01-15T14:30:15Z'
        }
      ];

      await storageService.saveMessages(numericId, messages);

      // Verify foreign key relationship exists
      const queryResult = await dbManager.get(`
        SELECT c.call_sid, m.content 
        FROM conversations c
        JOIN messages m ON c.id = m.conversation_id
        WHERE c.id = ?
      `, [numericId]);

      expect(queryResult).toBeDefined();
      expect(queryResult.call_sid).toBe('test-integrity-1');
      expect(queryResult.content).toBe('Test message');
    });
  });

  describe('performance', () => {
    test('should save messages in under 200ms', async () => {
      const mockSummary = {
        callSid: 'perf-test-messages',
        startTime: '2024-01-15T14:30:00Z',
        endTime: '2024-01-15T14:35:00Z',
        callMetadata: { duration: 300 },
        conversationMetrics: {},
        mentalStateIndicators: {},
        careIndicators: {},
        behavioralPatterns: {},
        clinicalObservations: {},
        supportEffectiveness: {},
        caregiverInsights: {}
      };

      const result = await storageService.saveSummary(mockSummary);
      const _conversationId = result.conversationId;
      const numericId = result.numericId;

      const messages = [];
      for (let i = 0; i < 20; i++) {
        messages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Performance test message ${i + 1}`,
          timestamp: new Date(2024, 0, 15, 14, 30 + i, 0).toISOString()
        });
      }

      const start = Date.now();
      await storageService.saveMessages(numericId, messages);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200);
    });

    test('should load messages in under 100ms', async () => {
      const mockSummary = {
        callSid: 'perf-load-messages',
        startTime: '2024-01-15T14:30:00Z',
        endTime: '2024-01-15T14:35:00Z',
        callMetadata: { duration: 300 },
        conversationMetrics: {},
        mentalStateIndicators: {},
        careIndicators: {},
        behavioralPatterns: {},
        clinicalObservations: {},
        supportEffectiveness: {},
        caregiverInsights: {}
      };

      const result = await storageService.saveSummary(mockSummary);
      const _conversationId = result.conversationId;
      const numericId = result.numericId;

      // Setup test data
      const messages = [];
      for (let i = 0; i < 20; i++) {
        messages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Load performance test message ${i + 1}`,
          timestamp: new Date(2024, 0, 15, 14, 30 + i, 0).toISOString()
        });
      }
      await storageService.saveMessages(numericId, messages);

      // Test load performance
      const start = Date.now();
      const loadedMessages = await storageService.loadMessages(_conversationId);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
      expect(loadedMessages).toHaveLength(20);
    });
  });
});