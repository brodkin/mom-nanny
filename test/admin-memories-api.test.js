const request = require('supertest');
const express = require('express');
const DatabaseManager = require('../services/database-manager');
const MemoryService = require('../services/memory-service');
const adminMemoriesRouter = require('../routes/api/admin-memories');

/**
 * Test suite for Admin Memories API endpoints
 * Tests comprehensive memory management API for the compassionate AI companion system.
 * 
 * Covered endpoints:
 * - GET /api/admin/memories - List all memories with pagination
 * - GET /api/admin/memories/search - Search memories by query
 * - GET /api/admin/memories/stats - Get memory statistics
 * - GET /api/admin/memories/:key - Get specific memory
 * - POST /api/admin/memories - Create new memory
 * - PUT /api/admin/memories/:key - Update memory
 * - DELETE /api/admin/memories/:key - Delete memory
 */

describe('Admin Memories API', () => {
  let app;
  let testDb;
  let memoryService;
  let originalConsoleError;

  beforeAll(async () => {
    // Reset singleton to use test database
    DatabaseManager.resetInstance();
    
    // Override the getInstance to return our test database
    const originalGetInstance = DatabaseManager.getInstance;
    DatabaseManager.getInstance = () => {
      if (!testDb) {
        testDb = new DatabaseManager('./test-admin-memories.db');
      }
      return testDb;
    };
    
    // Create test database instance
    testDb = new DatabaseManager('./test-admin-memories.db');
    await testDb.waitForInitialization();

    // Create MemoryService instance
    memoryService = new MemoryService(testDb);
    await memoryService.initialize();

    // Create Express app with admin memories router
    app = express();
    app.use(express.json());
    app.use('/api/admin/memories', adminMemoriesRouter);

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
    if (testDb) {
      await testDb.close();
    }
    
    // Restore original getInstance
    DatabaseManager.resetInstance();
  });

  beforeEach(async () => {
    // Clear memories table before each test
    await testDb.run('DELETE FROM memories');
    
    // Reset memory service cache
    await memoryService.loadMemoriesIntoCache();
    
    // Add some test memories for most tests
    await testDb.run(`
      INSERT INTO memories (memory_key, memory_content, category, created_at, updated_at)
      VALUES 
        ('francines-son-ryan', 'Ryan is her son who visits on weekends and lives in Portland', 'family', datetime('now', '-5 days'), datetime('now', '-2 days')),
        ('favorite-color-blue', 'Francine loves the color blue, especially sky blue', 'preferences', datetime('now', '-3 days'), datetime('now', '-1 day')),
        ('morning-routine', 'She likes to have coffee at 8am and watch the news', 'preferences', datetime('now', '-2 days'), datetime('now')),
        ('avoid-medical-topics', 'Avoid discussing serious medical procedures as they cause anxiety', 'topics_to_avoid', datetime('now', '-1 day'), datetime('now'))
    `);
    
    // Reload cache with test data
    await memoryService.loadMemoriesIntoCache();
  });

  async function setupTestData() {
    // Create memories table if it doesn't exist
    await testDb.run(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_key TEXT UNIQUE NOT NULL,
        memory_content TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  describe('GET /api/admin/memories', () => {
    it('should return all memories with default pagination', async () => {
      const response = await request(app)
        .get('/api/admin/memories')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('memories');
      expect(response.body.data).toHaveProperty('pagination');
      
      const { memories, pagination } = response.body.data;
      expect(Array.isArray(memories)).toBe(true);
      expect(memories).toHaveLength(4);
      expect(pagination).toEqual({
        offset: 0,
        limit: 50,
        total: 4,
        hasMore: false
      });

      // Check memory structure
      const memory = memories[0];
      expect(memory).toHaveProperty('key');
      expect(memory).toHaveProperty('content');
      expect(memory).toHaveProperty('category');
      expect(memory).toHaveProperty('created_at');
      expect(memory).toHaveProperty('updated_at');
    });

    it('should support custom pagination with limit and offset', async () => {
      const response = await request(app)
        .get('/api/admin/memories?limit=2&offset=1')
        .expect(200);

      expect(response.body.success).toBe(true);
      const { memories, pagination } = response.body.data;
      
      expect(memories).toHaveLength(2);
      expect(pagination).toEqual({
        offset: 1,
        limit: 2,
        total: 4,
        hasMore: true
      });
    });

    it('should handle invalid pagination parameters gracefully', async () => {
      const response = await request(app)
        .get('/api/admin/memories?limit=invalid&offset=-5')
        .expect(200);

      expect(response.body.success).toBe(true);
      const { pagination } = response.body.data;
      
      // Should use defaults for invalid values
      expect(pagination.limit).toBe(50);
      expect(pagination.offset).toBe(0);
    });

    it('should return empty result when no memories exist', async () => {
      // Clear all memories
      await testDb.run('DELETE FROM memories');
      await memoryService.loadMemoriesIntoCache();

      const response = await request(app)
        .get('/api/admin/memories')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.memories).toHaveLength(0);
      expect(response.body.data.pagination.total).toBe(0);
    });
  });

  describe('GET /api/admin/memories/search', () => {
    it('should search memories by partial key match', async () => {
      const response = await request(app)
        .get('/api/admin/memories/search?query=ryan')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.memories).toHaveLength(1);
      expect(response.body.data.memories[0].key).toBe('francines-son-ryan');
    });

    it('should return multiple matches for broader queries', async () => {
      const response = await request(app)
        .get('/api/admin/memories/search?query=favorite')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.memories).toHaveLength(1);
      expect(response.body.data.memories[0].key).toBe('favorite-color-blue');
    });

    it('should return empty result for no matches', async () => {
      const response = await request(app)
        .get('/api/admin/memories/search?query=nonexistent')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.memories).toHaveLength(0);
    });

    it('should require query parameter', async () => {
      const response = await request(app)
        .get('/api/admin/memories/search')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Query parameter is required');
    });

    it('should handle empty query parameter', async () => {
      const response = await request(app)
        .get('/api/admin/memories/search?query=')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Query parameter is required');
    });
  });

  describe('GET /api/admin/memories/stats', () => {
    it('should return comprehensive memory statistics', async () => {
      const response = await request(app)
        .get('/api/admin/memories/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalMemories', 4);
      expect(response.body.data).toHaveProperty('categoriesUsed', 3);
      expect(response.body.data).toHaveProperty('byCategory');
      
      const { byCategory } = response.body.data;
      expect(byCategory).toHaveProperty('family', 1);
      expect(byCategory).toHaveProperty('preferences', 2);
      expect(byCategory).toHaveProperty('topics_to_avoid', 1);
    });

    it('should return zero stats when no memories exist', async () => {
      // Clear all memories
      await testDb.run('DELETE FROM memories');

      const response = await request(app)
        .get('/api/admin/memories/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalMemories).toBe(0);
      expect(response.body.data.categoriesUsed).toBe(0);
      expect(response.body.data.byCategory).toEqual({});
    });
  });

  describe('GET /api/admin/memories/:key', () => {
    it('should return specific memory by key', async () => {
      const response = await request(app)
        .get('/api/admin/memories/francines-son-ryan')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('key', 'francines-son-ryan');
      expect(response.body.data).toHaveProperty('content', 'Ryan is her son who visits on weekends and lives in Portland');
      expect(response.body.data).toHaveProperty('category', 'family');
    });

    it('should return 404 for non-existent memory', async () => {
      const response = await request(app)
        .get('/api/admin/memories/nonexistent-key')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Memory not found');
    });

    it('should handle key normalization', async () => {
      // Test that spaces and special characters are handled
      const response = await request(app)
        .get('/api/admin/memories/francines%20son%20ryan')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.key).toBe('francines-son-ryan');
    });
  });

  describe('POST /api/admin/memories', () => {
    it('should create new memory with valid data', async () => {
      const newMemory = {
        key: 'favorite-pet-max',
        content: 'Max is her beloved golden retriever who passed away 2 years ago',
        category: 'family'
      };

      const response = await request(app)
        .post('/api/admin/memories')
        .send(newMemory)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('key', 'favorite-pet-max');
      expect(response.body.data).toHaveProperty('action', 'created');

      // Verify memory was actually stored
      const getResponse = await request(app)
        .get('/api/admin/memories/favorite-pet-max')
        .expect(200);

      expect(getResponse.body.data.content).toBe(newMemory.content);
      expect(getResponse.body.data.category).toBe(newMemory.category);
    });

    it('should create memory with default category when not specified', async () => {
      const newMemory = {
        key: 'test-memory',
        content: 'Test content without category'
      };

      const response = await request(app)
        .post('/api/admin/memories')
        .send(newMemory)
        .expect(201);

      expect(response.body.success).toBe(true);
      
      // Verify default category
      const getResponse = await request(app)
        .get('/api/admin/memories/test-memory')
        .expect(200);

      expect(getResponse.body.data.category).toBe('general');
    });

    it('should normalize memory key', async () => {
      const newMemory = {
        key: 'Favorite TV Show!',
        content: 'She loves watching classic movies',
        category: 'preferences'
      };

      const response = await request(app)
        .post('/api/admin/memories')
        .send(newMemory)
        .expect(201);

      expect(response.body.data.key).toBe('favorite-tv-show');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/admin/memories')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Key and content are required');
    });

    it('should validate missing content', async () => {
      const response = await request(app)
        .post('/api/admin/memories')
        .send({ key: 'test-key' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Key and content are required');
    });

    it('should validate missing key', async () => {
      const response = await request(app)
        .post('/api/admin/memories')
        .send({ content: 'test content' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Key and content are required');
    });

    it('should handle duplicate key by updating existing memory', async () => {
      const duplicateMemory = {
        key: 'francines-son-ryan',
        content: 'Updated: Ryan is her son who visits twice a week now',
        category: 'family'
      };

      const response = await request(app)
        .post('/api/admin/memories')
        .send(duplicateMemory)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.action).toBe('updated');

      // Verify content was updated
      const getResponse = await request(app)
        .get('/api/admin/memories/francines-son-ryan')
        .expect(200);

      expect(getResponse.body.data.content).toBe(duplicateMemory.content);
    });
  });

  describe('PUT /api/admin/memories/:key', () => {
    it('should update existing memory', async () => {
      const updateData = {
        content: 'Updated: Ryan is her son who visits on Sundays and lives in Seattle now',
        category: 'family'
      };

      const response = await request(app)
        .put('/api/admin/memories/francines-son-ryan')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('key', 'francines-son-ryan');
      expect(response.body.data).toHaveProperty('action', 'updated');

      // Verify update
      const getResponse = await request(app)
        .get('/api/admin/memories/francines-son-ryan')
        .expect(200);

      expect(getResponse.body.data.content).toBe(updateData.content);
      expect(getResponse.body.data.category).toBe(updateData.category);
    });

    it('should return 404 for non-existent memory', async () => {
      const updateData = {
        content: 'Updated content',
        category: 'general'
      };

      const response = await request(app)
        .put('/api/admin/memories/nonexistent-key')
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Memory not found');
    });

    it('should validate required content field', async () => {
      const response = await request(app)
        .put('/api/admin/memories/francines-son-ryan')
        .send({ category: 'family' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Content is required');
    });

    it('should use default category if not provided', async () => {
      const response = await request(app)
        .put('/api/admin/memories/francines-son-ryan')
        .send({ content: 'Updated content only' })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify category defaults to general
      const getResponse = await request(app)
        .get('/api/admin/memories/francines-son-ryan')
        .expect(200);

      expect(getResponse.body.data.category).toBe('general');
    });
  });

  describe('DELETE /api/admin/memories/:key', () => {
    it('should delete existing memory', async () => {
      const response = await request(app)
        .delete('/api/admin/memories/francines-son-ryan')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('key', 'francines-son-ryan');
      expect(response.body.data).toHaveProperty('action', 'removed');

      // Verify deletion
      const getResponse = await request(app)
        .get('/api/admin/memories/francines-son-ryan')
        .expect(404);

      expect(getResponse.body.error).toBe('Memory not found');
    });

    it('should return 404 for non-existent memory', async () => {
      const response = await request(app)
        .delete('/api/admin/memories/nonexistent-key')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Memory not found');
    });

    it('should handle key normalization in deletion', async () => {
      // Test deleting with non-normalized key
      const response = await request(app)
        .delete('/api/admin/memories/Francines%20Son%20Ryan')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.key).toBe('francines-son-ryan');
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      // Close database to simulate error
      await testDb.close();

      const response = await request(app)
        .get('/api/admin/memories')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Internal server error');

      // Restore database for other tests
      testDb = new DatabaseManager('./test-admin-memories.db');
      await testDb.waitForInitialization();
      memoryService = new MemoryService(testDb);
      await memoryService.initialize();
    });

    it('should validate JSON payload', async () => {
      const response = await request(app)
        .post('/api/admin/memories')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      // Express automatically handles malformed JSON and returns its own error format
      // The response may not have our standard structure, which is expected
      expect(response.status).toBe(400);
    });
  });
});