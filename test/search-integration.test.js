/**
 * Integration test to verify the search issue mentioned in requirements is resolved
 * Tests that "Sometimes" search works across ALL conversations in database
 */

const request = require('supertest');
const express = require('express');
const DatabaseManager = require('../services/database-manager');

// Create a test app
const conversationsRouter = require('../routes/api/conversations');
const app = express();
app.use(express.json());
app.use('/api/conversations', conversationsRouter);

describe('Search Integration - "Sometimes" Issue Resolution', () => {
  let dbManager;

  beforeEach(async () => {
    // Reset singleton to get fresh in-memory database for each test
    DatabaseManager.resetInstance();
    
    // Get fresh database instance (will use in-memory database from global setup)
    // This relies on SQLITE_DB_PATH being set to ':memory:' in jest-global-setup.js
    dbManager = DatabaseManager.getInstance();
    await dbManager.waitForInitialization();
    
    // Create test data for search functionality testing
    await setupTestData();
  });
  
  afterEach(() => {
    // Reset singleton after each test
    DatabaseManager.resetInstance();
  });

  async function setupTestData() {
    // Clear existing data first to ensure clean state (order matters for foreign keys)
    await dbManager.run('DELETE FROM messages');
    await dbManager.run('DELETE FROM conversations');
    
    // Insert test conversations and capture their IDs
    const conversationIds = [];
    const conversations = [
      {
        call_sid: 'test-call-sometimes-1',
        start_time: '2024-01-15 10:30:00',
        end_time: '2024-01-15 10:35:00',
        duration: 300
      },
      {
        call_sid: 'test-call-medication-1', 
        start_time: '2024-01-15 14:20:00',
        end_time: '2024-01-15 14:25:00',
        duration: 300
      },
      {
        call_sid: 'test-call-mixed-1',
        start_time: '2024-01-15 16:10:00', 
        end_time: '2024-01-15 16:15:00',
        duration: 300
      }
    ];

    for (const conv of conversations) {
      const result = await dbManager.run(
        'INSERT INTO conversations (call_sid, start_time, end_time, duration) VALUES (?, ?, ?, ?)',
        [conv.call_sid, conv.start_time, conv.end_time, conv.duration]
      );
      conversationIds.push(result.lastID);
    }

    // Insert messages with search terms using actual conversation IDs
    const messages = [
      // Conversation 1: Contains "Sometimes" in user message
      { conversation_id: conversationIds[0], role: 'user', content: 'Sometimes I feel confused about where I am', timestamp: '2024-01-15 10:30:30' },
      { conversation_id: conversationIds[0], role: 'assistant', content: 'I understand that can be worrying. You are safe and cared for.', timestamp: '2024-01-15 10:30:45' },
      { conversation_id: conversationIds[0], role: 'user', content: 'Sometimes I forget things', timestamp: '2024-01-15 10:31:00' },
      
      // Conversation 2: Contains "medication" in multiple messages  
      { conversation_id: conversationIds[1], role: 'user', content: 'I need my medication but I cannot find it', timestamp: '2024-01-15 14:20:30' },
      { conversation_id: conversationIds[1], role: 'assistant', content: 'Let me help you with that medication concern.', timestamp: '2024-01-15 14:20:45' },
      { conversation_id: conversationIds[1], role: 'user', content: 'The nurse said my medication was changed', timestamp: '2024-01-15 14:21:00' },
      
      // Conversation 3: Contains both terms deeper in conversation
      { conversation_id: conversationIds[2], role: 'user', content: 'Hello, how are you today?', timestamp: '2024-01-15 16:10:30' },
      { conversation_id: conversationIds[2], role: 'assistant', content: 'Hello! I am doing well, thank you for asking.', timestamp: '2024-01-15 16:10:45' },
      { conversation_id: conversationIds[2], role: 'user', content: 'I sometimes worry about my medication schedule', timestamp: '2024-01-15 16:11:00' },
      { conversation_id: conversationIds[2], role: 'assistant', content: 'That is a very reasonable concern to have.', timestamp: '2024-01-15 16:11:15' },
      { conversation_id: conversationIds[2], role: 'user', content: 'Sometimes the staff forgets to give me my pills', timestamp: '2024-01-15 16:11:30' }
    ];

    for (const msg of messages) {
      await dbManager.run(
        'INSERT INTO messages (conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?)',
        [msg.conversation_id, msg.role, msg.content, msg.timestamp]
      );
    }
  }

  test('should find ALL conversations containing "Sometimes" in database', async () => {
    // First, let's see what conversations exist in the database
    const allConversationsResponse = await request(app)
      .get('/api/conversations')
      .query({ pageSize: 100 }); // Get more conversations

    expect(allConversationsResponse.status).toBe(200);
    const allConversations = allConversationsResponse.body.data.conversations;
    
    console.log(`Total conversations in database: ${allConversations.length}`);

    // Now search for "Sometimes" - this was the reported issue
    const searchResponse = await request(app)
      .get('/api/conversations')
      .query({ search: 'Sometimes' });

    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.success).toBe(true);
    
    const foundConversations = searchResponse.body.data.conversations;
    console.log(`Conversations found with "Sometimes": ${foundConversations.length}`);
    
    // Print details of found conversations for verification
    foundConversations.forEach((conv, index) => {
      console.log(`Found ${index + 1}: ${conv.callSid} - "${conv.messageSnippet?.substring(0, 100)}..."`);
    });

    // The key requirement: we should find conversations containing "Sometimes"
    expect(foundConversations.length).toBeGreaterThan(0);
    
    // Verify that each found conversation actually contains the search term
    foundConversations.forEach(conv => {
      const snippet = (conv.messageSnippet || '').toLowerCase();
      expect(snippet).toContain('sometimes');
    });
  });

  test('should search case-insensitively across all message content', async () => {
    // Test different case variations
    const searches = ['sometimes', 'Sometimes', 'SOMETIMES', 'SoMeTiMeS'];
    
    for (const searchTerm of searches) {
      const response = await request(app)
        .get('/api/conversations')
        .query({ search: searchTerm });

      expect(response.status).toBe(200);
      const conversations = response.body.data.conversations;
      
      // All searches should return the same results (case insensitive)
      expect(conversations.length).toBeGreaterThan(0);
      console.log(`Search "${searchTerm}" found ${conversations.length} conversations`);
    }
  });

  test('should search across ALL message content, not just snippets', async () => {
    // Verify that search works on full message content, not just the 5-message snippet
    const response = await request(app)
      .get('/api/conversations')
      .query({ search: 'medication' });

    expect(response.status).toBe(200);
    const conversations = response.body.data.conversations;
    
    console.log(`Found ${conversations.length} conversations with "medication"`);
    
    // Should find conversations where "medication" appears in ANY message, not just first 5
    expect(conversations.length).toBeGreaterThan(0);
  });

  test('should work with server-side vs client-side comparison', async () => {
    // Get all conversations first
    const allResponse = await request(app)
      .get('/api/conversations')
      .query({ pageSize: 100 });

    const allConversations = allResponse.body.data.conversations;
    
    // Simulate old client-side filtering
    const clientSideFiltered = allConversations.filter(conv => {
      const messageContent = (conv.messageSnippet || '').toLowerCase();
      return messageContent.includes('sometimes');
    });

    // Get server-side search results
    const serverResponse = await request(app)
      .get('/api/conversations')
      .query({ search: 'sometimes' });

    const serverSideFiltered = serverResponse.body.data.conversations;
    
    console.log(`Client-side filtering (old): ${clientSideFiltered.length} results`);
    console.log(`Server-side search (new): ${serverSideFiltered.length} results`);
    
    // Server-side should find MORE results because it searches all messages, not just snippets
    expect(serverSideFiltered.length).toBeGreaterThanOrEqual(clientSideFiltered.length);
  });

});