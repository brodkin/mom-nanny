/**
 * Global Search API Routes
 * 
 * Provides comprehensive search functionality across all system entities
 * for the compassionate AI companion system. Supports unified search
 * across conversations, memories, and other data sources.
 * 
 * Endpoints:
 * - GET /api/search - Global search across all entities
 * - GET /api/search/conversations - Dedicated conversation search
 * - GET /api/search/memories - Memory system search
 */

const express = require('express');
const router = express.Router();
const DatabaseManager = require('../../services/database-manager');

// Get database manager instance (will be singleton instance)
function getDbManager() {
  return DatabaseManager.getInstance();
}

/**
 * Input validation utilities
 */
function validateSearchParams(query, category, limit) {
  const validatedQuery = query ? query.trim() : '';
  const validCategories = ['all', 'conversations', 'memories', 'analytics'];
  const validatedCategory = validCategories.includes(category) ? category : 'all';
  const validatedLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  
  return { 
    query: validatedQuery, 
    category: validatedCategory, 
    limit: validatedLimit 
  };
}

/**
 * GET /api/search
 * Global search across all system entities
 */
router.get('/', async (req, res) => {
  try {
    const dbManager = getDbManager();
    await dbManager.waitForInitialization();
    
    const { query, category, limit } = validateSearchParams(
      req.query.q || req.query.query,
      req.query.category,
      req.query.limit
    );
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }
    
    const results = {
      query,
      category,
      totalResults: 0,
      results: {
        conversations: [],
        memories: [],
        analytics: []
      }
    };
    
    const searchPattern = `%${query}%`;
    
    // Search conversations if category is 'all' or 'conversations'
    if (category === 'all' || category === 'conversations') {
      const conversationsSql = `
        SELECT 
          c.id,
          c.call_sid,
          c.start_time,
          c.duration,
          s.summary_text,
          'conversation' as result_type,
          -- Get matched content snippet
          (SELECT GROUP_CONCAT(content, ' ') 
           FROM (
             SELECT content 
             FROM messages 
             WHERE conversation_id = c.id 
             AND content LIKE ? COLLATE NOCASE
             ORDER BY timestamp ASC 
             LIMIT 3
           )
          ) as matched_content,
          -- Get message count
          (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
        FROM conversations c
        LEFT JOIN summaries s ON c.id = s.conversation_id
        WHERE (
          -- Search in message content
          EXISTS (
            SELECT 1 FROM messages m 
            WHERE m.conversation_id = c.id 
            AND m.content LIKE ? COLLATE NOCASE
          )
          -- Search in call SID
          OR c.call_sid LIKE ? COLLATE NOCASE
          -- Search in summary data
          OR (
            s.summary_text IS NOT NULL AND (
              json_extract(s.summary_text, '$.careIndicators.medicationConcerns') LIKE ? COLLATE NOCASE
              OR json_extract(s.summary_text, '$.careIndicators.staffComplaints') LIKE ? COLLATE NOCASE
              OR json_extract(s.summary_text, '$.mentalStateIndicators.overallMoodTrend') LIKE ? COLLATE NOCASE
            )
          )
        )
        ORDER BY c.start_time DESC
        LIMIT ?
      `;
      
      const conversations = await dbManager.all(conversationsSql, [
        searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, limit
      ]);
      
      results.results.conversations = conversations.map(conv => ({
        id: conv.id,
        type: 'conversation',
        title: `Conversation ${conv.call_sid || conv.id}`,
        summary: conv.matched_content || 'No matched content',
        timestamp: conv.start_time,
        metadata: {
          callSid: conv.call_sid,
          duration: conv.duration,
          messageCount: conv.message_count
        }
      }));
    }
    
    // Search memories if category is 'all' or 'memories'
    if (category === 'all' || category === 'memories') {
      const memoriesSql = `
        SELECT 
          id,
          key,
          content,
          category,
          created_at,
          last_accessed,
          'memory' as result_type
        FROM memories
        WHERE key LIKE ? COLLATE NOCASE
           OR content LIKE ? COLLATE NOCASE
           OR category LIKE ? COLLATE NOCASE
        ORDER BY last_accessed DESC
        LIMIT ?
      `;
      
      const memories = await dbManager.all(memoriesSql, [
        searchPattern, searchPattern, searchPattern, limit
      ]);
      
      results.results.memories = memories.map(memory => ({
        id: memory.id,
        type: 'memory',
        title: memory.key,
        summary: memory.content.length > 100 ? 
          memory.content.substring(0, 100) + '...' : 
          memory.content,
        timestamp: memory.last_accessed,
        metadata: {
          category: memory.category,
          createdAt: memory.created_at
        }
      }));
    }
    
    // Search analytics if category is 'all' or 'analytics'
    if (category === 'all' || category === 'analytics') {
      const analyticsSql = `
        SELECT 
          a.id,
          a.conversation_id,
          a.sentiment_scores,
          a.keywords,
          a.patterns,
          c.call_sid,
          c.start_time,
          'analytics' as result_type
        FROM analytics a
        JOIN conversations c ON a.conversation_id = c.id
        WHERE a.keywords LIKE ? COLLATE NOCASE
           OR a.patterns LIKE ? COLLATE NOCASE
        ORDER BY c.start_time DESC
        LIMIT ?
      `;
      
      const analytics = await dbManager.all(analyticsSql, [
        searchPattern, searchPattern, limit
      ]);
      
      results.results.analytics = analytics.map(item => ({
        id: item.id,
        type: 'analytics',
        title: `Analytics for ${item.call_sid || `Conversation ${item.conversation_id}`}`,
        summary: 'Keywords and patterns analysis',
        timestamp: item.start_time,
        metadata: {
          conversationId: item.conversation_id,
          callSid: item.call_sid
        }
      }));
    }
    
    // Calculate total results
    results.totalResults = 
      results.results.conversations.length +
      results.results.memories.length +
      results.results.analytics.length;
    
    res.json({
      success: true,
      data: results
    });
    
  } catch (error) {
    console.error('Error performing global search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform search'
    });
  }
});

