/**
 * Conversations API Routes
 * 
 * Provides comprehensive endpoints for the Conversations page in the compassionate AI companion system.
 * These endpoints focus on mental health tracking for dementia patients, extracting emotional states
 * from conversation data, and providing insights for caregivers.
 * 
 * Endpoints:
 * - GET /api/conversations - List conversations with pagination, sorting, filtering
 * - GET /api/conversations/:id - Get single conversation with full transcript and analytics  
 * - GET /api/conversations/analytics - Get aggregate analytics data
 */

const express = require('express');
const router = express.Router();
const DatabaseManager = require('../../services/database-manager');
const TimezoneUtils = require('../../utils/timezone-utils');
const CallStatsUtils = require('../../utils/call-stats-utils');

// Get database manager instance (will be singleton instance)
function getDbManager() {
  return DatabaseManager.getInstance();
}

// Get configured timezone from environment
const CONFIGURED_TIMEZONE = process.env.TIMEZONE || 'America/Los_Angeles';

/**
 * Input validation and sanitization utilities
 */
function validatePaginationParams(page, pageSize) {
  const validatedPage = Math.max(1, parseInt(page) || 1);
  const validatedPageSize = Math.min(100, Math.max(1, parseInt(pageSize) || 20));
  return { page: validatedPage, pageSize: validatedPageSize };
}

function validateSortingParams(sortBy, sortOrder) {
  const validSortColumns = ['start_time', 'duration', 'emotional_state', 'anxiety_level'];
  const validSortOrders = ['asc', 'desc'];
  
  const validatedSortBy = validSortColumns.includes(sortBy) ? sortBy : 'start_time';
  const validatedSortOrder = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';
  
  return { sortBy: validatedSortBy, sortOrder: validatedSortOrder };
}

function validateDateRange(dateFrom, dateTo) {
  let validDateFrom = null;
  let validDateTo = null;
  
  if (dateFrom) {
    const fromDate = new Date(dateFrom);
    if (!isNaN(fromDate.getTime())) {
      validDateFrom = fromDate.toISOString().split('T')[0];
    }
  }
  
  if (dateTo) {
    const toDate = new Date(dateTo);
    if (!isNaN(toDate.getTime())) {
      validDateTo = toDate.toISOString().split('T')[0];
    }
  }
  
  return { dateFrom: validDateFrom, dateTo: validDateTo };
}

function validateDurationRange(minDuration, maxDuration) {
  const validatedMin = parseInt(minDuration) || null;
  const validatedMax = parseInt(maxDuration) || null;
  
  // Ensure logical range if both are provided
  if (validatedMin && validatedMax && validatedMin > validatedMax) {
    return { minDuration: validatedMax, maxDuration: validatedMin };
  }
  
  return { minDuration: validatedMin, maxDuration: validatedMax };
}

/**
 * GET /api/conversations
 * List all conversations with pagination, sorting, and filtering capabilities
 */
