const request = require('supertest');
const express = require('express');
const DatabaseManager = require('../services/database-manager');
const conversationsRouter = require('../routes/api/conversations');

/**
 * Test suite for Conversations API endpoints
 * Tests comprehensive API endpoints for the Conversations page in the compassionate AI companion system.
 * 
 * Covered endpoints:
 * - GET /api/conversations - List conversations with pagination, sorting, filtering
 * - GET /api/conversations/:id - Get single conversation with full transcript
 * - GET /api/conversations/analytics - Get aggregate analytics data
 */

describe('Conversations API', () => {
  let app;
  let testDb;
  let conversationId1;
  let conversationId2;
  let originalConsoleError;

  beforeAll(async () => {
    // Reset singleton to use test database
    DatabaseManager.resetInstance();
    
    // Override the getInstance to return our test database
    const _originalGetInstance = DatabaseManager.getInstance;
    DatabaseManager.getInstance = () => {
      if (!testDb) {
        testDb = new DatabaseManager('./test-conversations.db');
      }
      return testDb;
    };
    
    // Create test database instance
    testDb = new DatabaseManager('./test-conversations.db');
    await testDb.waitForInitialization();

    // Create Express app with conversations router
    app = express();
    app.use(express.json());
    app.use('/api/conversations', conversationsRouter);

    // Suppress console errors during testing
    originalConsoleError = console.error;
    console.error = jest.fn();

    // Set up test data
    await setupTestData();
  });

  afterAll(async () => {
    // Restore console.error
    console.error = originalConsoleError;
    
    // Clean up test database
    if (testDb && testDb.db) {
      try {
        testDb.db.close();
      } catch (error) {
        console.error('Error closing test database:', error);
      }
    }
    
    // Reset singleton instance
    DatabaseManager.resetInstance();
    
    // Remove test database file
    const fs = require('fs');
    try {
      if (fs.existsSync('./test-conversations.db')) {
        fs.unlinkSync('./test-conversations.db');
      }
      // Also clean up WAL files
      if (fs.existsSync('./test-conversations.db-wal')) {
        fs.unlinkSync('./test-conversations.db-wal');
      }
      if (fs.existsSync('./test-conversations.db-shm')) {
        fs.unlinkSync('./test-conversations.db-shm');
      }
    } catch (error) {
      console.error('Error removing test database files:', error);
    }
  });

  async function setupTestData() {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    // Insert test conversations
    const conversation1Result = testDb.runSync(`
      INSERT INTO conversations (call_sid, start_time, end_time, duration, caller_info)
      VALUES (?, ?, ?, ?, ?)
    `, [
      'CA1234567890abcdef1234567890abcdef12',
      yesterday.toISOString(),
      new Date(yesterday.getTime() + 15 * 60 * 1000).toISOString(), // 15 minutes
      900, // 15 minutes in seconds
      JSON.stringify({ from: '+15551234567', to: '+15559876543' })
    ]);
    conversationId1 = conversation1Result.lastInsertRowid;

    const conversation2Result = testDb.runSync(`
      INSERT INTO conversations (call_sid, start_time, end_time, duration, caller_info)
      VALUES (?, ?, ?, ?, ?)
    `, [
      'CA2234567890abcdef1234567890abcdef23',
      twoDaysAgo.toISOString(),
      new Date(twoDaysAgo.getTime() + 8 * 60 * 1000).toISOString(), // 8 minutes
      480, // 8 minutes in seconds
      JSON.stringify({ from: '+15551234567', to: '+15559876543' })
    ]);
    conversationId2 = conversation2Result.lastInsertRowid;

    // Insert test messages
    testDb.runSync(`
      INSERT INTO messages (conversation_id, role, content, timestamp)
      VALUES 
        (?, 'assistant', 'Hello Francine! How are you feeling today?', ?),
        (?, 'user', 'I feel anxious about my medication...', ?),
        (?, 'assistant', 'I understand your concern about medication. That can feel worrying.', ?)
    `, [
      conversationId1,
      yesterday.toISOString(),
      conversationId1,
      new Date(yesterday.getTime() + 30 * 1000).toISOString(),
      conversationId1,
      new Date(yesterday.getTime() + 60 * 1000).toISOString()
    ]);

    testDb.runSync(`
      INSERT INTO messages (conversation_id, role, content, timestamp)
      VALUES 
        (?, 'assistant', 'Good morning! Its a beautiful day today.', ?),
        (?, 'user', 'I cannot remember where I put my glasses...', ?),
        (?, 'assistant', 'That happens to all of us sometimes. Lets think about where you might have put them.', ?)
    `, [
      conversationId2,
      twoDaysAgo.toISOString(),
      conversationId2,
      new Date(twoDaysAgo.getTime() + 45 * 1000).toISOString(),
      conversationId2,
      new Date(twoDaysAgo.getTime() + 90 * 1000).toISOString()
    ]);

    // Insert test summaries with mental state data
    testDb.runSync(`
      INSERT INTO summaries (conversation_id, summary_text)
      VALUES (?, ?)
    `, [
      conversationId1,
      JSON.stringify({
        callSid: 'CA1234567890abcdef1234567890abcdef12',
        startTime: yesterday.toISOString(),
        endTime: new Date(yesterday.getTime() + 15 * 60 * 1000).toISOString(),
        mentalStateIndicators: {
          anxietyLevel: 7,
          agitationLevel: 3,
          positiveEngagement: 5,
          overallMoodTrend: 'concerned'
        },
        careIndicators: {
          medicationConcerns: ['anxiety about pills', 'memory issues'],
          painLevel: 2,
          staffComplaints: []
        },
        conversationMetrics: {
          topicsDiscussed: ['medication', 'anxiety', 'daily routine'],
          repetitionCount: 2,
          interruptionCount: 1
        }
      })
    ]);

    testDb.runSync(`
      INSERT INTO summaries (conversation_id, summary_text)
      VALUES (?, ?)
    `, [
      conversationId2,
      JSON.stringify({
        callSid: 'CA2234567890abcdef1234567890abcdef23',
        startTime: twoDaysAgo.toISOString(),
        endTime: new Date(twoDaysAgo.getTime() + 8 * 60 * 1000).toISOString(),
        mentalStateIndicators: {
          anxietyLevel: 4,
          agitationLevel: 2,
          positiveEngagement: 8,
          overallMoodTrend: 'stable'
        },
        careIndicators: {
          medicationConcerns: [],
          painLevel: 1,
          staffComplaints: []
        },
        conversationMetrics: {
          topicsDiscussed: ['glasses', 'memory', 'daily activities'],
          repetitionCount: 0,
          interruptionCount: 0
        }
      })
    ]);

    // Insert test analytics data
    testDb.runSync(`
      INSERT INTO analytics (conversation_id, sentiment_scores, keywords, patterns)
      VALUES (?, ?, ?, ?)
    `, [
      conversationId1,
      JSON.stringify({ anxiety: 7, agitation: 3, positiveEngagement: 5 }),
      JSON.stringify(['medication', 'anxiety', 'daily routine']),
      JSON.stringify({ responseLatency: 'moderate', coherenceLevel: 'good', memoryIndicators: ['medication_concern'] })
    ]);

    testDb.runSync(`
      INSERT INTO analytics (conversation_id, sentiment_scores, keywords, patterns)
      VALUES (?, ?, ?, ?)
    `, [
      conversationId2,
      JSON.stringify({ anxiety: 4, agitation: 2, positiveEngagement: 8 }),
      JSON.stringify(['glasses', 'memory', 'daily activities']),
      JSON.stringify({ responseLatency: 'good', coherenceLevel: 'excellent', memoryIndicators: ['mild_forgetfulness'] })
    ]);
  }

  describe('GET /api/conversations', () => {
    test('should return conversations list with default pagination', async () => {
      const response = await request(app)
        .get('/api/conversations');
        
      if (response.status !== 200) {
        console.log('Error response:', response.status, response.body);
      }
      
      expect(response.status).toBe(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          conversations: expect.any(Array),
          total: expect.any(Number),
          page: 1,
          pageSize: 20,
          totalPages: expect.any(Number)
        }
      });

      expect(response.body.data.conversations).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
    });

    test('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/api/conversations?page=1&pageSize=1')
        .expect(200);

      expect(response.body.data.conversations).toHaveLength(1);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.pageSize).toBe(1);
      expect(response.body.data.totalPages).toBe(2);
    });

    test('should sort conversations by date descending by default', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .expect(200);

      const conversations = response.body.data.conversations;
      expect(conversations).toHaveLength(2);
      
      // Most recent conversation should be first
      expect(new Date(conversations[0].startTime) > new Date(conversations[1].startTime)).toBe(true);
    });

    test('should handle sorting parameters', async () => {
      const response = await request(app)
        .get('/api/conversations?sortBy=duration&sortOrder=asc')
        .expect(200);

      const conversations = response.body.data.conversations;
      expect(conversations[0].duration <= conversations[1].duration).toBe(true);
    });

    test('should filter by date range', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dateFrom = yesterday.toISOString().split('T')[0];
      const dateTo = new Date().toISOString().split('T')[0];

      const response = await request(app)
        .get(`/api/conversations?dateFrom=${dateFrom}&dateTo=${dateTo}`)
        .expect(200);

      expect(response.body.data.conversations).toHaveLength(1);
      expect(response.body.data.conversations[0].callSid).toBe('CA1234567890abcdef1234567890abcdef12');
    });

    test('should filter by emotional states', async () => {
      const response = await request(app)
        .get('/api/conversations?emotionalStates=concerned')
        .expect(200);

      expect(response.body.data.conversations).toHaveLength(1);
      expect(response.body.data.conversations[0].emotionalState).toBe('concerned');
    });

    test('should filter by duration range', async () => {
      const response = await request(app)
        .get('/api/conversations?minDuration=500&maxDuration=1000')
        .expect(200);

      expect(response.body.data.conversations).toHaveLength(1);
      expect(response.body.data.conversations[0].duration).toBe(900);
    });

    test('should include summary statistics and emotional indicators', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .expect(200);

      const conversation = response.body.data.conversations.find(
        c => c.callSid === 'CA1234567890abcdef1234567890abcdef12'
      );

      expect(conversation).toMatchObject({
        id: expect.any(Number),
        callSid: 'CA1234567890abcdef1234567890abcdef12',
        startTime: expect.any(String),
        endTime: expect.any(String),
        duration: 900,
        emotionalState: 'concerned',
        anxietyLevel: 7,
        careIndicators: expect.objectContaining({
          medicationConcerns: expect.any(Array),
          painLevel: expect.any(Number)
        }),
        messageCount: expect.any(Number)
      });
    });

    test('should handle invalid pagination parameters', async () => {
      const response = await request(app)
        .get('/api/conversations?page=-1&pageSize=abc')
        .expect(200);

      // Should default to valid values
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.pageSize).toBe(20);
    });

    test('should handle invalid sorting parameters', async () => {
      const response = await request(app)
        .get('/api/conversations?sortBy=invalidColumn&sortOrder=invalidOrder')
        .expect(200);

      // Should still return results with default sorting
      expect(response.body.success).toBe(true);
      expect(response.body.data.conversations).toBeDefined();
    });
  });

  describe('GET /api/conversations/:id', () => {
    test('should return single conversation with full transcript', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId1}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: conversationId1,
          callSid: 'CA1234567890abcdef1234567890abcdef12',
          startTime: expect.any(String),
          endTime: expect.any(String),
          duration: 900,
          messages: expect.any(Array),
          analytics: expect.any(Object),
          emotionalTimeline: expect.any(Array),
          careIndicators: expect.any(Object)
        }
      });

      expect(response.body.data.messages).toHaveLength(3);
      expect(response.body.data.messages[0]).toMatchObject({
        role: 'assistant',
        content: expect.any(String),
        timestamp: expect.any(String)
      });
    });

    test('should include emotional state timeline data', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId1}`)
        .expect(200);

      const { emotionalTimeline } = response.body.data;
      expect(emotionalTimeline).toHaveLength(3); // One per message
      expect(emotionalTimeline[0]).toMatchObject({
        timestamp: expect.any(String),
        anxietyLevel: expect.any(Number),
        agitationLevel: expect.any(Number),
        positiveEngagement: expect.any(Number)
      });
    });

    test('should include care indicators', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId1}`)
        .expect(200);

      const { careIndicators } = response.body.data;
      expect(careIndicators).toMatchObject({
        medicationConcerns: ['anxiety about pills', 'memory issues'],
        painLevel: 2,
        staffComplaints: [],
        keyTopics: expect.any(Array)
      });
    });

    test('should include analytics data with sentiment and patterns', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId1}`)
        .expect(200);

      const { analytics } = response.body.data;
      expect(analytics).toMatchObject({
        sentimentScores: {
          anxiety: 7,
          agitation: 3,
          positiveEngagement: 5
        },
        keywords: expect.arrayContaining(['medication', 'anxiety']),
        patterns: expect.objectContaining({
          responseLatency: expect.any(String),
          coherenceLevel: expect.any(String)
        }),
        conversationMetrics: expect.objectContaining({
          topicsDiscussed: expect.any(Array),
          repetitionCount: expect.any(Number),
          interruptionCount: expect.any(Number)
        })
      });
    });

    test('should return 404 for non-existent conversation', async () => {
      const response = await request(app)
        .get('/api/conversations/99999')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Conversation not found'
      });
    });

    test('should return 400 for invalid conversation ID', async () => {
      const response = await request(app)
        .get('/api/conversations/invalid')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid conversation ID')
      });
    });
  });

  describe('GET /api/conversations/analytics', () => {
    test('should return aggregate analytics data', async () => {
      const response = await request(app)
        .get('/api/conversations/analytics')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          emotionalTrends: expect.any(Object),
          patternAnalysis: expect.any(Object),
          careConcerns: expect.any(Object),
          timeBasedStats: expect.any(Object)
        }
      });
    });

    test('should include emotional trends over time', async () => {
      const response = await request(app)
        .get('/api/conversations/analytics')
        .expect(200);

      const { emotionalTrends } = response.body.data;
      expect(emotionalTrends).toMatchObject({
        averageAnxiety: expect.any(Number),
        averageAgitation: expect.any(Number),
        averagePositiveEngagement: expect.any(Number),
        trendOverTime: expect.any(Array)
      });

      // We expect averages based on our test data
      // Note: Analytics data may only be available for some conversations
      expect(emotionalTrends.averageAnxiety).toBeGreaterThan(0);
      expect(emotionalTrends.averagePositiveEngagement).toBeGreaterThan(0);
    });

    test('should include pattern analysis', async () => {
      const response = await request(app)
        .get('/api/conversations/analytics')
        .expect(200);

      const { patternAnalysis } = response.body.data;
      expect(patternAnalysis).toMatchObject({
        commonTopics: expect.any(Array),
        behavioralPatterns: expect.any(Object),
        responseEffectiveness: expect.any(Object)
      });

      expect(patternAnalysis.commonTopics).toContain('medication');
    });

    test('should include care concern frequency', async () => {
      const response = await request(app)
        .get('/api/conversations/analytics')
        .expect(200);

      const { careConcerns } = response.body.data;
      expect(careConcerns).toMatchObject({
        medicationRelated: expect.any(Number),
        memoryRelated: expect.any(Number),
        painRelated: expect.any(Number),
        staffRelated: expect.any(Number)
      });

      expect(careConcerns.medicationRelated).toBe(1);
    });

    test('should include time-based statistics', async () => {
      const response = await request(app)
        .get('/api/conversations/analytics')
        .expect(200);

      const { timeBasedStats } = response.body.data;
      expect(timeBasedStats).toMatchObject({
        averageDuration: expect.any(Number),
        peakCallTimes: expect.any(Array),
        dailyPatterns: expect.any(Object),
        weeklyTrends: expect.any(Array)
      });

      expect(timeBasedStats.averageDuration).toBe(690); // (900+480)/2
    });

    test('should handle date range filtering for analytics', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dateFrom = yesterday.toISOString().split('T')[0];
      const dateTo = new Date().toISOString().split('T')[0];

      const response = await request(app)
        .get(`/api/conversations/analytics?dateFrom=${dateFrom}&dateTo=${dateTo}`)
        .expect(200);

      // Should only include data from yesterday's conversation
      const { emotionalTrends } = response.body.data;
      expect(emotionalTrends.averageAnxiety).toBe(7);
    });
  });

  describe('Error handling', () => {
    test('should handle database connection errors gracefully', async () => {
      // Mock database error by closing the connection
      const originalDb = testDb.db;
      testDb.db = null;

      const response = await request(app)
        .get('/api/conversations')
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Failed to fetch conversations')
      });

      // Restore connection
      testDb.db = originalDb;
    });

    test('should handle malformed query parameters', async () => {
      const response = await request(app)
        .get('/api/conversations?pageSize=abc&minDuration=xyz');

      expect(response.status).toBe(200); // Should handle gracefully and use defaults
      expect(response.body.success).toBe(true);
      expect(response.body.data.pageSize).toBe(20); // Default value
    });
  });
});