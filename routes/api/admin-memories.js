const express = require('express');
const router = express.Router();
const DatabaseManager = require('../../services/database-manager');
const MemoryService = require('../../services/memory-service');
const { GptService } = require('../../services/gpt-service');

/**
 * Admin Memory Management API Routes
 * 
 * Provides comprehensive endpoints for managing memories in the compassionate AI companion system.
 * These memories help personalize interactions with elderly users who have dementia.
 * 
 * All endpoints return JSON responses with standardized structure:
 * Success: { success: true, data: {...} }
 * Error: { success: false, error: "message" }
 */

// Initialize services - will be created on demand
let memoryService;
let gptService;

async function getMemoryService() {
  if (!memoryService) {
    const dbManager = DatabaseManager.getInstance();
    await dbManager.waitForInitialization();
    
    // Create GPT service for key generation only if OPENAI_API_KEY is available
    if (process.env.OPENAI_API_KEY) {
      try {
        gptService = new GptService(null, null, null, dbManager);
      } catch (error) {
        console.warn('Failed to create GPT service for admin memories:', error.message);
        gptService = null;
      }
    }
    
    // Create memory service with or without GPT service
    memoryService = new MemoryService(dbManager, gptService);
    
    // Set memory service reference in GPT service if available
    if (gptService) {
      gptService.memoryService = memoryService;
    }
    
    await memoryService.initialize();
  }
  return memoryService;
}

/**
 * Utility function to normalize memory keys
 * Converts to lowercase, replaces spaces with hyphens, removes special chars
 */
