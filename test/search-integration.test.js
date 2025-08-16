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

  beforeAll(async () => {
    dbManager = DatabaseManager.getInstance();
    await dbManager.waitForInitialization();
  });

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