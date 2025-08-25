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
    const _originalGetInstance = DatabaseManager.getInstance;
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
    
    // Add some test memories for most tests (mix of facts and regular memories)
    await testDb.run(`
      INSERT INTO memories (memory_key, memory_content, category, created_at, updated_at, is_fact)
      VALUES 
        ('francines-son-ryan', 'Ryan is her son who visits on weekends and lives in Portland', 'family', datetime('now', '-5 days'), datetime('now', '-2 days'), 0),
        ('favorite-color-blue', 'Francine loves the color blue, especially sky blue', 'preferences', datetime('now', '-3 days'), datetime('now', '-1 day'), 0),
        ('morning-routine', 'She likes to have coffee at 8am and watch the news', 'preferences', datetime('now', '-2 days'), datetime('now'), 0),
        ('avoid-medical-topics', 'Avoid discussing serious medical procedures as they cause anxiety', 'topics_to_avoid', datetime('now', '-1 day'), datetime('now'), 0),
        ('medical-fact-dementia', 'Dementia affects approximately 55 million people worldwide according to WHO', 'health', datetime('now', '-6 days'), datetime('now', '-3 days'), 1),
        ('care-fact-routine', 'Consistent daily routines help reduce anxiety in dementia patients', 'health', datetime('now', '-4 days'), datetime('now', '-1 day'), 1)
    `);
    
    // Reload cache with test data
    await memoryService.loadMemoriesIntoCache();
  });

  async function setupTestData() {
    // Create memories table if it doesn't exist (updated schema with is_fact column)
    await testDb.run(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_key TEXT UNIQUE NOT NULL,
        memory_content TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_fact BOOLEAN DEFAULT FALSE
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
      expect(memories).toHaveLength(6);
      expect(pagination).toEqual({
        offset: 0,
        limit: 50,
        total: 6,
        hasMore: false
      });

      // Check memory structure includes is_fact field
      const memory = memories[0];
      expect(memory).toHaveProperty('key');
      expect(memory).toHaveProperty('content');
      expect(memory).toHaveProperty('category');
      expect(memory).toHaveProperty('created_at');
      expect(memory).toHaveProperty('updated_at');
      expect(memory).toHaveProperty('is_fact');
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
        total: 6,
        hasMore: true
      });
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

    it('should require query parameter and handle empty results', async () => {
      // Test missing query parameter
      const noQueryResponse = await request(app)
        .get('/api/admin/memories/search')
        .expect(400);
      expect(noQueryResponse.body.success).toBe(false);
      expect(noQueryResponse.body.error).toBe('Query parameter is required');

      // Test no matches
      const noMatchResponse = await request(app)
        .get('/api/admin/memories/search?query=nonexistent')
        .expect(200);
      expect(noMatchResponse.body.success).toBe(true);
      expect(noMatchResponse.body.data.memories).toHaveLength(0);
    });
  });

  describe('GET /api/admin/memories/stats', () => {
    it('should return comprehensive memory statistics', async () => {
      const response = await request(app)
        .get('/api/admin/memories/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalMemories', 6);
      expect(response.body.data).toHaveProperty('categoriesUsed', 4);
      expect(response.body.data).toHaveProperty('byCategory');
      
      const { byCategory } = response.body.data;
      expect(byCategory).toHaveProperty('family', 1);
      expect(byCategory).toHaveProperty('preferences', 2);
      expect(byCategory).toHaveProperty('topics_to_avoid', 1);
      expect(byCategory).toHaveProperty('health', 2);
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
      expect(response.body.data).toHaveProperty('is_fact', false);
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
      expect(getResponse.body.data.is_fact).toBe(false); // Default should be false
    });

    it('should handle fact creation and validation', async () => {
      // Test fact creation
      const newFact = {
        key: 'alzheimers-fact',
        content: 'Alzheimers disease accounts for 60-70% of dementia cases worldwide',
        category: 'health',
        isFact: true
      };

      const factResponse = await request(app)
        .post('/api/admin/memories')
        .send(newFact)
        .expect(201);

      expect(factResponse.body.success).toBe(true);
      expect(factResponse.body.data.action).toBe('created');

      // Test invalid isFact parameter
      const invalidResponse = await request(app)
        .post('/api/admin/memories')
        .send({
          key: 'test-invalid',
          content: 'Test content',
          category: 'general',
          isFact: 'not-a-boolean'
        })
        .expect(400);

      expect(invalidResponse.body.success).toBe(false);
      expect(invalidResponse.body.error).toBe('isFact must be a boolean if provided');
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

    it('should validate required content field', async () => {
      const response = await request(app)
        .post('/api/admin/memories')
        .send({ key: 'test-key' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Content is required');
    });

    it('should auto-generate key when not provided', async () => {
      const response = await request(app)
        .post('/api/admin/memories')
        .send({ content: 'Test content for auto key generation', category: 'family' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('key');
      expect(response.body.data).toHaveProperty('keyGenerated', true);
      expect(response.body.data.key).toBeTruthy();
      expect(response.body.data.action).toBe('created');
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
      expect(response.body.data).toHaveProperty('oldKey', 'francines-son-ryan');
      expect(response.body.data).toHaveProperty('keyChanged', true);
      expect(response.body.data).toHaveProperty('action', 'updated_with_key_change');
      
      const newKey = response.body.data.key;
      expect(newKey).toBeTruthy();
      expect(newKey).not.toBe('francines-son-ryan'); // Key should change based on content

      // Verify update with new key
      const getResponse = await request(app)
        .get(`/api/admin/memories/${newKey}`)
        .expect(200);

      expect(getResponse.body.data.content).toBe(updateData.content);
      expect(getResponse.body.data.category).toBe(updateData.category);
      expect(getResponse.body.data.is_fact).toBe(false); // Should retain original value
    });

    it('should handle fact toggling and validation in updates', async () => {
      // Test updating memory to fact
      const toFactUpdate = {
        content: 'Updated: Family relationships are important for dementia patient wellbeing',
        category: 'health',
        isFact: true
      };

      const factResponse = await request(app)
        .put('/api/admin/memories/francines-son-ryan')
        .send(toFactUpdate)
        .expect(200);

      expect(factResponse.body.success).toBe(true);
      expect(factResponse.body.data).toHaveProperty('keyChanged', true);
      
      // Test validation for invalid isFact
      const invalidResponse = await request(app)
        .put('/api/admin/memories/favorite-color-blue')
        .send({ content: 'Test', isFact: 'invalid' })
        .expect(400);

      expect(invalidResponse.body.success).toBe(false);
      expect(invalidResponse.body.error).toBe('isFact must be a boolean if provided');
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
      expect(response.body.data).toHaveProperty('oldKey', 'francines-son-ryan');
      expect(response.body.data).toHaveProperty('keyChanged', true);
      
      const newKey = response.body.data.key;
      expect(newKey).toBeTruthy();

      // Verify category defaults to general with new key
      const getResponse = await request(app)
        .get(`/api/admin/memories/${newKey}`)
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

    it('should handle deletion with key normalization and 404 cases', async () => {
      // Test deleting with non-normalized key
      const normalizeResponse = await request(app)
        .delete('/api/admin/memories/Francines%20Son%20Ryan')
        .expect(200);

      expect(normalizeResponse.body.success).toBe(true);
      expect(normalizeResponse.body.data.key).toBe('francines-son-ryan');

      // Test 404 for non-existent memory
      const notFoundResponse = await request(app)
        .delete('/api/admin/memories/nonexistent-key')
        .expect(404);

      expect(notFoundResponse.body.success).toBe(false);
      expect(notFoundResponse.body.error).toBe('Memory not found');
    });
  });

  describe('Fact management integration', () => {
    it('should correctly identify facts and memories in responses', async () => {
      const response = await request(app)
        .get('/api/admin/memories')
        .expect(200);

      expect(response.body.success).toBe(true);
      const memories = response.body.data.memories;

      // Find a fact and a regular memory
      const fact = memories.find(m => m.key === 'medical-fact-dementia');
      const memory = memories.find(m => m.key === 'francines-son-ryan');

      expect(fact).toBeDefined();
      expect(fact.is_fact).toBe(true);
      expect(fact.content).toContain('Dementia affects approximately');

      expect(memory).toBeDefined();
      expect(memory.is_fact).toBe(false);
      expect(memory.content).toContain('Ryan is her son');
    });

    it('should handle searching both facts and memories', async () => {
      const response = await request(app)
        .get('/api/admin/memories/search?query=dementia')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.memories.length).toBeGreaterThan(0);
      
      // Should find the fact about dementia
      const factResult = response.body.data.memories.find(m => m.is_fact === true);
      expect(factResult).toBeDefined();
      expect(factResult.content).toContain('Dementia affects approximately');
    });

    it('should preserve fact status in existing memory workflow', async () => {
      // Test that existing fact remains a fact when retrieved individually
      const response = await request(app)
        .get('/api/admin/memories/medical-fact-dementia')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.is_fact).toBe(true);
      expect(response.body.data.category).toBe('health');
    });
  });

});