/**
 * Test suite for preventing duplicate message storage
 * 
 * This test reproduces the bug where messages are stored twice in the database
 * with timestamps only milliseconds apart, causing duplicate entries in
 * conversation transcripts.
 */

const DatabaseManager = require('../services/database-manager');
const SqliteStorageService = require('../services/sqlite-storage-service');
const ConversationAnalyzer = require('../services/conversation-analyzer');

describe('Duplicate Message Prevention', () => {
  let dbManager;
  let storageService;
  let conversationAnalyzer;

  beforeEach(async () => {
    // Create a fresh in-memory database for each test
    dbManager = new DatabaseManager(':memory:');
    await dbManager.waitForInitialization();
    storageService = new SqliteStorageService(dbManager);
    
    // Create conversation analyzer
    conversationAnalyzer = new ConversationAnalyzer('test-call-123', new Date());
  });

  afterEach(async () => {
    if (dbManager) {
      await dbManager.close();
    }
  });

  describe('Message Storage Deduplication', () => {
    test('should store each message only once when saving conversation', async () => {
      // Simulate a short conversation that gets tracked by conversation analyzer
      const startTime = new Date('2025-08-16T07:34:27.000Z');
      
      // Simulate user saying "Hello" 
      conversationAnalyzer.trackUserUtterance('Hello', startTime);
      
      // Simulate assistant responding "Hi there!"
      const responseTime = new Date('2025-08-16T07:34:28.000Z');
      conversationAnalyzer.trackAssistantResponse('Hi there!', responseTime);
      
      // Create a conversation summary (like what happens in app.js and chat-session.js)
      const summary = {
        callSid: 'test-call-123',
        startTime: startTime.toISOString(),
        endTime: new Date().toISOString(),
        callMetadata: { duration: 30 }
      };
      
      // Save the summary and get conversation ID
      const result = await storageService.saveSummary(summary);
      const numericId = result.numericId;
      
      // Extract messages from conversation analyzer (replicating the bug)
      const messages = [];
      
      // Add user utterances
      conversationAnalyzer.userUtterances.forEach(utterance => {
        messages.push({
          role: 'user',
          content: utterance.text,
          timestamp: utterance.timestamp.toISOString()
        });
      });
      
      // Add assistant responses  
      conversationAnalyzer.assistantResponses.forEach(response => {
        messages.push({
          role: 'assistant',
          content: response.text,
          timestamp: response.timestamp.toISOString()
        });
      });
      
      // Sort by timestamp
      messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // Save messages once
      await storageService.saveMessages(numericId, messages);
      
      // Load messages back from database
      const savedMessages = await storageService.loadMessages(result.conversationId);
      
      // Should have exactly 2 messages (1 user, 1 assistant)
      expect(savedMessages).toHaveLength(2);
      
      // Verify no duplicates by checking unique content
      const uniqueContent = new Set(savedMessages.map(m => m.content));
      expect(uniqueContent.size).toBe(2);
      expect(uniqueContent.has('Hello')).toBe(true);
      expect(uniqueContent.has('Hi there!')).toBe(true);
    });

    test('should prevent duplicate messages when saveMessages is called multiple times', async () => {
      const startTime = new Date('2025-08-16T07:34:27.754Z');
      const message1Time = new Date('2025-08-16T07:34:27.754Z');
      const message2Time = new Date('2025-08-16T07:34:27.756Z'); // Very close timestamp
      
      const summary = {
        callSid: 'test-call-duplicate',
        startTime: startTime.toISOString(),
        endTime: new Date().toISOString(),
        callMetadata: { duration: 30 }
      };
      
      const result = await storageService.saveSummary(summary);
      const numericId = result.numericId;
      
      // First set of messages (what might be saved from one source)
      const messages1 = [
        {
          role: 'user',
          content: 'Hello',
          timestamp: message1Time.toISOString()
        },
        {
          role: 'assistant', 
          content: 'Hi there!',
          timestamp: message2Time.toISOString()
        }
      ];
      
      // Second set with same content but slightly different timestamps (the bug)
      const duplicateTime1 = new Date('2025-08-16T07:34:27.756Z');
      const duplicateTime2 = new Date('2025-08-16T07:34:27.758Z');
      const messages2 = [
        {
          role: 'user',
          content: 'Hello', // Same content
          timestamp: duplicateTime1.toISOString()
        },
        {
          role: 'assistant',
          content: 'Hi there!', // Same content
          timestamp: duplicateTime2.toISOString()
        }
      ];
      
      // Save first batch
      await storageService.saveMessages(numericId, messages1);
      
      // Save second batch (simulating the duplicate storage bug)
      await storageService.saveMessages(numericId, messages2);
      
      // Load messages back
      const savedMessages = await storageService.loadMessages(result.conversationId);
      
      // Should have only 2 unique messages, not 4
      expect(savedMessages).toHaveLength(2);
      
      // Verify content uniqueness 
      const contentCounts = {};
      savedMessages.forEach(msg => {
        contentCounts[msg.content] = (contentCounts[msg.content] || 0) + 1;
      });
      
      expect(contentCounts['Hello']).toBe(1);
      expect(contentCounts['Hi there!']).toBe(1);
    });

    test('should handle rapid successive message saving without duplicates', async () => {
      const summary = {
        callSid: 'test-call-rapid',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        callMetadata: { duration: 30 }
      };
      
      const result = await storageService.saveSummary(summary);
      const numericId = result.numericId;
      
      const baseTime = new Date('2025-08-16T07:34:27.750Z');
      
      // Create messages that might be saved by multiple services simultaneously
      const commonMessages = [
        {
          role: 'user',
          content: 'How are you?',
          timestamp: new Date(baseTime.getTime()).toISOString()
        },
        {
          role: 'assistant',
          content: 'I am doing well, thank you!',
          timestamp: new Date(baseTime.getTime() + 1000).toISOString()
        }
      ];
      
      // Simulate multiple rapid saves (race condition scenario)
      const savePromises = [];
      for (let i = 0; i < 3; i++) {
        savePromises.push(storageService.saveMessages(numericId, commonMessages));
      }
      
      // Wait for all saves to complete
      await Promise.all(savePromises);
      
      // Should still have only 2 messages
      const savedMessages = await storageService.loadMessages(result.conversationId);
      expect(savedMessages).toHaveLength(2);
      
      // Check for unique content
      const uniqueContent = new Set(savedMessages.map(m => m.content));
      expect(uniqueContent.size).toBe(2);
    });

    test('should prevent function call + GPT response duplicates', async () => {
      // This test verifies the fix for the bug where both function "say" messages 
      // and GPT responses get tracked, creating duplicates in the conversation
      
      const summary = {
        callSid: 'test-call-function-bug',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        callMetadata: { duration: 30 }
      };
      
      const result = await storageService.saveSummary(summary);
      const numericId = result.numericId;
      
      // Simulate the scenario: function call tracking + GPT response tracking
      const baseTime = new Date('2025-08-16T07:34:27.754Z');
      
      // User asks for news
      conversationAnalyzer.trackUserUtterance('Can you tell me the news?', baseTime);
      
      // Function call with "say" field gets tracked (line 200 in gpt-service.js)  
      const functionSayTime = new Date(baseTime.getTime() + 500);
      conversationAnalyzer.trackAssistantResponse('Let me get the latest news for you.', functionSayTime);
      
      // GPT streaming response also gets tracked (line 260 in gpt-service.js)
      // This should now be prevented by the deduplication logic
      const gptResponseTime = new Date(baseTime.getTime() + 502); // Just 2ms later!
      conversationAnalyzer.trackAssistantResponse('Let me get the latest news for you.', gptResponseTime);
      
      // Extract messages like the real code does
      const messages = [];
      
      conversationAnalyzer.userUtterances.forEach(utterance => {
        messages.push({
          role: 'user',
          content: utterance.text,
          timestamp: utterance.timestamp.toISOString()
        });
      });
      
      conversationAnalyzer.assistantResponses.forEach(response => {
        messages.push({
          role: 'assistant',
          content: response.text,
          timestamp: response.timestamp.toISOString()
        });
      });
      
      messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // Save messages
      await storageService.saveMessages(numericId, messages);
      
      // Load back from database
      const savedMessages = await storageService.loadMessages(result.conversationId);
      
      // Fixed behavior: should have only 2 messages (1 user + 1 unique assistant)
      expect(savedMessages).toHaveLength(2);
      
      // Verify no duplicates
      const assistantMessages = savedMessages.filter(m => m.role === 'assistant');
      expect(assistantMessages).toHaveLength(1);
      expect(assistantMessages[0].content).toBe('Let me get the latest news for you.');
      
      // Verify unique content
      const uniqueContent = new Set(savedMessages.map(m => m.content));
      expect(uniqueContent.size).toBe(2);
    });

    test('should allow similar but different responses', async () => {
      const summary = {
        callSid: 'test-call-similar',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        callMetadata: { duration: 30 }
      };
      
      const result = await storageService.saveSummary(summary);
      const numericId = result.numericId;
      
      const baseTime = new Date('2025-08-16T07:34:27.754Z');
      
      // User asks a question
      conversationAnalyzer.trackUserUtterance('How are you today?', baseTime);
      
      // First response
      const time1 = new Date(baseTime.getTime() + 500);
      conversationAnalyzer.trackAssistantResponse('I am doing well, thank you!', time1);
      
      // Different response (should be allowed)
      const time2 = new Date(baseTime.getTime() + 1000);
      conversationAnalyzer.trackAssistantResponse('I am having a great day!', time2);
      
      // Extract and save messages
      const messages = [];
      conversationAnalyzer.userUtterances.forEach(utterance => {
        messages.push({
          role: 'user',
          content: utterance.text,
          timestamp: utterance.timestamp.toISOString()
        });
      });
      
      conversationAnalyzer.assistantResponses.forEach(response => {
        messages.push({
          role: 'assistant',
          content: response.text,
          timestamp: response.timestamp.toISOString()
        });
      });
      
      messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      await storageService.saveMessages(numericId, messages);
      
      const savedMessages = await storageService.loadMessages(result.conversationId);
      
      // Should have 3 messages: 1 user + 2 different assistant responses
      expect(savedMessages).toHaveLength(3);
      
      const assistantMessages = savedMessages.filter(m => m.role === 'assistant');
      expect(assistantMessages).toHaveLength(2);
      expect(assistantMessages[0].content).toBe('I am doing well, thank you!');
      expect(assistantMessages[1].content).toBe('I am having a great day!');
    });

    test('should handle high similarity duplicates', async () => {
      const summary = {
        callSid: 'test-call-similarity',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        callMetadata: { duration: 30 }
      };
      
      const result = await storageService.saveSummary(summary);
      const numericId = result.numericId;
      
      const baseTime = new Date('2025-08-16T07:34:27.754Z');
      
      conversationAnalyzer.trackUserUtterance('Tell me about the weather', baseTime);
      
      // First response
      const time1 = new Date(baseTime.getTime() + 500);
      conversationAnalyzer.trackAssistantResponse('The weather today is sunny and warm with clear skies', time1);
      
      // Very similar response (should be filtered as duplicate)
      const time2 = new Date(baseTime.getTime() + 600);
      conversationAnalyzer.trackAssistantResponse('The weather today is sunny and warm with clear blue skies', time2);
      
      // Extract and save messages
      const messages = [];
      conversationAnalyzer.userUtterances.forEach(utterance => {
        messages.push({
          role: 'user',
          content: utterance.text,
          timestamp: utterance.timestamp.toISOString()
        });
      });
      
      conversationAnalyzer.assistantResponses.forEach(response => {
        messages.push({
          role: 'assistant',
          content: response.text,
          timestamp: response.timestamp.toISOString()
        });
      });
      
      messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      await storageService.saveMessages(numericId, messages);
      
      const savedMessages = await storageService.loadMessages(result.conversationId);
      
      // Should have only 2 messages: 1 user + 1 assistant (duplicate filtered)
      expect(savedMessages).toHaveLength(2);
      
      const assistantMessages = savedMessages.filter(m => m.role === 'assistant');
      expect(assistantMessages).toHaveLength(1);
      expect(assistantMessages[0].content).toBe('The weather today is sunny and warm with clear skies');
    });

    test('should ignore duplicates outside time window', async () => {
      const summary = {
        callSid: 'test-call-time-window',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        callMetadata: { duration: 30 }
      };
      
      const result = await storageService.saveSummary(summary);
      const numericId = result.numericId;
      
      const baseTime = new Date('2025-08-16T07:34:27.754Z');
      
      conversationAnalyzer.trackUserUtterance('Hello', baseTime);
      
      // First response
      const time1 = new Date(baseTime.getTime() + 500);
      conversationAnalyzer.trackAssistantResponse('Hello there!', time1);
      
      // Same response but 10 seconds later (outside 5-second window)
      const time2 = new Date(baseTime.getTime() + 10500);
      conversationAnalyzer.trackAssistantResponse('Hello there!', time2);
      
      // Extract and save messages
      const messages = [];
      conversationAnalyzer.userUtterances.forEach(utterance => {
        messages.push({
          role: 'user',
          content: utterance.text,
          timestamp: utterance.timestamp.toISOString()
        });
      });
      
      conversationAnalyzer.assistantResponses.forEach(response => {
        messages.push({
          role: 'assistant',
          content: response.text,
          timestamp: response.timestamp.toISOString()
        });
      });
      
      messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      await storageService.saveMessages(numericId, messages);
      
      const savedMessages = await storageService.loadMessages(result.conversationId);
      
      // Should have 3 messages: both responses allowed due to time gap
      expect(savedMessages).toHaveLength(3);
      
      const assistantMessages = savedMessages.filter(m => m.role === 'assistant');
      expect(assistantMessages).toHaveLength(2);
      expect(assistantMessages[0].content).toBe('Hello there!');
      expect(assistantMessages[1].content).toBe('Hello there!');
      
      // Verify time difference is significant
      const time1ms = new Date(assistantMessages[0].timestamp).getTime();
      const time2ms = new Date(assistantMessages[1].timestamp).getTime();
      expect(time2ms - time1ms).toBeGreaterThan(5000); // More than 5 seconds
    });
  });
});