const request = require('supertest');
const express = require('express');
const DatabaseManager = require('../services/database-manager');

describe('Admin API - Facts vs Memories Support (Integration)', () => {
  let app;
  let dbManager;

  beforeAll(async () => {
    // Set up test database
    dbManager = new DatabaseManager(':memory:');
    await dbManager.waitForInitialization();
    
    // Set up Express app with the actual router
    app = express();
    app.use(express.json());
    
    // Import and use the actual admin memories router
    const adminMemoriesRouter = require('../routes/api/admin-memories');
    app.use('/api/admin/memories', adminMemoriesRouter);
  });

  afterAll(async () => {
    if (dbManager) {
      await dbManager.close();
    }
  });

  beforeEach(async () => {
    // Clear database
    await dbManager.run('DELETE FROM memories');
  });

  describe('GET /api/admin/memories - Facts Display', () => {
    test('should return memories with is_fact boolean field', async () => {
      // Insert test data directly
      await dbManager.run(`
        INSERT INTO memories (memory_key, memory_content, category, is_fact) VALUES
        ('test_fact', 'This is a fact', 'family', 1),
        ('test_memory', 'This is a memory', 'general', 0)
      `);

      const response = await request(app)
        .get('/api/admin/memories')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.memories).toHaveLength(2);
      
      const fact = response.body.data.memories.find(m => m.key === 'test_fact');
      const memory = response.body.data.memories.find(m => m.key === 'test_memory');
      
      expect(fact.is_fact).toBe(true);
      expect(memory.is_fact).toBe(false);
    });

    test('should handle pagination with facts', async () => {
      // Insert multiple items
      for (let i = 0; i < 25; i++) {
        await dbManager.run(`
          INSERT INTO memories (memory_key, memory_content, category, is_fact) 
          VALUES (?, ?, 'general', ?)
        `, [`item_${i}`, `Content ${i}`, i % 2]);
      }

      const response = await request(app)
        .get('/api/admin/memories?page=1&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.memories).toHaveLength(10);
      expect(response.body.data.pagination.total).toBe(25);
      expect(response.body.data.pagination.hasMore).toBe(true);
      
      // Verify all items have is_fact as boolean
      response.body.data.memories.forEach(memory => {
        expect(typeof memory.is_fact).toBe('boolean');
      });
    });
  });

  describe('POST /api/admin/memories - Create with isFact', () => {
    test('should create memory with isFact=false by default', async () => {
      const memoryData = {
        key: 'test_memory',
        content: 'Test memory content',
        category: 'general'
      };

      const response = await request(app)
        .post('/api/admin/memories')
        .send(memoryData)
        .expect(201);

      expect(response.body.success).toBe(true);
      
      // Verify in database
      const saved = await dbManager.get(
        'SELECT is_fact FROM memories WHERE memory_key = ?',
        ['test_memory']
      );
      expect(saved.is_fact).toBe(0); // SQLite false
    });

    test('should create fact with isFact=true', async () => {
      const factData = {
        key: 'test_fact',
        content: 'Test fact content',
        category: 'family',
        isFact: true
      };

      const response = await request(app)
        .post('/api/admin/memories')
        .send(factData)
        .expect(201);

      expect(response.body.success).toBe(true);
      
      // Verify in database
      const saved = await dbManager.get(
        'SELECT is_fact FROM memories WHERE memory_key = ?',
        ['test_fact']
      );
      expect(saved.is_fact).toBe(1); // SQLite true
    });

    test('should reject invalid isFact type', async () => {
      const invalidData = {
        key: 'test_invalid',
        content: 'Test content',
        category: 'general',
        isFact: 'invalid'
      };

      const response = await request(app)
        .post('/api/admin/memories')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('isFact must be a boolean if provided');
    });

    test('should reject missing required fields', async () => {
      const invalidData = {
        isFact: true
        // Missing key and content
      };

      const response = await request(app)
        .post('/api/admin/memories')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Key and content are required');
    });
  });

  describe('PUT /api/admin/memories/:key - Update with isFact', () => {
    beforeEach(async () => {
      // Set up test data
      await dbManager.run(`
        INSERT INTO memories (memory_key, memory_content, category, is_fact) VALUES
        ('existing_memory', 'Original content', 'general', 0),
        ('existing_fact', 'Original fact', 'family', 1)
      `);
    });

    test('should update memory content without changing isFact when not provided', async () => {
      const updateData = {
        content: 'Updated content',
        category: 'preferences'
      };

      const response = await request(app)
        .put('/api/admin/memories/existing_memory')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify in database - should keep is_fact=false
      const updated = await dbManager.get(
        'SELECT is_fact, memory_content, category FROM memories WHERE memory_key = ?',
        ['existing_memory']
      );
      expect(updated.is_fact).toBe(0); // Still false
      expect(updated.memory_content).toBe('Updated content');
      expect(updated.category).toBe('preferences');
    });

    test('should update memory to fact with isFact=true', async () => {
      const updateData = {
        content: 'Updated fact content',
        category: 'family',
        isFact: true
      };

      const response = await request(app)
        .put('/api/admin/memories/existing_memory')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify in database - should now be a fact
      const updated = await dbManager.get(
        'SELECT is_fact FROM memories WHERE memory_key = ?',
        ['existing_memory']
      );
      expect(updated.is_fact).toBe(1); // Now true
    });

    test('should update fact to memory with isFact=false', async () => {
      const updateData = {
        content: 'Updated memory content',
        category: 'general',
        isFact: false
      };

      const response = await request(app)
        .put('/api/admin/memories/existing_fact')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify in database - should now be a memory
      const updated = await dbManager.get(
        'SELECT is_fact FROM memories WHERE memory_key = ?',
        ['existing_fact']
      );
      expect(updated.is_fact).toBe(0); // Now false
    });

    test('should handle memory not found', async () => {
      const updateData = {
        content: 'Updated content'
      };

      const response = await request(app)
        .put('/api/admin/memories/nonexistent')
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Memory not found');
    });
  });

  describe('Data Consistency', () => {
    test('should normalize memory keys consistently', async () => {
      const memoryData = {
        key: '  TEST  KEY  ',
        content: 'Test content',
        isFact: true
      };

      const response = await request(app)
        .post('/api/admin/memories')
        .send(memoryData)
        .expect(201);

      expect(response.body.success).toBe(true);
      
      // Verify normalized key in database
      const saved = await dbManager.get(
        'SELECT memory_key, is_fact FROM memories WHERE memory_key = ?',
        ['test key'] // Should be normalized to this
      );
      expect(saved).toBeDefined();
      expect(saved.memory_key).toBe('test key');
      expect(saved.is_fact).toBe(1);
    });
  });

  describe('Backward Compatibility', () => {
    test('should handle memories created without isFact parameter', async () => {
      const memoryData = {
        key: 'legacy_memory',
        content: 'Legacy content',
        category: 'general'
        // No isFact parameter
      };

      const response = await request(app)
        .post('/api/admin/memories')
        .send(memoryData)
        .expect(201);

      expect(response.body.success).toBe(true);
      
      // Should default to memory (false)
      const saved = await dbManager.get(
        'SELECT is_fact FROM memories WHERE memory_key = ?',
        ['legacy_memory']
      );
      expect(saved.is_fact).toBe(0);
    });

    test('should correctly convert SQLite boolean values in responses', async () => {
      // Insert using direct SQL (SQLite integers)
      await dbManager.run(`
        INSERT INTO memories (memory_key, memory_content, category, is_fact) VALUES
        ('sql_fact', 'Fact via SQL', 'family', 1),
        ('sql_memory', 'Memory via SQL', 'general', 0)
      `);

      const response = await request(app)
        .get('/api/admin/memories')
        .expect(200);

      const fact = response.body.data.memories.find(m => m.key === 'sql_fact');
      const memory = response.body.data.memories.find(m => m.key === 'sql_memory');
      
      // Should be converted to JavaScript booleans
      expect(fact.is_fact).toBe(true);
      expect(memory.is_fact).toBe(false);
      expect(typeof fact.is_fact).toBe('boolean');
      expect(typeof memory.is_fact).toBe('boolean');
    });
  });
});