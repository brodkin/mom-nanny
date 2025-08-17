const express = require('express');
const router = express.Router();
const DatabaseManager = require('../../services/database-manager');
const MemoryService = require('../../services/memory-service');

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

// Initialize memory service - will be created on demand
let memoryService;

async function getMemoryService() {
  if (!memoryService) {
    const dbManager = DatabaseManager.getInstance();
    await dbManager.waitForInitialization();
    memoryService = new MemoryService(dbManager);
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
    
    // Get paginated memories
    const memories = await dbManager.all(`
      SELECT memory_key as key, memory_content as content, category, 
             created_at, updated_at, last_accessed
      FROM memories 
      ORDER BY updated_at DESC 
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    
    const hasMore = (offset + limit) < total;
    
    res.json({
      success: true,
      data: {
        memories,
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
 * Body: { key: string, content: string, category?: string }
 */
router.post('/', async (req, res) => {
  try {
    const { key, content, category = 'general' } = req.body;
    
    if (!key || !content) {
      return res.status(400).json({
        success: false,
        error: 'Key and content are required'
      });
    }
    
    if (typeof key !== 'string' || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Key and content must be strings'
      });
    }
    
    const service = await getMemoryService();
    const result = await service.saveMemory(key, content, category);
    
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
        action: result.action
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
 * Body: { content: string, category?: string }
 */
router.put('/:key', async (req, res) => {
  try {
    const normalizedKey = normalizeKey(req.params.key);
    const { content, category = 'general' } = req.body;
    
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
    
    const service = await getMemoryService();
    
    // Check if memory exists
    const existingMemory = await service.getMemory(normalizedKey);
    if (!existingMemory) {
      return res.status(404).json({
        success: false,
        error: 'Memory not found'
      });
    }
    
    // Update the memory
    const result = await service.saveMemory(normalizedKey, content, category);
    
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
        action: result.action
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

module.exports = router;