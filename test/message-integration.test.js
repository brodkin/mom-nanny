const SqliteStorageService = require('../services/sqlite-storage-service');
const DatabaseManager = require('../services/database-manager');
const fs = require('fs');

describe('Message Integration Tests', () => {
  let storageService;
  let dbManager;
  const testDbPath = './test-message-integration.db';

  beforeEach(() => {
    // Remove test database if it exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    dbManager = new DatabaseManager(testDbPath);
    storageService = new SqliteStorageService(dbManager);
  });

  afterEach(() => {
    if (dbManager) {
      dbManager.close();
    }
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('complete workflow: save summary and messages, then retrieve both', async () => {
    // Step 1: Create and save a conversation summary
    const mockSummary = {
      callSid: 'integration-test-call-1',
      startTime: '2024-01-15T14:30:00Z',
      endTime: '2024-01-15T14:45:00Z',
      callMetadata: {
        duration: 900,
        dayOfWeek: 'Monday',
        timeOfDay: 'afternoon'
      },
      conversationMetrics: {
        totalInteractions: 6,
        userUtterances: 3,
        assistantResponses: 3
      },
      mentalStateIndicators: {
        anxietyLevel: 1,
        confusionIndicators: 0,
        agitationLevel: 0
      },
      careIndicators: {
        medicationConcerns: [],
        painComplaints: []
      },
      behavioralPatterns: {
        responseLatency: 800,
        coherenceLevel: 0.9
      },
      clinicalObservations: {
        hypochondriaEvents: 0
      },
      supportEffectiveness: {
        comfortingSuccess: ['reassurance_about_safety']
      },
      caregiverInsights: [
        'Patient showed good mood today',
        'Responded well to conversation about her dog'
      ]
    };

    const result = await storageService.saveSummary(mockSummary);
    
    // Verify summary was saved correctly
    expect(result.conversationId).toMatch(/^conversation-\d+$/);
    expect(result.numericId).toBeGreaterThan(0);

    // Step 2: Save conversation messages for this conversation
    const messages = [
      {
        role: 'user',
        content: 'Hi Jessica, I\'m feeling worried about my medication today.',
        timestamp: '2024-01-15T14:30:15Z'
      },
      {
        role: 'assistant',
        content: 'Hi Francine! I understand you might be concerned about your medication. Can you tell me what specifically is worrying you about it?',
        timestamp: '2024-01-15T14:30:20Z'
      },
      {
        role: 'user',
        content: 'I think I might have taken too much this morning. I can\'t remember if I already took it.',
        timestamp: '2024-01-15T14:31:00Z'
      },
      {
        role: 'assistant',
        content: 'That sounds concerning, and it\'s completely understandable to worry about that. Let\'s focus on something else for now - how is your beautiful dog doing today?',
        timestamp: '2024-01-15T14:31:10Z'
      },
      {
        role: 'user',
        content: 'Oh, she\'s doing wonderful! She was sitting by the window this morning watching the birds.',
        timestamp: '2024-01-15T14:32:00Z'
      },
      {
        role: 'assistant',
        content: 'That sounds delightful! Dogs love watching the world go by. It must bring you such joy to see her happy and content.',
        timestamp: '2024-01-15T14:32:10Z'
      }
    ];

    await storageService.saveMessages(result.numericId, messages);

    // Step 3: Retrieve and verify the saved summary
    const loadedSummary = await storageService.loadSummary(result.conversationId);
    
    expect(loadedSummary.callSid).toBe('integration-test-call-1');
    expect(loadedSummary.conversationMetrics.totalInteractions).toBe(6);
    expect(loadedSummary.caregiverInsights).toContain('Patient showed good mood today');

    // Step 4: Retrieve and verify the saved messages
    const loadedMessages = await storageService.loadMessages(result.conversationId);
    
    expect(loadedMessages).toHaveLength(6);
    
    // Verify messages are in chronological order
    expect(loadedMessages[0].role).toBe('user');
    expect(loadedMessages[0].content).toContain('feeling worried about my medication');
    expect(loadedMessages[1].role).toBe('assistant');
    expect(loadedMessages[1].content).toContain('Can you tell me what specifically');
    expect(loadedMessages[5].content).toContain('bring you such joy');

    // Verify message timestamps are preserved
    expect(loadedMessages[0].timestamp).toBe('2024-01-15T14:30:15Z');
    expect(loadedMessages[5].timestamp).toBe('2024-01-15T14:32:10Z');

    // Step 5: Verify the conversation shows the successful redirection
    const medicationWorryCount = loadedMessages.filter(msg => 
      msg.content.toLowerCase().includes('medication')).length;
    const dogMentionCount = loadedMessages.filter(msg => 
      msg.content.toLowerCase().includes('dog')).length;
    
    expect(medicationWorryCount).toBe(2); // User mentioned, assistant acknowledged
    expect(dogMentionCount).toBe(2); // Assistant redirected, user responded positively
    
    // Verify the successful redirection strategy mentioned in summary
    expect(loadedSummary.supportEffectiveness.comfortingSuccess).toContain('reassurance_about_safety');
  });

  test('messages persist independently of summary updates', async () => {
    const mockSummary = {
      callSid: 'integration-test-call-2',
      startTime: '2024-01-15T15:00:00Z',
      endTime: '2024-01-15T15:10:00Z',
      callMetadata: { duration: 600 },
      conversationMetrics: { totalInteractions: 2 },
      mentalStateIndicators: {},
      careIndicators: {},
      behavioralPatterns: {},
      clinicalObservations: {},
      supportEffectiveness: {},
      caregiverInsights: []
    };

    // Save initial summary and messages
    const result1 = await storageService.saveSummary(mockSummary);
    
    const initialMessages = [
      {
        role: 'user',
        content: 'Hello there!',
        timestamp: '2024-01-15T15:00:30Z'
      },
      {
        role: 'assistant',
        content: 'Hi Francine! How are you today?',
        timestamp: '2024-01-15T15:00:35Z'
      }
    ];

    await storageService.saveMessages(result1.numericId, initialMessages);

    // Update the summary (simulating end-of-call analysis)
    mockSummary.conversationMetrics.totalInteractions = 4;
    mockSummary.caregiverInsights = ['Brief but positive interaction'];
    
    const result2 = await storageService.saveSummary(mockSummary);

    // Verify it's the same conversation
    expect(result1.conversationId).toBe(result2.conversationId);
    expect(result1.numericId).toBe(result2.numericId);

    // Add more messages after summary update
    const additionalMessages = [
      {
        role: 'user',
        content: 'I\'m doing well, thank you for asking.',
        timestamp: '2024-01-15T15:01:00Z'
      },
      {
        role: 'assistant',
        content: 'That\'s wonderful to hear! Is there anything special you\'d like to talk about today?',
        timestamp: '2024-01-15T15:01:05Z'
      }
    ];

    // Save updated message set (this should replace the old messages)
    const allMessages = [...initialMessages, ...additionalMessages];
    await storageService.saveMessages(result2.numericId, allMessages);

    // Verify both summary and messages are correct
    const finalSummary = await storageService.loadSummary(result2.conversationId);
    expect(finalSummary.conversationMetrics.totalInteractions).toBe(4);
    expect(finalSummary.caregiverInsights).toContain('Brief but positive interaction');

    const finalMessages = await storageService.loadMessages(result2.conversationId);
    expect(finalMessages).toHaveLength(4);
    expect(finalMessages[3].content).toContain('anything special you\'d like to talk about');
  });

  test('handles multiple conversations with messages correctly', async () => {
    // Create two separate conversations
    const conversation1 = {
      callSid: 'multi-test-call-1',
      startTime: '2024-01-15T10:00:00Z',
      endTime: '2024-01-15T10:05:00Z',
      callMetadata: { duration: 300 },
      conversationMetrics: {},
      mentalStateIndicators: {},
      careIndicators: {},
      behavioralPatterns: {},
      clinicalObservations: {},
      supportEffectiveness: {},
      caregiverInsights: []
    };

    const conversation2 = {
      callSid: 'multi-test-call-2', 
      startTime: '2024-01-15T14:00:00Z',
      endTime: '2024-01-15T14:08:00Z',
      callMetadata: { duration: 480 },
      conversationMetrics: {},
      mentalStateIndicators: {},
      careIndicators: {},
      behavioralPatterns: {},
      clinicalObservations: {},
      supportEffectiveness: {},
      caregiverInsights: []
    };

    const result1 = await storageService.saveSummary(conversation1);
    const result2 = await storageService.saveSummary(conversation2);

    // Verify they're different conversations
    expect(result1.conversationId).not.toBe(result2.conversationId);
    expect(result1.numericId).not.toBe(result2.numericId);

    // Add messages to first conversation
    const messages1 = [
      {
        role: 'user',
        content: 'Good morning, Jessica.',
        timestamp: '2024-01-15T10:00:30Z'
      },
      {
        role: 'assistant',
        content: 'Good morning, Francine! How did you sleep?',
        timestamp: '2024-01-15T10:00:35Z'
      }
    ];

    // Add messages to second conversation
    const messages2 = [
      {
        role: 'user',
        content: 'I\'m feeling anxious this afternoon.',
        timestamp: '2024-01-15T14:00:30Z'
      },
      {
        role: 'assistant',
        content: 'I\'m sorry to hear you\'re feeling anxious. Let\'s talk about something that makes you happy.',
        timestamp: '2024-01-15T14:00:40Z'
      },
      {
        role: 'user',
        content: 'I love thinking about my garden.',
        timestamp: '2024-01-15T14:01:00Z'
      }
    ];

    await storageService.saveMessages(result1.numericId, messages1);
    await storageService.saveMessages(result2.numericId, messages2);

    // Verify messages are kept separate
    const loadedMessages1 = await storageService.loadMessages(result1.conversationId);
    const loadedMessages2 = await storageService.loadMessages(result2.conversationId);

    expect(loadedMessages1).toHaveLength(2);
    expect(loadedMessages2).toHaveLength(3);

    expect(loadedMessages1[0].content).toContain('Good morning');
    expect(loadedMessages2[0].content).toContain('feeling anxious');
    expect(loadedMessages2[2].content).toContain('my garden');

    // Verify cross-contamination doesn't occur
    const morningMentions1 = loadedMessages1.filter(msg => msg.content.includes('morning')).length;
    const morningMentions2 = loadedMessages2.filter(msg => msg.content.includes('morning')).length;
    
    expect(morningMentions1).toBeGreaterThan(0);
    expect(morningMentions2).toBe(0);
  });
});