/**
 * GET /api/search/conversations
 * Dedicated conversation search with detailed results
 */
router.get('/conversations', async (req, res) => {
  try {
    const dbManager = getDbManager();
    await dbManager.waitForInitialization();
    
    const { query, limit } = validateSearchParams(
      req.query.q || req.query.query,
      'conversations',
      req.query.limit
    );
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }
    
    const searchPattern = `%${query}%`;
    
    // Enhanced conversation search with highlighted matches
    const conversationsSql = `
      SELECT 
        c.id,
        c.call_sid,
        c.start_time,
        c.end_time,
        c.duration,
        c.caller_info,
        s.summary_text,
        -- Get all matching messages
        (SELECT json_group_array(
           json_object(
             'content', content,
             'role', role,
             'timestamp', timestamp
           )
         )
         FROM messages 
         WHERE conversation_id = c.id 
         AND content LIKE ? COLLATE NOCASE
         ORDER BY timestamp ASC
        ) as matching_messages,
        -- Get message snippet for preview
        (SELECT GROUP_CONCAT(content, ' ') 
         FROM (
           SELECT content 
           FROM messages 
           WHERE conversation_id = c.id 
           ORDER BY timestamp ASC 
           LIMIT 5
         )
        ) as message_snippet
      FROM conversations c
      LEFT JOIN summaries s ON c.id = s.conversation_id
      WHERE (
        EXISTS (
          SELECT 1 FROM messages m 
          WHERE m.conversation_id = c.id 
          AND m.content LIKE ? COLLATE NOCASE
        )
        OR c.call_sid LIKE ? COLLATE NOCASE
        OR (
          s.summary_text IS NOT NULL AND (
            json_extract(s.summary_text, '$.careIndicators.medicationConcerns') LIKE ? COLLATE NOCASE
            OR json_extract(s.summary_text, '$.careIndicators.staffComplaints') LIKE ? COLLATE NOCASE
            OR json_extract(s.summary_text, '$.mentalStateIndicators.overallMoodTrend') LIKE ? COLLATE NOCASE
          )
        )
      )
      ORDER BY c.start_time DESC
      LIMIT ?
    `;
    
    const conversations = await dbManager.all(conversationsSql, [
      searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, limit
    ]);
    
    const enrichedResults = conversations.map(conv => {
      let summaryData = null;
      let matchingMessages = [];
      
      if (conv.summary_text) {
        try {
          summaryData = JSON.parse(conv.summary_text);
        } catch (error) {
          console.error('Error parsing summary JSON:', error);
        }
      }
      
      if (conv.matching_messages) {
        try {
          matchingMessages = JSON.parse(conv.matching_messages);
        } catch (error) {
          console.error('Error parsing matching messages JSON:', error);
        }
      }
      
      return {
        id: conv.id,
        callSid: conv.call_sid,
        startTime: conv.start_time,
        endTime: conv.end_time,
        duration: conv.duration,
        emotionalState: summaryData?.mentalStateIndicators?.overallMoodTrend || 'unknown',
        anxietyLevel: summaryData?.mentalStateIndicators?.anxietyLevel || 0,
        careIndicators: summaryData?.careIndicators || {},
        messageSnippet: conv.message_snippet || '',
        matchingMessages,
        callerInfo: conv.caller_info ? JSON.parse(conv.caller_info) : null
      };
    });
    
    res.json({
      success: true,
      data: {
        query,
        conversations: enrichedResults,
        total: enrichedResults.length
      }
    });
    
  } catch (error) {
    console.error('Error searching conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search conversations'
    });
  }
});

/**
 * GET /api/search/memories
 * Search through the memory system
 */
router.get('/memories', async (req, res) => {
  try {
    const dbManager = getDbManager();
    await dbManager.waitForInitialization();
    
    const { query, limit } = validateSearchParams(
      req.query.q || req.query.query,
      'memories',
      req.query.limit
    );
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }
    
    const searchPattern = `%${query}%`;
    
    const memoriesSql = `
      SELECT 
        id,
        key,
        content,
        category,
        created_at,
        updated_at,
        last_accessed
      FROM memories
      WHERE key LIKE ? COLLATE NOCASE
         OR content LIKE ? COLLATE NOCASE
         OR category LIKE ? COLLATE NOCASE
      ORDER BY 
        CASE 
          WHEN key LIKE ? COLLATE NOCASE THEN 1  -- Exact key matches first
          WHEN content LIKE ? COLLATE NOCASE THEN 2  -- Content matches second
          ELSE 3
        END,
        last_accessed DESC
      LIMIT ?
    `;
    
    const memories = await dbManager.all(memoriesSql, [
      searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, limit
    ]);
    
    res.json({
      success: true,
      data: {
        query,
        memories,
        total: memories.length
      }
    });
    
  } catch (error) {
    console.error('Error searching memories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search memories'
    });
  }
});

module.exports = router;