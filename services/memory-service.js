class MemoryService {
  constructor(databaseManager) {
    this.db = databaseManager;
    this.memoryCache = new Map(); // In-memory cache for quick access
    this.cacheLoaded = false;
  }

  /**
   * Initialize the memory service and load all memories into cache
   */
  async initialize() {
    await this.db.waitForInitialization();
    await this.loadMemoriesIntoCache();
  }

  /**
   * Load all memories into cache for quick access
   */
  async loadMemoriesIntoCache() {
    try {
      const memories = await this.db.all('SELECT memory_key, memory_content, category FROM memories');
      this.memoryCache.clear();
      
      for (const memory of memories) {
        this.memoryCache.set(memory.memory_key, {
          content: memory.memory_content,
          category: memory.category
        });
      }
      
      this.cacheLoaded = true;
      console.log(`Loaded ${memories.length} memories into cache`);
    } catch (error) {
      console.error('Error loading memories into cache:', error);
      this.cacheLoaded = false;
    }
  }

  /**
   * Save a new memory or update existing one
   * @param {string} key - Descriptive key for the memory (e.g., "son-ryan-name")
   * @param {string} content - The memory content
   * @param {string} category - Category: 'family', 'health', 'preferences', 'topics_to_avoid', 'general'
   * @returns {Promise<Object>} Result object with status
   */
  async saveMemory(key, content, category = 'general') {
    try {
      await this.db.waitForInitialization();
      
      // Validate inputs
      if (!key || !content) {
        throw new Error('Memory key and content are required');
      }

      // Normalize the key (lowercase, replace spaces with hyphens)
      const normalizedKey = key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      // Check if memory exists
      const existing = await this.db.get('SELECT id FROM memories WHERE memory_key = ?', [normalizedKey]);
      
      if (existing) {
        // Update existing memory
        await this.db.run(`
          UPDATE memories 
          SET memory_content = ?, category = ?, updated_at = CURRENT_TIMESTAMP
          WHERE memory_key = ?
        `, [content, category, normalizedKey]);
        
        // Memory updated (logging handled by function)
      } else {
        // Insert new memory
        await this.db.run(`
          INSERT INTO memories (memory_key, memory_content, category)
          VALUES (?, ?, ?)
        `, [normalizedKey, content, category]);
        
        // Memory created (logging handled by function)
      }
      
      // Update cache
      this.memoryCache.set(normalizedKey, { content, category });
      
      return {
        status: 'success',
        key: normalizedKey,
        action: existing ? 'updated' : 'created'
      };
      
    } catch (error) {
      console.error('Error saving memory:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Retrieve a specific memory by key
   * @param {string} key - The memory key to retrieve
   * @returns {Promise<Object|null>} Memory object or null if not found
   */
  async getMemory(key) {
    try {
      await this.db.waitForInitialization();
      
      // Normalize the key
      const normalizedKey = key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      // Check cache first
      if (this.memoryCache.has(normalizedKey)) {
        // Update last accessed time in background (don't wait)
        this.db.run('UPDATE memories SET last_accessed = CURRENT_TIMESTAMP WHERE memory_key = ?', [normalizedKey])
          .catch(err => console.error('Error updating last_accessed:', err));
        
        const cached = this.memoryCache.get(normalizedKey);
        return {
          key: normalizedKey,
          content: cached.content,
          category: cached.category
        };
      }
      
      // If not in cache, try database
      const memory = await this.db.get(`
        SELECT memory_key, memory_content, category 
        FROM memories 
        WHERE memory_key = ?
      `, [normalizedKey]);
      
      if (memory) {
        // Update last accessed time
        await this.db.run('UPDATE memories SET last_accessed = CURRENT_TIMESTAMP WHERE memory_key = ?', [normalizedKey]);
        
        // Add to cache
        this.memoryCache.set(memory.memory_key, {
          content: memory.memory_content,
          category: memory.category
        });
        
        return {
          key: memory.memory_key,
          content: memory.memory_content,
          category: memory.category
        };
      }
      
      return null;
      
    } catch (error) {
      console.error('Error retrieving memory:', error);
      return null;
    }
  }

  /**
   * Get all memory keys (for system prompt)
   * @returns {Promise<Array<string>>} Array of all memory keys
   */
  async getAllMemoryKeys() {
    try {
      await this.db.waitForInitialization();
      
      // Get from cache if loaded
      if (this.cacheLoaded) {
        return Array.from(this.memoryCache.keys());
      }
      
      // Otherwise query database
      const memories = await this.db.all('SELECT memory_key FROM memories ORDER BY memory_key');
      return memories.map(m => m.memory_key);
      
    } catch (error) {
      console.error('Error getting memory keys:', error);
      return [];
    }
  }

  /**
   * Remove a memory by key
   * @param {string} key - The memory key to remove
   * @returns {Promise<Object>} Result object with status
   */
  async removeMemory(key) {
    try {
      await this.db.waitForInitialization();
      
      // Normalize the key
      const normalizedKey = key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      // Check if memory exists
      const existing = await this.db.get('SELECT id FROM memories WHERE memory_key = ?', [normalizedKey]);
      
      if (!existing) {
        return {
          status: 'not_found',
          message: `Memory with key '${normalizedKey}' does not exist`
        };
      }
      
      // Delete from database
      await this.db.run('DELETE FROM memories WHERE memory_key = ?', [normalizedKey]);
      
      // Remove from cache
      this.memoryCache.delete(normalizedKey);
      
      // Memory removed (logging handled by function)
      
      return {
        status: 'success',
        key: normalizedKey,
        action: 'removed'
      };
      
    } catch (error) {
      console.error('Error removing memory:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Search memories by partial key match
   * @param {string} query - Partial key to search for
   * @returns {Promise<Array>} Array of matching memories
   */
  async searchMemories(query) {
    try {
      await this.db.waitForInitialization();
      
      const normalizedQuery = query.toLowerCase().replace(/\s+/g, '-');
      
      const memories = await this.db.all(`
        SELECT memory_key, memory_content, category 
        FROM memories 
        WHERE memory_key LIKE ?
        ORDER BY memory_key
      `, [`%${normalizedQuery}%`]);
      
      return memories.map(m => ({
        key: m.memory_key,
        content: m.memory_content,
        category: m.category
      }));
      
    } catch (error) {
      console.error('Error searching memories:', error);
      return [];
    }
  }

  /**
   * Get memories by category
   * @param {string} category - Category to filter by
   * @returns {Promise<Array>} Array of memories in that category
   */
  async getMemoriesByCategory(category) {
    try {
      await this.db.waitForInitialization();
      
      const memories = await this.db.all(`
        SELECT memory_key, memory_content 
        FROM memories 
        WHERE category = ?
        ORDER BY memory_key
      `, [category]);
      
      return memories.map(m => ({
        key: m.memory_key,
        content: m.memory_content
      }));
      
    } catch (error) {
      console.error('Error getting memories by category:', error);
      return [];
    }
  }

  /**
   * Get memory statistics
   * @returns {Promise<Object>} Statistics about stored memories
   */
  async getStatistics() {
    try {
      await this.db.waitForInitialization();
      
      const stats = await this.db.get(`
        SELECT 
          COUNT(*) as total_memories,
          COUNT(DISTINCT category) as categories_used,
          MAX(updated_at) as last_updated,
          MIN(created_at) as first_created
        FROM memories
      `);
      
      const byCategory = await this.db.all(`
        SELECT category, COUNT(*) as count 
        FROM memories 
        GROUP BY category
      `);
      
      return {
        totalMemories: stats.total_memories || 0,
        categoriesUsed: stats.categories_used || 0,
        lastUpdated: stats.last_updated,
        firstCreated: stats.first_created,
        byCategory: byCategory.reduce((acc, row) => {
          acc[row.category || 'general'] = row.count;
          return acc;
        }, {})
      };
      
    } catch (error) {
      console.error('Error getting memory statistics:', error);
      return {
        totalMemories: 0,
        categoriesUsed: 0,
        byCategory: {}
      };
    }
  }
}

module.exports = MemoryService;