/**
 * Test suite for server-side search functionality in conversations API
 * Tests comprehensive search across message content, metadata, and care indicators
 */

const request = require('supertest');
const express = require('express');
const DatabaseManager = require('../services/database-manager');

// Create a test app without the server startup
const conversationsRouter = require('../routes/api/conversations');
const searchRouter = require('../routes/api/search');

const app = express();
app.use(express.json());
app.use('/api/conversations', conversationsRouter);
app.use('/api/search', searchRouter);

describe('Conversations Search API', () => {
  let dbManager;
  let testConversationIds = [];

  beforeAll(async () => {
    // Initialize database
    dbManager = DatabaseManager.getInstance();
    await dbManager.waitForInitialization();
    
    // Create test data
    await createTestData();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  async function createTestData() {
    // Create test conversations with specific content for search testing
    const testData = [
      {
        callSid: 'TEST_SEARCH_001',
        startTime: '2024-01-15T10:00:00Z',
        endTime: '2024-01-15T10:05:00Z',
        duration: 300,
        messages: [
          { role: 'user', content: 'Sometimes I forget to take my medication', timestamp: '2024-01-15T10:00:30Z' },
          { role: 'assistant', content: 'I understand how important it is to remember your medication. Would you like me to help you set up reminders?', timestamp: '2024-01-15T10:01:00Z' },
          { role: 'user', content: 'The nurse said my blood pressure is too high', timestamp: '2024-01-15T10:02:00Z' }
        ],
        summary: {
          mentalStateIndicators: {
            overallMoodTrend: 'mild_anxiety',
            anxietyLevel: 4
          },
          careIndicators: {
            medicationConcerns: ['forgetfulness'],
            painLevel: 2,
            staffComplaints: []
          }
        }
      },
      {
        callSid: 'TEST_SEARCH_002', 
        startTime: '2024-01-16T14:00:00Z',
        endTime: '2024-01-16T14:08:00Z',
        duration: 480,
        messages: [
          { role: 'user', content: 'I had oatmeal for breakfast today', timestamp: '2024-01-16T14:00:30Z' },
          { role: 'assistant', content: 'That sounds delicious! Oatmeal is very healthy.', timestamp: '2024-01-16T14:01:00Z' },
          { role: 'user', content: 'The staff here is always so kind', timestamp: '2024-01-16T14:02:00Z' }
        ],
        summary: {
          mentalStateIndicators: {
            overallMoodTrend: 'calm',
            anxietyLevel: 2
          },
          careIndicators: {
            medicationConcerns: [],
            painLevel: 0,
            staffComplaints: []
          }
        }
      },
      {
        callSid: 'TEST_SEARCH_003',
        startTime: '2024-01-17T09:00:00Z', 
        endTime: '2024-01-17T09:12:00Z',
        duration: 720,
        messages: [
          { role: 'user', content: 'My knee is hurting really badly', timestamp: '2024-01-17T09:00:30Z' },
          { role: 'assistant', content: 'I\'m sorry to hear you\'re in pain. Have you told the nurses about your knee?', timestamp: '2024-01-17T09:01:00Z' },
          { role: 'user', content: 'They never listen to me sometimes', timestamp: '2024-01-17T09:02:00Z' }
        ],
        summary: {
          mentalStateIndicators: {
            overallMoodTrend: 'high_anxiety',
            anxietyLevel: 7
          },
          careIndicators: {
            medicationConcerns: [],
            painLevel: 8,
            staffComplaints: ['not listening']
          }
        }
      }
    ];

    for (const data of testData) {
      // Insert conversation
      const conversationResult = await dbManager.run(
        'INSERT INTO conversations (call_sid, start_time, end_time, duration) VALUES (?, ?, ?, ?)',
        [data.callSid, data.startTime, data.endTime, data.duration]
      );
      
      const conversationId = conversationResult.lastID;
      testConversationIds.push(conversationId);

      // Insert messages
      for (const message of data.messages) {
        await dbManager.run(
          'INSERT INTO messages (conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?)',
          [conversationId, message.role, message.content, message.timestamp]
        );
      }

      // Insert summary
      await dbManager.run(
        'INSERT INTO summaries (conversation_id, summary_text) VALUES (?, ?)',
        [conversationId, JSON.stringify(data.summary)]
      );
    }
  }

  async function cleanupTestData() {
    for (const conversationId of testConversationIds) {
      await dbManager.run('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
      await dbManager.run('DELETE FROM summaries WHERE conversation_id = ?', [conversationId]);
      await dbManager.run('DELETE FROM conversations WHERE id = ?', [conversationId]);
    }
  }

  describe('Server-side search implementation', () => {
    
    test('should find conversations by message content search', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .query({ search: 'medication' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const conversations = response.body.data.conversations;
      expect(conversations.length).toBeGreaterThanOrEqual(1);
      
      // Check that our test conversation is included
      const testConversation = conversations.find(c => c.callSid === 'TEST_SEARCH_001');
      expect(testConversation).toBeDefined();
    });

    test('should find conversations with "Sometimes" search term', async () => {
      // This tests the specific issue mentioned in requirements
      const response = await request(app)
        .get('/api/conversations')
        .query({ search: 'Sometimes' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const conversations = response.body.data.conversations;
      expect(conversations.length).toBeGreaterThanOrEqual(2); // Should find both TEST_SEARCH_001 and TEST_SEARCH_003
      
      const callSids = conversations.map(c => c.callSid);
      expect(callSids).toContain('TEST_SEARCH_001'); // "Sometimes I forget"
      expect(callSids).toContain('TEST_SEARCH_003'); // "They never listen to me sometimes"
    });

    test('should perform case-insensitive search', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .query({ search: 'OATMEAL' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const conversations = response.body.data.conversations;
      expect(conversations.length).toBeGreaterThanOrEqual(1);
      
      // Check that our test conversation is included
      const testConversation = conversations.find(c => c.callSid === 'TEST_SEARCH_002');
      expect(testConversation).toBeDefined();
    });

    test('should search across care indicators metadata', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .query({ search: 'forgetfulness' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const conversations = response.body.data.conversations;
      expect(conversations).toHaveLength(1);
      expect(conversations[0].callSid).toBe('TEST_SEARCH_001');
    });

    test('should search in call SID', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .query({ search: 'TEST_SEARCH_002' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const conversations = response.body.data.conversations;
      expect(conversations).toHaveLength(1);
      expect(conversations[0].callSid).toBe('TEST_SEARCH_002');
    });

    test('should combine search with other filters', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .query({ 
          search: 'medication',
          emotionalStates: ['mild_anxiety']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const conversations = response.body.data.conversations;
      expect(conversations.length).toBeGreaterThanOrEqual(1);
      
      // All results should have mild_anxiety emotional state and contain 'medication'
      conversations.forEach(conv => {
        expect(conv.emotionalState).toBe('mild_anxiety');
      });
      
      // Check that our test conversation is included
      const testConversation = conversations.find(c => c.callSid === 'TEST_SEARCH_001');
      expect(testConversation).toBeDefined();
    });

    test('should maintain pagination with search', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .query({ 
          search: 'nurse',
          page: 1,
          pageSize: 10
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.pageSize).toBe(10);
    });

    test('should return empty results for non-existent terms', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .query({ search: 'nonexistentterm12345' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const conversations = response.body.data.conversations;
      expect(conversations).toHaveLength(0);
    });

    test('should handle empty search parameter', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .query({ search: '' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Should return normal results when search is empty
    });

  });

  describe('Search performance and SQL injection protection', () => {
    
    test('should sanitize search input to prevent SQL injection', async () => {
      const maliciousInput = "'; DROP TABLE conversations; --";
      
      const response = await request(app)
        .get('/api/conversations')
        .query({ search: maliciousInput });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Should not cause server error and should safely handle the input
    });

    test('should handle special characters in search', async () => {
      const specialChars = "blood pressure (high) & medication!";
      
      const response = await request(app)
        .get('/api/conversations')
        .query({ search: specialChars });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

  });

});