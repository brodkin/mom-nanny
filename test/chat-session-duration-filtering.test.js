const { ChatSession } = require('../services/chat-session');
const ConversationAnalyzer = require('../services/conversation-analyzer');
const SqliteStorageService = require('../services/sqlite-storage-service');
const SummaryGenerator = require('../services/summary-generator');
const DatabaseManager = require('../services/database-manager');
const chalk = require('chalk');

// Mock all external dependencies
jest.mock('../services/sqlite-storage-service');
jest.mock('../services/summary-generator');
jest.mock('../services/database-manager');
jest.mock('../services/mock-transcription-service');
jest.mock('../services/mock-tts-service');
jest.mock('../services/mock-stream-service');
jest.mock('../services/memory-service');
jest.mock('../services/gpt-service');
jest.mock('../services/template-service');

// Mock chalk to avoid ANSI codes in test output
jest.mock('chalk', () => ({
  yellow: jest.fn((str) => str),
  green: jest.fn((str) => str),
  gray: jest.fn((str) => str),
  red: jest.fn((str) => str),
  cyan: jest.fn((str) => str),
  blue: jest.fn((str) => str),
  magenta: jest.fn((str) => str),
  bold: jest.fn((str) => str)
}));

describe('ChatSession Duration Filtering', () => {
  let chatSession;
  let mockStorageService;
  let mockSummaryGenerator;
  let mockDbManager;
  let consoleSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console.log to capture output
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    
    // Setup mock database manager
    mockDbManager = {
      dbPath: './test.db',
      waitForInitialization: jest.fn().mockResolvedValue()
    };
    DatabaseManager.getInstance = jest.fn().mockReturnValue(mockDbManager);
    
    // Setup mock storage service
    mockStorageService = {
      saveSummary: jest.fn().mockResolvedValue({
        conversationId: 'test-conversation-id',
        numericId: 123
      }),
      saveMessages: jest.fn().mockResolvedValue()
    };
    SqliteStorageService.mockImplementation(() => mockStorageService);
    
    // Setup mock summary generator
    mockSummaryGenerator = {
      generateSummary: jest.fn().mockReturnValue({
        callSid: 'test-call-sid',
        callMetadata: { duration: 1.5 }, // This will be overridden
        summary: 'Test conversation summary'
      })
    };
    SummaryGenerator.mockImplementation(() => mockSummaryGenerator);
    
    // Create chat session bypassing constructor to avoid initialization
    chatSession = Object.create(ChatSession.prototype);
    chatSession.callSid = 'test-call-sid-123';
    chatSession.isActive = true;
    chatSession.databaseManager = mockDbManager;
    chatSession.storageService = mockStorageService;
    chatSession.summaryGenerator = mockSummaryGenerator;
    
    // Mock the services that would be initialized in constructor
    chatSession.transcriptionService = {
      close: jest.fn()
    };
    chatSession.ttsService = {
      close: jest.fn()
    };
    chatSession.streamService = {
      close: jest.fn()
    };
    chatSession.showStats = jest.fn();
    chatSession.emit = jest.fn(); // Mock EventEmitter functionality
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('should skip database save for chat sessions under 2 seconds and log appropriate message', async () => {
    // RED PHASE: Create analyzer with short duration (1.5 seconds)
    const startTime = new Date('2025-01-16T10:00:00.000Z');
    const endTime = new Date('2025-01-16T10:00:01.500Z');
    
    chatSession.conversationAnalyzer = new ConversationAnalyzer('test-call-sid', startTime);
    chatSession.conversationAnalyzer.endTime = endTime;
    
    // Add some realistic conversation data
    chatSession.conversationAnalyzer.userUtterances = [
      { text: 'Hello', timestamp: startTime }
    ];
    chatSession.conversationAnalyzer.assistantResponses = [
      { text: 'Hi there', timestamp: new Date(startTime.getTime() + 500) }
    ];
    
    // Update the mock to return the actual duration that will be calculated
    mockSummaryGenerator.generateSummary.mockReturnValue({
      callSid: 'test-call-sid',
      callMetadata: { duration: 1.5 },
      summary: 'Test conversation summary'
    });
    
    // Execute the endSession method
    await chatSession.endSession();
    
    // Assertions
    expect(chatSession.isActive).toBe(false);
    
    // Verify the skip log message was called with correct format
    expect(consoleSpy).toHaveBeenCalledWith(
      chalk.yellow('Skipping save: test chat session under 2 seconds (1.5s)')
    );
    
    // Verify database methods were NOT called
    expect(mockSummaryGenerator.generateSummary).toHaveBeenCalledWith(chatSession.conversationAnalyzer);
    expect(mockStorageService.saveSummary).not.toHaveBeenCalled();
    expect(mockStorageService.saveMessages).not.toHaveBeenCalled();
    
    // Verify services were still cleaned up
    expect(chatSession.transcriptionService.close).toHaveBeenCalled();
    expect(chatSession.ttsService.close).toHaveBeenCalled();
    expect(chatSession.streamService.close).toHaveBeenCalled();
    expect(chatSession.showStats).toHaveBeenCalled();
    
    // Verify session ended message
    expect(consoleSpy).toHaveBeenCalledWith(chalk.green('\n✅ Chat session ended. Goodbye!'));
  });

  test('should proceed with normal save for chat sessions 2 seconds or longer', async () => {
    // Create analyzer with adequate duration (2.5 seconds)
    const startTime = new Date('2025-01-16T10:00:00.000Z');
    const endTime = new Date('2025-01-16T10:00:02.500Z');
    
    chatSession.conversationAnalyzer = new ConversationAnalyzer('test-call-sid', startTime);
    chatSession.conversationAnalyzer.endTime = endTime;
    
    // Add conversation data
    chatSession.conversationAnalyzer.userUtterances = [
      { text: 'Hello', timestamp: startTime },
      { text: 'How are you?', timestamp: new Date(startTime.getTime() + 1000) }
    ];
    chatSession.conversationAnalyzer.assistantResponses = [
      { text: 'Hi there', timestamp: new Date(startTime.getTime() + 500) },
      { text: 'I am doing well', timestamp: new Date(startTime.getTime() + 1500) }
    ];
    
    // Update the mock to return the actual duration
    mockSummaryGenerator.generateSummary.mockReturnValue({
      callSid: 'test-call-sid',
      callMetadata: { duration: 2.5 },
      summary: 'Test conversation summary'
    });
    
    // Execute the endSession method
    await chatSession.endSession();
    
    // Assertions
    expect(chatSession.isActive).toBe(false);
    
    // Verify the skip log message was NOT called
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Skipping save: test chat session under 2 seconds')
    );
    
    // Verify database methods WERE called
    expect(mockSummaryGenerator.generateSummary).toHaveBeenCalledWith(chatSession.conversationAnalyzer);
    expect(mockStorageService.saveSummary).toHaveBeenCalled();
    expect(mockStorageService.saveMessages).toHaveBeenCalledWith(123, expect.any(Array));
    
    // Verify success messages
    expect(consoleSpy).toHaveBeenCalledWith(chalk.green('\n📝 Conversation summary saved to SQLite database'));
    expect(consoleSpy).toHaveBeenCalledWith(chalk.green('💬 4 conversation messages saved to database'));
    
    // Verify services were cleaned up
    expect(chatSession.transcriptionService.close).toHaveBeenCalled();
    expect(chatSession.ttsService.close).toHaveBeenCalled();
    expect(chatSession.streamService.close).toHaveBeenCalled();
    expect(chatSession.showStats).toHaveBeenCalled();
  });

  test('should handle edge case of exactly 2 seconds duration', async () => {
    // Create analyzer with exactly 2.0 seconds duration
    const startTime = new Date('2025-01-16T10:00:00.000Z');
    const endTime = new Date('2025-01-16T10:00:02.000Z');
    
    chatSession.conversationAnalyzer = new ConversationAnalyzer('test-call-sid', startTime);
    chatSession.conversationAnalyzer.endTime = endTime;
    
    // Add some conversation data
    chatSession.conversationAnalyzer.userUtterances = [
      { text: 'Test', timestamp: startTime }
    ];
    chatSession.conversationAnalyzer.assistantResponses = [
      { text: 'Response', timestamp: new Date(startTime.getTime() + 1000) }
    ];
    
    // Update the mock to return exactly 2.0 seconds
    mockSummaryGenerator.generateSummary.mockReturnValue({
      callSid: 'test-call-sid',
      callMetadata: { duration: 2.0 },
      summary: 'Test conversation summary'
    });
    
    // Execute the endSession method
    await chatSession.endSession();
    
    // Assertions - should save (>= 2 seconds)
    expect(mockStorageService.saveSummary).toHaveBeenCalled();
    expect(mockStorageService.saveMessages).toHaveBeenCalled();
    
    // Should not have skip message
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Skipping save: test chat session under 2 seconds')
    );
  });

  test('should still cleanup services when duration filtering skips save', async () => {
    // Create analyzer with short duration
    const startTime = new Date('2025-01-16T10:00:00.000Z');
    const endTime = new Date('2025-01-16T10:00:00.500Z'); // 0.5 seconds
    
    chatSession.conversationAnalyzer = new ConversationAnalyzer('test-call-sid', startTime);
    chatSession.conversationAnalyzer.endTime = endTime;
    
    mockSummaryGenerator.generateSummary.mockReturnValue({
      callSid: 'test-call-sid',
      callMetadata: { duration: 0.5 },
      summary: 'Test conversation summary'
    });
    
    // Execute the endSession method
    await chatSession.endSession();
    
    // Verify services were cleaned up even though save was skipped
    expect(chatSession.transcriptionService.close).toHaveBeenCalled();
    expect(chatSession.ttsService.close).toHaveBeenCalled();
    expect(chatSession.streamService.close).toHaveBeenCalled();
    expect(chatSession.showStats).toHaveBeenCalled();
    
    // Verify session ended properly
    expect(consoleSpy).toHaveBeenCalledWith(chalk.green('\n✅ Chat session ended. Goodbye!'));
    expect(chatSession.isActive).toBe(false);
  });

  test('should handle error in summary generation gracefully', async () => {
    // Create analyzer with short duration
    const startTime = new Date('2025-01-16T10:00:00.000Z');
    const endTime = new Date('2025-01-16T10:00:01.000Z'); // 1 second
    
    chatSession.conversationAnalyzer = new ConversationAnalyzer('test-call-sid', startTime);
    chatSession.conversationAnalyzer.endTime = endTime;
    
    // Make summary generation throw an error
    mockSummaryGenerator.generateSummary.mockImplementation(() => {
      throw new Error('Summary generation failed');
    });
    
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Execute the endSession method
    await chatSession.endSession();
    
    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      chalk.red('❌ Error saving conversation summary or messages:'),
      expect.any(Error)
    );
    
    // Verify services were still cleaned up
    expect(chatSession.transcriptionService.close).toHaveBeenCalled();
    expect(chatSession.ttsService.close).toHaveBeenCalled();
    expect(chatSession.streamService.close).toHaveBeenCalled();
    
    consoleErrorSpy.mockRestore();
  });
});