function normalizeKey(key) {
  if (!key || typeof key !== 'string') return '';
  return key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

/**
 * Reset cached services (for testing)
 */
function resetServices() {
  memoryService = null;
  gptService = null;
}

/**
 * Utility function to validate pagination parameters
 */
function validatePagination(limit, offset) {
  const parsedLimit = parseInt(limit) || 50;
  const parsedOffset = parseInt(offset) || 0;
  
  return {
    limit: Math.min(Math.max(parsedLimit, 1), 100), // Between 1-100
    offset: Math.max(parsedOffset, 0) // Minimum 0
  };
}

/**
 * GET /api/admin/memories
 * List all memories with pagination
 * Query params: limit (default: 50, max: 100), offset (default: 0)
 */
router.get('/', async (req, res) => {
  try {
    const { limit, offset } = validatePagination(req.query.limit, req.query.offset);
    
    const dbManager = DatabaseManager.getInstance();
    await dbManager.waitForInitialization();
    
    // Get total count
    const countResult = await dbManager.get('SELECT COUNT(*) as total FROM memories');
    const total = countResult.total || 0;
    
    // Get paginated memories with is_fact column
    const memories = await dbManager.all(`
      SELECT memory_key as key, memory_content as content, category, 
             created_at, updated_at, last_accessed, is_fact
      FROM memories 
      ORDER BY updated_at DESC 
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    
    const hasMore = (offset + limit) < total;
    
    // Transform is_fact from SQLite integer to boolean
    const transformedMemories = memories.map(memory => ({
      ...memory,
      is_fact: Boolean(memory.is_fact)
    }));
    
    res.json({
      success: true,
      data: {
        memories: transformedMemories,
        pagination: {
          offset,
          limit,
          total,
          hasMore
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching memories:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/memories/search
 * Search memories by partial key match
 * Query params: query (required)
 */
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }
    
    const service = await getMemoryService();
    const memories = await service.searchMemories(query);
    
    res.json({
      success: true,
      data: {
        memories
      }
    });
    
  } catch (error) {
    console.error('Error searching memories:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/memories/stats
 * Get comprehensive memory statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const service = await getMemoryService();
    const stats = await service.getStatistics();
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Error fetching memory statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/memories/:key
 * Get specific memory by key
 */
router.get('/:key', async (req, res) => {
  try {
    const normalizedKey = normalizeKey(req.params.key);
    
    if (!normalizedKey) {
      return res.status(400).json({
        success: false,
        error: 'Invalid memory key'
      });
    }
    
    const service = await getMemoryService();
    const memory = await service.getMemory(normalizedKey);
    
    if (!memory) {
      return res.status(404).json({
        success: false,
        error: 'Memory not found'
      });
    }
    
    res.json({
      success: true,
      data: memory
    });
    
  } catch (error) {
    console.error('Error fetching memory:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/memories
 * Create new memory or update existing one
 * Body: { key?: string, content: string, category?: string, isFact?: boolean }
 * If no key provided, one will be auto-generated using GPT
 */
router.post('/', async (req, res) => {
  try {
    const { key, content, category = 'general', isFact = false } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }
    
    if (typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Content must be a string'
      });
    }
    
    if (key && typeof key !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Key must be a string if provided'
      });
    }
    
    // Validate isFact is boolean if provided
    if (Object.prototype.hasOwnProperty.call(req.body, 'isFact') && typeof isFact !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isFact must be a boolean if provided'
      });
    }
    
    const service = await getMemoryService();
    
    // Pass key (may be null for auto-generation)
    const result = await service.saveMemory(key, content, category, isFact);
    
    if (result.status === 'error') {
      return res.status(400).json({
        success: false,
        error: result.message
      });
    }
    
    const statusCode = result.action === 'created' ? 201 : 200;
    
    res.status(statusCode).json({
      success: true,
      data: {
        key: result.key,
        action: result.action,
        keyGenerated: !key // Indicate if key was auto-generated
      }
    });
    
  } catch (error) {
    console.error('Error creating/updating memory:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /api/admin/memories/:key
 * Update existing memory
 * Body: { content: string, category?: string, isFact?: boolean }
 */
router.put('/:key', async (req, res) => {
  try {
    const normalizedKey = normalizeKey(req.params.key);
    const { content, category = 'general', isFact } = req.body;
    
    if (!normalizedKey) {
      return res.status(400).json({
        success: false,
        error: 'Invalid memory key'
      });
    }
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }
    
    if (typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Content must be a string'
      });
    }
    
    // Validate isFact is boolean if provided
    if (Object.prototype.hasOwnProperty.call(req.body, 'isFact') && typeof isFact !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isFact must be a boolean if provided'
      });
    }
    
    const service = await getMemoryService();
    
    // Check if memory exists
    const existingMemory = await service.getMemory(normalizedKey);
    if (!existingMemory) {
      return res.status(404).json({
        success: false,
        error: 'Memory not found'
      });
    }
    
    // Use existing isFact value if not provided in request
    const finalIsFact = Object.prototype.hasOwnProperty.call(req.body, 'isFact') ? isFact : existingMemory.is_fact;
    
    // Generate a new key based on the updated content using GPT
    let newKey;
    try {
      if (service.gptService) {
        newKey = await service.gptService.generateMemoryKey(content, category);
        // Normalize the new key
        newKey = newKey.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      } else {
        // Fallback if no GPT service available
        const cleanContent = content.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        const words = cleanContent.split(/\s+/).slice(0, 2);
        newKey = `${category}-${words.join('-')}-info`;
      }
    } catch (error) {
      console.error('Failed to generate new memory key:', error.message);
      // Fallback to simple key generation
      const cleanContent = content.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      const words = cleanContent.split(/\s+/).slice(0, 2);
      newKey = `${category}-${words.join('-')}-info`;
    }
    
    // Check if the key needs to change
    if (newKey !== normalizedKey) {
      // Key has changed - need to delete old memory and create new one
      try {
        // First, create the new memory
        const createResult = await service.saveMemory(newKey, content, category, finalIsFact);
        
        if (createResult.status === 'error') {
          return res.status(400).json({
            success: false,
            error: createResult.message
          });
        }
        
        // Only delete the old memory if creation was successful
        const deleteResult = await service.removeMemory(normalizedKey);
        
        if (deleteResult.status === 'error') {
          console.error('Warning: Failed to delete old memory after creating new one:', deleteResult.message);
          // Don't fail the request since the new memory was created successfully
        }
        
        // Return success with key change information
        res.json({
          success: true,
          data: {
            key: newKey,
            oldKey: normalizedKey,
            action: 'updated_with_key_change',
            keyChanged: true
          }
        });
        return;
        
      } catch (error) {
        console.error('Error during key migration:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to update memory with new key'
        });
      }
    }
    
    // Key hasn't changed - update the memory normally
    const result = await service.saveMemory(normalizedKey, content, category, finalIsFact);
    
    if (result.status === 'error') {
      return res.status(400).json({
        success: false,
        error: result.message
      });
    }
    
    res.json({
      success: true,
      data: {
        key: result.key,
        oldKey: normalizedKey,
        action: result.action,
        keyChanged: false
      }
    });
    
  } catch (error) {
    console.error('Error updating memory:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/admin/memories/:key
 * Delete memory by key
 */
router.delete('/:key', async (req, res) => {
  try {
    const normalizedKey = normalizeKey(req.params.key);
    
    if (!normalizedKey) {
      return res.status(400).json({
        success: false,
        error: 'Invalid memory key'
      });
    }
    
    const service = await getMemoryService();
    const result = await service.removeMemory(normalizedKey);
    
    if (result.status === 'not_found') {
      return res.status(404).json({
        success: false,
        error: 'Memory not found'
      });
    }
    
    if (result.status === 'error') {
      return res.status(500).json({
        success: false,
        error: result.message
      });
    }
    
    res.json({
      success: true,
      data: {
        key: result.key,
        action: result.action
      }
    });
    
  } catch (error) {
    console.error('Error deleting memory:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Export router and test utilities
module.exports = router;
module.exports.resetServices = resetServices;