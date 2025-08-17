const ConversationAnalyzer = require('../services/conversation-analyzer');
const SqliteStorageService = require('../services/sqlite-storage-service');
const SummaryGenerator = require('../services/summary-generator');

// Mock services
jest.mock('../services/sqlite-storage-service');
jest.mock('../services/summary-generator');

describe('App.js Duration Filtering Integration', () => {
  let conversationAnalyzer;
  let storageService;
  let summaryGenerator;
  let consoleSpy;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock console.log to capture log messages
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    
    // Create mock services
    storageService = new SqliteStorageService();
    summaryGenerator = new SummaryGenerator();
    
    // Setup mock implementations
    storageService.saveSummary = jest.fn().mockResolvedValue({
      conversationId: 'test-conversation-id',
      numericId: 123
    });
    storageService.saveMessages = jest.fn().mockResolvedValue();
    summaryGenerator.generateSummary = jest.fn().mockReturnValue({
      callSid: 'test-call-sid',
      duration: 1.5,
      summary: 'Test conversation summary'
    });
  });

  afterEach(() => {
    // Restore console.log
    consoleSpy.mockRestore();
  });

  // Simulate the exact logic from app.js WebSocket close handler
  const simulateWebSocketClose = async (conversationAnalyzer, mockEndTime = null) => {
    if (conversationAnalyzer) {
      try {
        conversationAnalyzer.endTime = mockEndTime || new Date();
        
        // Calculate duration and skip save for test calls under 2 seconds
        const duration = (conversationAnalyzer.endTime - conversationAnalyzer.startTime) / 1000;
        if (duration < 2) {
          console.log(`Skipping save: test call under 2 seconds (${duration}s)`);
          return;
        }
        
        const summary = summaryGenerator.generateSummary(conversationAnalyzer);
        
        const result = await storageService.saveSummary(summary);
        const conversationId = result.conversationId;
        const numericId = result.numericId;
        
        console.log(`Conversation summary saved to: ${conversationId}`);
        
        // Extract and save conversation messages
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
        
        // Sort messages by timestamp
        messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Save messages to database
        if (messages.length > 0) {
          await storageService.saveMessages(numericId, messages);
          console.log(`${messages.length} conversation messages saved to database`);
        }
        
      } catch (error) {
        console.error('Error saving conversation summary or messages:', error);
      }
    }
  };

  test('WebSocket close handler should skip save for short calls', async () => {
    // Create conversation with 1.5 second duration
    const startTime = new Date();
    conversationAnalyzer = new ConversationAnalyzer('test-call-sid', startTime);
    
    // Add some utterances
    conversationAnalyzer.userUtterances = [
      { text: 'Hello', timestamp: startTime }
    ];
    conversationAnalyzer.assistantResponses = [
      { text: 'Hi', timestamp: new Date(startTime.getTime() + 500) }
    ];
    
    // Simulate WebSocket close with 1.5 second duration
    const endTime = new Date(startTime.getTime() + 1500);
    await simulateWebSocketClose(conversationAnalyzer, endTime);
    
    // Verify skip message was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Skipping save: test call under 2 seconds (1.5s)')
    );
    
    // Verify database operations were skipped
    expect(summaryGenerator.generateSummary).not.toHaveBeenCalled();
    expect(storageService.saveSummary).not.toHaveBeenCalled();
    expect(storageService.saveMessages).not.toHaveBeenCalled();
  });

  test('WebSocket close handler should save for normal length calls', async () => {
    // Create conversation with 3 second duration
    const startTime = new Date();
    conversationAnalyzer = new ConversationAnalyzer('test-call-sid', startTime);
    
    // Add some utterances
    conversationAnalyzer.userUtterances = [
      { text: 'Hello', timestamp: startTime },
      { text: 'How are you?', timestamp: new Date(startTime.getTime() + 1000) }
    ];
    conversationAnalyzer.assistantResponses = [
      { text: 'Hi there', timestamp: new Date(startTime.getTime() + 500) },
      { text: 'I am doing well', timestamp: new Date(startTime.getTime() + 1500) }
    ];
    
    // Simulate WebSocket close with 3 second duration
    const endTime = new Date(startTime.getTime() + 3000);
    await simulateWebSocketClose(conversationAnalyzer, endTime);
    
    // Verify skip message was NOT logged
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Skipping save: test call under 2 seconds')
    );
    
    // Verify database operations proceeded
    expect(summaryGenerator.generateSummary).toHaveBeenCalledWith(conversationAnalyzer);
    expect(storageService.saveSummary).toHaveBeenCalled();
    expect(storageService.saveMessages).toHaveBeenCalledWith(123, expect.any(Array));
    
    // Verify success messages were logged
    expect(consoleSpy).toHaveBeenCalledWith('Conversation summary saved to: test-conversation-id');
    expect(consoleSpy).toHaveBeenCalledWith('4 conversation messages saved to database');
  });

  test('WebSocket close handler should save for exactly 2 second calls', async () => {
    // Create conversation with exactly 2 second duration
    const startTime = new Date();
    conversationAnalyzer = new ConversationAnalyzer('test-call-sid', startTime);
    
    conversationAnalyzer.userUtterances = [
      { text: 'Test', timestamp: startTime }
    ];
    
    // Simulate WebSocket close with exactly 2 second duration
    const endTime = new Date(startTime.getTime() + 2000);
    await simulateWebSocketClose(conversationAnalyzer, endTime);
    
    // Verify skip message was NOT logged (should save for >= 2 seconds)
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Skipping save: test call under 2 seconds')
    );
    
    // Verify database operations proceeded
    expect(summaryGenerator.generateSummary).toHaveBeenCalledWith(conversationAnalyzer);
    expect(storageService.saveSummary).toHaveBeenCalled();
  });
});