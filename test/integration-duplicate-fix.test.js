/**
 * Integration test to verify duplicate message fix works in real service scenarios
 */

const GptService = require('../services/gpt-service');
const ConversationAnalyzer = require('../services/conversation-analyzer');
const DatabaseManager = require('../services/database-manager');
const SqliteStorageService = require('../services/sqlite-storage-service');

// Mock OpenAI since we don't need real API calls for this test
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }));
});

describe('Integration Test: Duplicate Message Fix', () => {
  let dbManager;
  let storageService;
  let conversationAnalyzer;
  let mockMarkCompletionService;

  beforeEach(async () => {
    // Create fresh in-memory database
    dbManager = new DatabaseManager(':memory:');
    await dbManager.waitForInitialization();
    storageService = new SqliteStorageService(dbManager);
    
    // Create conversation analyzer
    conversationAnalyzer = new ConversationAnalyzer('test-integration-123', new Date());
    
    // Mock mark completion service
    mockMarkCompletionService = {
      clearAll: jest.fn(),
      addMark: jest.fn(),
      waitForMarks: jest.fn().mockResolvedValue()
    };
  });

  afterEach(async () => {
    if (dbManager) {
      await dbManager.close();
    }
  });

  test('should prevent duplicates in real service integration scenario', async () => {
    // This test simulates the real scenario where gpt-service.js
    // tracks both function "say" messages AND streaming GPT responses
    
    const summary = {
      callSid: 'test-integration-123',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      callMetadata: { duration: 45 }
    };
    
    const result = await storageService.saveSummary(summary);
    const numericId = result.numericId;
    
    // Simulate user asking for news (typical function call scenario)
    conversationAnalyzer.trackUserUtterance('Tell me the latest news', new Date());
    
    // Simulate what happens in gpt-service.js line 200 when function has "say"
    const functionSayMessage = 'Let me get the latest news for you';
    conversationAnalyzer.trackAssistantResponse(functionSayMessage, new Date());
    
    // Simulate what happens in gpt-service.js line 260 during GPT streaming
    // This would normally create a duplicate with very similar/identical content
    setTimeout(() => {
      // Exact same message (should be filtered)
      conversationAnalyzer.trackAssistantResponse(functionSayMessage, new Date());
      
      // Very similar message (should be filtered due to high similarity)
      conversationAnalyzer.trackAssistantResponse('Let me get latest news for you', new Date());
      
      // Different message (should be allowed)
      conversationAnalyzer.trackAssistantResponse('Here are the top stories today', new Date());
    }, 10);
    
    // Wait for all tracking to complete
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Extract and save messages (like in app.js and chat-session.js)
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
    
    // Save messages to database
    await storageService.saveMessages(numericId, messages);
    
    // Load messages back
    const savedMessages = await storageService.loadMessages(result.conversationId);
    
    // Should have 3 messages total: 1 user + 2 unique assistant responses
    expect(savedMessages).toHaveLength(3);
    
    const userMessages = savedMessages.filter(m => m.role === 'user');
    expect(userMessages).toHaveLength(1);
    expect(userMessages[0].content).toBe('Tell me the latest news');
    
    const assistantMessages = savedMessages.filter(m => m.role === 'assistant');
    expect(assistantMessages).toHaveLength(2);
    
    // Check that we have the two distinct messages, not duplicates
    const assistantContents = assistantMessages.map(m => m.content).sort();
    expect(assistantContents).toEqual([
      'Here are the top stories today',
      'Let me get the latest news for you'
    ]);
    
    // Verify no exact duplicates
    const contentCounts = {};
    savedMessages.forEach(msg => {
      contentCounts[msg.content] = (contentCounts[msg.content] || 0) + 1;
    });
    
    Object.values(contentCounts).forEach(count => {
      expect(count).toBe(1); // Each message should appear exactly once
    });
  });

  test('should handle edge case of multiple function calls with similar messages', async () => {
    const summary = {
      callSid: 'test-multiple-functions',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      callMetadata: { duration: 60 }
    };
    
    const result = await storageService.saveSummary(summary);
    const numericId = result.numericId;
    
    // User makes multiple requests
    conversationAnalyzer.trackUserUtterance('What is the weather?', new Date());
    
    // Multiple function calls might have similar "say" messages
    conversationAnalyzer.trackAssistantResponse('Let me check the weather for you', new Date());
    conversationAnalyzer.trackAssistantResponse('Let me check the weather for you', new Date()); // Exact duplicate
    conversationAnalyzer.trackAssistantResponse('Let me check weather conditions for you', new Date()); // Similar
    
    // Wait a bit, then user asks something else
    setTimeout(() => {
      conversationAnalyzer.trackUserUtterance('How about the news?', new Date());
      conversationAnalyzer.trackAssistantResponse('Let me get the news for you', new Date());
    }, 100);
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Extract and save
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
    
    // Should have 5 messages: 2 user + 3 assistant (exact duplicate filtered, similar one kept)
    expect(savedMessages).toHaveLength(5);
    
    const assistantMessages = savedMessages.filter(m => m.role === 'assistant');
    expect(assistantMessages).toHaveLength(3);
    
    // Should have kept the first weather message, the similar but different one, and the news message
    const assistantContents = assistantMessages.map(m => m.content);
    expect(assistantContents).toContain('Let me check the weather for you');
    expect(assistantContents).toContain('Let me check weather conditions for you'); // Similar but different enough
    expect(assistantContents).toContain('Let me get the news for you');
    
    // Verify exact duplicates were filtered (should not have 2 of the same)
    const contentCounts = {};
    assistantMessages.forEach(msg => {
      contentCounts[msg.content] = (contentCounts[msg.content] || 0) + 1;
    });
    
    // Each assistant message should appear exactly once
    Object.values(contentCounts).forEach(count => {
      expect(count).toBe(1);
    });
  });
});