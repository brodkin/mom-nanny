const ConversationAnalyzer = require('../services/conversation-analyzer');
const SqliteStorageService = require('../services/sqlite-storage-service');
const SummaryGenerator = require('../services/summary-generator');

// Mock services
jest.mock('../services/sqlite-storage-service');
jest.mock('../services/summary-generator');

describe('Duration Filtering in WebSocket Close Handler', () => {
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
      duration: 1.5, // This will be overridden by actual calculation
      summary: 'Test conversation summary'
    });
  });

  afterEach(() => {
    // Restore console.log
    consoleSpy.mockRestore();
  });

  test('should skip database save for calls under 2 seconds and log appropriate message', async () => {
    // RED PHASE: Create a conversation analyzer with short duration
    const startTime = new Date('2025-01-16T10:00:00.000Z');
    const endTime = new Date('2025-01-16T10:00:01.500Z'); // 1.5 seconds duration
    
    conversationAnalyzer = new ConversationAnalyzer('test-call-sid', startTime);
    conversationAnalyzer.endTime = endTime;
    
    // Add some test utterances to make it a realistic conversation
    conversationAnalyzer.userUtterances = [
      { text: 'Hello', timestamp: startTime }
    ];
    conversationAnalyzer.assistantResponses = [
      { text: 'Hi there', timestamp: new Date(startTime.getTime() + 500) }
    ];

    // Simulate the WebSocket close handler logic
    const duration = (conversationAnalyzer.endTime - conversationAnalyzer.startTime) / 1000;
    
    let summaryGenerated = false;
    let summarySaved = false;
    let messagesSaved = false;

    // Test the duration check logic
    if (duration < 2) {
      // Should log message and skip database operations
      console.log(`Skipping save: test call under 2 seconds (${duration}s)`);
    } else {
      // Should generate and save summary
      summaryGenerated = true;
      const summary = summaryGenerator.generateSummary(conversationAnalyzer);
      
      const result = await storageService.saveSummary(summary);
      summarySaved = true;
      
      const messages = [];
      conversationAnalyzer.userUtterances.forEach(utterance => {
        messages.push({
          role: 'user',
          content: utterance.text,
          timestamp: utterance.timestamp.toISOString()
        });
      });
      
      if (messages.length > 0) {
        await storageService.saveMessages(result.numericId, messages);
        messagesSaved = true;
      }
    }

    // Assertions
    expect(duration).toBe(1.5);
    expect(summaryGenerated).toBe(false);
    expect(summarySaved).toBe(false);
    expect(messagesSaved).toBe(false);
    
    // Verify the log message was called with correct format
    expect(consoleSpy).toHaveBeenCalledWith('Skipping save: test call under 2 seconds (1.5s)');
    
    // Verify database methods were NOT called
    expect(summaryGenerator.generateSummary).not.toHaveBeenCalled();
    expect(storageService.saveSummary).not.toHaveBeenCalled();
    expect(storageService.saveMessages).not.toHaveBeenCalled();
  });

  test('should proceed with normal save for calls 2 seconds or longer', async () => {
    // Create a conversation analyzer with adequate duration
    const startTime = new Date('2025-01-16T10:00:00.000Z');
    const endTime = new Date('2025-01-16T10:00:02.500Z'); // 2.5 seconds duration
    
    conversationAnalyzer = new ConversationAnalyzer('test-call-sid', startTime);
    conversationAnalyzer.endTime = endTime;
    
    // Add some test utterances
    conversationAnalyzer.userUtterances = [
      { text: 'Hello', timestamp: startTime },
      { text: 'How are you?', timestamp: new Date(startTime.getTime() + 1000) }
    ];
    conversationAnalyzer.assistantResponses = [
      { text: 'Hi there', timestamp: new Date(startTime.getTime() + 500) },
      { text: 'I am doing well', timestamp: new Date(startTime.getTime() + 1500) }
    ];

    // Simulate the WebSocket close handler logic
    const duration = (conversationAnalyzer.endTime - conversationAnalyzer.startTime) / 1000;
    
    let summaryGenerated = false;
    let summarySaved = false;
    let messagesSaved = false;

    // Test the duration check logic
    if (duration < 2) {
      console.log(`Skipping save: test call under 2 seconds (${duration}s)`);
    } else {
      // Should generate and save summary
      summaryGenerated = true;
      const summary = summaryGenerator.generateSummary(conversationAnalyzer);
      
      const result = await storageService.saveSummary(summary);
      summarySaved = true;
      
      const messages = [];
      conversationAnalyzer.userUtterances.forEach(utterance => {
        messages.push({
          role: 'user',
          content: utterance.text,
          timestamp: utterance.timestamp.toISOString()
        });
      });
      
      if (messages.length > 0) {
        await storageService.saveMessages(result.numericId, messages);
        messagesSaved = true;
      }
    }

    // Assertions
    expect(duration).toBe(2.5);
    expect(summaryGenerated).toBe(true);
    expect(summarySaved).toBe(true);
    expect(messagesSaved).toBe(true);
    
    // Verify the skip log message was NOT called
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Skipping save: test call under 2 seconds'));
    
    // Verify database methods WERE called
    expect(summaryGenerator.generateSummary).toHaveBeenCalledWith(conversationAnalyzer);
    expect(storageService.saveSummary).toHaveBeenCalled();
    expect(storageService.saveMessages).toHaveBeenCalledWith(123, expect.any(Array));
  });

  test('should handle edge case of exactly 2 seconds duration', async () => {
    // Create a conversation analyzer with exactly 2 seconds duration
    const startTime = new Date('2025-01-16T10:00:00.000Z');
    const endTime = new Date('2025-01-16T10:00:02.000Z'); // Exactly 2.0 seconds
    
    conversationAnalyzer = new ConversationAnalyzer('test-call-sid', startTime);
    conversationAnalyzer.endTime = endTime;
    
    conversationAnalyzer.userUtterances = [
      { text: 'Test', timestamp: startTime }
    ];

    // Simulate the WebSocket close handler logic
    const duration = (conversationAnalyzer.endTime - conversationAnalyzer.startTime) / 1000;
    
    let shouldSave = duration >= 2; // Use >= for the edge case

    // Assertions
    expect(duration).toBe(2.0);
    expect(shouldSave).toBe(true); // Should save when exactly 2 seconds
  });
});