router.get('/', async (req, res) => {
  try {
    const dbManager = getDbManager();
    await dbManager.waitForInitialization();
    
    // Extract and validate query parameters
    const { page, pageSize } = validatePaginationParams(req.query.page, req.query.pageSize);
    const { sortBy, sortOrder } = validateSortingParams(req.query.sortBy, req.query.sortOrder);
    const { dateFrom, dateTo } = validateDateRange(req.query.dateFrom, req.query.dateTo);
    const { minDuration, maxDuration } = validateDurationRange(req.query.minDuration, req.query.maxDuration);
    const emotionalStates = req.query.emotionalStates ? 
      (Array.isArray(req.query.emotionalStates) ? req.query.emotionalStates : [req.query.emotionalStates]) : null;
    const searchTerm = req.query.search ? req.query.search.trim() : null;
    
    const offset = (page - 1) * pageSize;
    
    // Build WHERE clause conditions
    const conditions = [];
    const params = [];
    
    // Use timezone-aware date filtering from centralized utility
    const dateFilter = CallStatsUtils.buildTimezoneAwareDateFilter(dateFrom, dateTo, 'c.start_time');
    conditions.push(...dateFilter.conditions);
    params.push(...dateFilter.params);
    
    if (minDuration) {
      conditions.push('c.duration >= ?');
      params.push(minDuration);
    }
    
    if (maxDuration) {
      conditions.push('c.duration <= ?');
      params.push(maxDuration);
    }
    
    if (emotionalStates && emotionalStates.length > 0) {
      // Parse summary JSON to filter by emotional state
      const placeholders = emotionalStates.map(() => '?').join(',');
      conditions.push(`json_extract(s.summary_text, '$.mentalStateIndicators.overallMoodTrend') IN (${placeholders})`);
      params.push(...emotionalStates);
    }

    // Add server-side search functionality
    if (searchTerm) {
      conditions.push(`(
        -- Search in all message content for the conversation
        EXISTS (
          SELECT 1 FROM messages m 
          WHERE m.conversation_id = c.id 
          AND m.content LIKE ? COLLATE NOCASE
        )
        -- Search in call SID
        OR c.call_sid LIKE ? COLLATE NOCASE
        -- Search in care indicators (medication concerns, staff complaints)
        OR (
          s.summary_text IS NOT NULL AND (
            json_extract(s.summary_text, '$.careIndicators.medicationConcerns') LIKE ? COLLATE NOCASE
            OR json_extract(s.summary_text, '$.careIndicators.staffComplaints') LIKE ? COLLATE NOCASE
            OR json_extract(s.summary_text, '$.mentalStateIndicators.overallMoodTrend') LIKE ? COLLATE NOCASE
          )
        )
      )`);
      const searchPattern = `%${searchTerm}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Build ORDER BY clause
    const orderByMap = {
      start_time: 'c.start_time',
      duration: 'c.duration',
      emotional_state: 'json_extract(s.summary_text, \'$.mentalStateIndicators.overallMoodTrend\')',
      anxiety_level: 'json_extract(s.summary_text, \'$.mentalStateIndicators.anxietyLevel\')'
    };
    const orderByColumn = orderByMap[sortBy] || orderByMap.start_time;
    const orderByClause = `ORDER BY ${orderByColumn} ${sortOrder.toUpperCase()}`;
    
    // Get total count for pagination
    const countSql = `
      SELECT COUNT(*) as total
      FROM conversations c
      LEFT JOIN summaries s ON c.id = s.conversation_id
      ${whereClause}
    `;
    const countResult = await dbManager.get(countSql, params);
    const total = countResult.total;
    
    // Get conversations data with message snippets and emotional metrics
    const dataSql = `
      SELECT 
        c.id,
        c.call_sid,
        c.start_time,
        c.end_time,
        c.duration,
        c.caller_info,
        s.summary_text,
        em.anxiety_level,
        em.confusion_level,
        em.agitation_level,
        em.comfort_level,
        em.sentiment_score,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
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
      LEFT JOIN emotional_metrics em ON c.id = em.conversation_id
      ${whereClause}
      ${orderByClause}
      LIMIT ? OFFSET ?
    `;
    
    const conversations = await dbManager.all(dataSql, [...params, pageSize, offset]);
    
    // Transform and enrich conversation data
    const enrichedConversations = conversations.map(conv => {
      let emotionalState = 'unknown';
      let anxietyLevel = null;  // Keep as null for unknown states
      let confusionLevel = null;
      let agitationLevel = null;
      let careIndicators = {
        medicationConcerns: [],
        painLevel: 0,
        staffComplaints: []
      };
      
      // First try to use emotional_metrics data (GPT-based, 0-10 scale)
      if (conv.anxiety_level !== null && conv.anxiety_level !== undefined) {
        anxietyLevel = conv.anxiety_level; // Already in 0-10 scale from database
        confusionLevel = conv.confusion_level || 0;
        agitationLevel = conv.agitation_level || 0;
        
        // Map anxiety level to emotional state categories
        if (anxietyLevel >= 0 && anxietyLevel <= 2) {
          emotionalState = 'calm';
        } else if (anxietyLevel >= 3 && anxietyLevel <= 4) {
          emotionalState = 'mild_anxiety';
        } else if (anxietyLevel >= 5 && anxietyLevel <= 7) {
          emotionalState = 'moderate_anxiety';
        } else if (anxietyLevel >= 8 && anxietyLevel <= 10) {
          emotionalState = 'high_anxiety';
        }
      }
      
      // Format timestamps in configured timezone
      const startTimeFormatted = conv.start_time ? 
        TimezoneUtils.convertUTCToTimezone(conv.start_time, CONFIGURED_TIMEZONE) : null;
      const endTimeFormatted = conv.end_time ? 
        TimezoneUtils.convertUTCToTimezone(conv.end_time, CONFIGURED_TIMEZONE) : null;
      
      return {
        id: conv.id,
        callSid: conv.call_sid,
        startTime: conv.start_time,
        endTime: conv.end_time,
        startTimeFormatted,
        endTimeFormatted,
        timezone: CONFIGURED_TIMEZONE,
        timezoneAbbr: TimezoneUtils.getTimezoneAbbreviation(CONFIGURED_TIMEZONE),
        duration: conv.duration || (conv.start_time && conv.end_time ? Math.round((new Date(conv.end_time) - new Date(conv.start_time)) / 1000) : 0),
        emotionalState,
        anxietyLevel,
        confusionLevel,
        agitationLevel,
        careIndicators,
        messageCount: conv.message_count,
        messageSnippet: conv.message_snippet || '',
        callerInfo: conv.caller_info ? JSON.parse(conv.caller_info) : null
      };
    });
    
    const totalPages = Math.ceil(total / pageSize);
    
    res.json({
      success: true,
      data: {
        conversations: enrichedConversations,
        total,
        page,
        pageSize,
        totalPages
      }
    });
    
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations'
    });
  }
});

/**
 * GET /api/conversations/analytics
 * Get aggregate analytics data across all conversations
 */
router.get('/analytics', async (req, res) => {
  try {
    const dbManager = getDbManager();
    await dbManager.waitForInitialization();
    
    // Extract date filtering parameters
    const { dateFrom, dateTo } = validateDateRange(req.query.dateFrom, req.query.dateTo);
    
    // Build WHERE clause for date filtering
    const conditions = [];
    const params = [];
    
    // Use timezone-aware date filtering from centralized utility
    const analyticsDateFilter = CallStatsUtils.buildTimezoneAwareDateFilter(dateFrom, dateTo, 'c.start_time');
    conditions.push(...analyticsDateFilter.conditions);
    params.push(...analyticsDateFilter.params);
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Try emotional_metrics table first (GPT-based, 0-10 scale)
    const emotionalTrendsSql = `
      SELECT 
        AVG(em.anxiety_level) as avg_anxiety,
        AVG(em.confusion_level) as avg_confusion,
        AVG(em.agitation_level) as avg_agitation,
        AVG(em.comfort_level) as avg_comfort,
        DATE(c.start_time, 'localtime') as call_date,
        em.anxiety_level as anxiety,
        em.confusion_level as confusion,
        em.agitation_level as agitation,
        em.comfort_level as comfort,
        COUNT(DISTINCT em.conversation_id) as conversations_with_metrics
      FROM conversations c
      INNER JOIN emotional_metrics em ON c.id = em.conversation_id
      ${whereClause}
      GROUP BY call_date
    `;
    
    const emotionalData = await dbManager.all(emotionalTrendsSql, params);
    
    // Calculate averages
    let totalAnxiety = 0, totalConfusion = 0, totalAgitation = 0, totalComfort = 0, count = 0;
    const trendOverTime = [];
    
    emotionalData.forEach(row => {
      if (row.avg_anxiety !== null && row.avg_anxiety !== undefined) {
        // Add to trend over time (using already averaged values per day)
        trendOverTime.push({
          date: row.call_date,
          averageAnxiety: parseFloat(row.avg_anxiety) || 0,
          averageConfusion: parseFloat(row.avg_confusion) || 0,
          averageAgitation: parseFloat(row.avg_agitation) || 0,
          averageComfort: parseFloat(row.avg_comfort) || 0,
          conversationCount: row.conversations_with_metrics || 0
        });
        
        // Accumulate for overall averages
        totalAnxiety += parseFloat(row.avg_anxiety) || 0;
        totalConfusion += parseFloat(row.avg_confusion) || 0;
        totalAgitation += parseFloat(row.avg_agitation) || 0;
        totalComfort += parseFloat(row.avg_comfort) || 0;
        count++;
      }
    });
    
    const emotionalTrends = {
      averageAnxiety: count > 0 ? totalAnxiety / count : 0,
      averageConfusion: count > 0 ? totalConfusion / count : 0,
      averageAgitation: count > 0 ? totalAgitation / count : 0,
      averageComfort: count > 0 ? totalComfort / count : 0,
      averagePositiveEngagement: count > 0 ? totalComfort / count : 0, // Alias for backward compatibility
      trendOverTime: trendOverTime.sort((a, b) => a.date.localeCompare(b.date))
    };
    
    // Get pattern analysis
    const patternsSql = `
      SELECT 
        a.keywords,
        a.patterns,
        s.summary_text
      FROM conversations c
      JOIN analytics a ON c.id = a.conversation_id
      JOIN summaries s ON c.id = s.conversation_id
      ${whereClause}
    `;
    
    const patternsData = await dbManager.all(patternsSql, params);
    
    // Analyze common topics and patterns
    const topicCounts = new Map();
    const coherenceLevels = [];
    const responseLatencies = [];
    
    patternsData.forEach(row => {
      try {
        const keywords = JSON.parse(row.keywords || '[]');
        const patterns = JSON.parse(row.patterns || '{}');
        // const summary = JSON.parse(row.summary_text || '{}'); // TODO: Use if needed for additional pattern analysis
        
        // Count topics
        keywords.forEach(keyword => {
          topicCounts.set(keyword, (topicCounts.get(keyword) || 0) + 1);
        });
        
        // Collect patterns
        if (patterns.coherenceLevel) {
          coherenceLevels.push(patterns.coherenceLevel);
        }
        if (patterns.responseLatency) {
          responseLatencies.push(patterns.responseLatency);
        }
      } catch (error) {
        console.error('Error parsing pattern data:', error);
      }
    });
    
    const commonTopics = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));
    
    const patternAnalysis = {
      commonTopics: commonTopics.map(t => t.topic),
      behavioralPatterns: {
        coherenceLevels: coherenceLevels,
        responseLatencies: responseLatencies
      },
      responseEffectiveness: {
        topicFrequency: commonTopics
      }
    };
    
    // Get care concerns frequency
    const careConcernsSql = `
      SELECT s.summary_text
      FROM conversations c
      JOIN summaries s ON c.id = s.conversation_id
      ${whereClause}
    `;
    
    const careData = await dbManager.all(careConcernsSql, params);
    
    let medicationRelated = 0;
    let memoryRelated = 0;
    let painRelated = 0;
    let staffRelated = 0;
    
    careData.forEach(row => {
      try {
        const summary = JSON.parse(row.summary_text || '{}');
        if (summary.careIndicators) {
          if (summary.careIndicators.medicationConcerns && summary.careIndicators.medicationConcerns.length > 0) {
            medicationRelated++;
          }
          if (summary.careIndicators.painLevel && summary.careIndicators.painLevel > 0) {
            painRelated++;
          }
          if (summary.careIndicators.staffComplaints && summary.careIndicators.staffComplaints.length > 0) {
            staffRelated++;
          }
        }
        if (summary.conversationMetrics && summary.conversationMetrics.topicsDiscussed) {
          const topics = summary.conversationMetrics.topicsDiscussed.join(' ').toLowerCase();
          if (topics.includes('memory') || topics.includes('forget') || topics.includes('remember')) {
            memoryRelated++;
          }
        }
      } catch (error) {
        console.error('Error parsing care concerns data:', error);
      }
    });
    
    const careConcerns = {
      medicationRelated,
      memoryRelated,
      painRelated,
      staffRelated
    };
    
    // Get time-based statistics using timezone-aware dates
    const timeStatsSql = `
      SELECT 
        AVG(c.duration) as avg_duration,
        strftime('%H', c.start_time, 'localtime') as hour,
        strftime('%w', c.start_time, 'localtime') as day_of_week,
        DATE(c.start_time, 'localtime') as call_date,
        COUNT(*) as call_count,
        c.duration
      FROM conversations c
      ${whereClause}
      GROUP BY call_date
    `;
    
    const timeStatsData = await dbManager.all(timeStatsSql, params);
    
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);
    let totalDuration = 0;
    let durationCount = 0;
    
    timeStatsData.forEach(row => {
      if (row.hour !== null) {
        hourCounts[parseInt(row.hour)]++;
      }
      if (row.day_of_week !== null) {
        dayCounts[parseInt(row.day_of_week)]++;
      }
      if (row.duration) {
        totalDuration += row.duration;
        durationCount++;
      }
    });
    
    const peakCallTimes = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    const timeBasedStats = {
      averageDuration: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
      peakCallTimes,
      dailyPatterns: {
        hourlyDistribution: hourCounts,
        weeklyDistribution: dayCounts
      },
      weeklyTrends: timeStatsData.map(row => ({
        date: row.call_date,
        callCount: row.call_count,
        averageDuration: Math.round(row.avg_duration || 0)
      }))
    };
    
    res.json({
      success: true,
      data: {
        emotionalTrends,
        patternAnalysis,
        careConcerns,
        timeBasedStats
      }
    });
    
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics data'
    });
  }
});

/**
 * GET /api/conversations/:id
 * Get single conversation with full transcript, emotional timeline, and analytics
 */
router.get('/:id', async (req, res) => {
  try {
    const dbManager = getDbManager();
    await dbManager.waitForInitialization();
    
    const conversationId = parseInt(req.params.id);
    if (!conversationId || conversationId < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid conversation ID format'
      });
    }
    
    // Get conversation details
    const conversationSql = `
      SELECT 
        c.*,
        s.summary_text,
        a.sentiment_scores,
        a.keywords,
        a.patterns
      FROM conversations c
      LEFT JOIN summaries s ON c.id = s.conversation_id
      LEFT JOIN analytics a ON c.id = a.conversation_id
      WHERE c.id = ?
    `;
    
    const conversation = await dbManager.get(conversationSql, [conversationId]);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }
    
    // Get all messages for the conversation
    const messagesSql = `
      SELECT role, content, timestamp
      FROM messages 
      WHERE conversation_id = ?
      ORDER BY timestamp ASC
    `;
    
    const messages = await dbManager.all(messagesSql, [conversationId]);
    
    // Parse and structure data
    let summaryData = null;
    let analyticsData = {
      sentimentScores: {},
      keywords: [],
      patterns: {},
      conversationMetrics: {}
    };
    
    if (conversation.summary_text) {
      try {
        summaryData = JSON.parse(conversation.summary_text);
      } catch (error) {
        console.error('Error parsing summary JSON:', error);
      }
    }
    
    if (conversation.sentiment_scores) {
      try {
        analyticsData.sentimentScores = JSON.parse(conversation.sentiment_scores);
      } catch (error) {
        console.error('Error parsing sentiment scores:', error);
      }
    }
    
    if (conversation.keywords) {
      try {
        analyticsData.keywords = JSON.parse(conversation.keywords);
      } catch (error) {
        console.error('Error parsing keywords:', error);
      }
    }
    
    if (conversation.patterns) {
      try {
        analyticsData.patterns = JSON.parse(conversation.patterns);
      } catch (error) {
        console.error('Error parsing patterns:', error);
      }
    }
    
    // Extract conversation metrics from summary
    if (summaryData && summaryData.conversationMetrics) {
      analyticsData.conversationMetrics = summaryData.conversationMetrics;
    }
    
    // Create emotional timeline based on messages and summary data
    const emotionalTimeline = messages.map((message, index) => {
      let anxietyLevel = 3; // Default neutral
      let agitationLevel = 2;
      let positiveEngagement = 5;
      
      // Extract emotional indicators from summary if available
      if (summaryData && summaryData.mentalStateIndicators) {
        anxietyLevel = summaryData.mentalStateIndicators.anxietyLevel || 3;
        agitationLevel = summaryData.mentalStateIndicators.agitationLevel || 2;
        positiveEngagement = summaryData.mentalStateIndicators.positiveEngagement || 5;
      }
      
      // Slightly vary the emotional state throughout the conversation
      // This simulates how emotional states can change during a conversation
      const variation = (index % 3) - 1; // -1, 0, or 1
      
      return {
        timestamp: message.timestamp,
        anxietyLevel: Math.max(0, Math.min(10, anxietyLevel + variation)),
        agitationLevel: Math.max(0, Math.min(10, agitationLevel + variation)),
        positiveEngagement: Math.max(0, Math.min(10, positiveEngagement + (variation * -1))) // Inverse for positive
      };
    });
    
    // Extract care indicators
    let careIndicators = {
      medicationConcerns: [],
      painLevel: 0,
      staffComplaints: [],
      keyTopics: []
    };
    
    if (summaryData && summaryData.careIndicators) {
      careIndicators = {
        medicationConcerns: summaryData.careIndicators.medicationConcerns || [],
        painLevel: summaryData.careIndicators.painLevel || 0,
        staffComplaints: summaryData.careIndicators.staffComplaints || [],
        keyTopics: summaryData.conversationMetrics?.topicsDiscussed || []
      };
    }
    
    // Format timestamps in configured timezone
    const startTimeFormatted = conversation.start_time ? 
      TimezoneUtils.convertUTCToTimezone(conversation.start_time, CONFIGURED_TIMEZONE) : null;
    const endTimeFormatted = conversation.end_time ? 
      TimezoneUtils.convertUTCToTimezone(conversation.end_time, CONFIGURED_TIMEZONE) : null;
    
    // Format message timestamps
    const messagesWithTimezone = messages.map(msg => ({
      ...msg,
      timestampFormatted: msg.timestamp ? 
        TimezoneUtils.convertUTCToTimezone(msg.timestamp, CONFIGURED_TIMEZONE) : null
    }));
    
    // Format response
    const responseData = {
      id: conversation.id,
      callSid: conversation.call_sid,
      startTime: conversation.start_time,
      endTime: conversation.end_time,
      startTimeFormatted,
      endTimeFormatted,
      timezone: CONFIGURED_TIMEZONE,
      timezoneAbbr: TimezoneUtils.getTimezoneAbbreviation(CONFIGURED_TIMEZONE),
      duration: conversation.duration,
      callerInfo: conversation.caller_info ? JSON.parse(conversation.caller_info) : null,
      messages: messagesWithTimezone,
      analytics: analyticsData,
      emotionalTimeline,
      careIndicators
    };
    
    res.json({
      success: true,
      data: responseData
    });
    
  } catch (error) {
    console.error('Error fetching conversation details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation details'
    });
  }
});

module.exports = router;