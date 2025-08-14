const QueryBuilder = require('../utils/query-builder');

class SqliteStorageService {
  constructor(databaseManager) {
    this.db = databaseManager;
    this.queryBuilder = new QueryBuilder();
  }

  async saveSummary(summary) {
    try {
      // Use transaction for data consistency
      const conversationId = await this.db.transaction(() => {
        // Check if conversation already exists
        const existingConversation = this.db.get(
          'SELECT id FROM conversations WHERE call_sid = ?',
          [summary.callSid]
        );

        let conversationId;
        
        if (existingConversation) {
          // Update existing conversation
          conversationId = existingConversation.id;
          
          this.db.runSync(`
            UPDATE conversations 
            SET end_time = ?, duration = ?, caller_info = ?
            WHERE id = ?
          `, [
            summary.endTime || null,
            summary.callMetadata?.duration || null,
            JSON.stringify(summary.callMetadata || {}),
            conversationId
          ]);
          
          // Remove existing related records to replace them
          this.db.runSync('DELETE FROM summaries WHERE conversation_id = ?', [conversationId]);
          this.db.runSync('DELETE FROM analytics WHERE conversation_id = ?', [conversationId]);
          
        } else {
          // Insert new conversation
          const result = this.db.runSync(`
            INSERT INTO conversations (call_sid, start_time, end_time, duration, caller_info)
            VALUES (?, ?, ?, ?, ?)
          `, [
            summary.callSid,
            summary.startTime,
            summary.endTime || null,
            summary.callMetadata?.duration || null,
            JSON.stringify(summary.callMetadata || {})
          ]);
          
          conversationId = result.lastInsertRowid;
        }

        // Insert summary
        this.db.runSync(`
          INSERT INTO summaries (conversation_id, summary_text)
          VALUES (?, ?)
        `, [conversationId, JSON.stringify(summary)]);

        // Insert analytics data
        const analyticsData = {
          sentiment_scores: this.extractSentimentScores(summary),
          keywords: this.extractKeywords(summary),
          patterns: this.extractPatterns(summary)
        };

        this.db.runSync(`
          INSERT INTO analytics (conversation_id, sentiment_scores, keywords, patterns)
          VALUES (?, ?, ?, ?)
        `, [
          conversationId,
          JSON.stringify(analyticsData.sentiment_scores),
          JSON.stringify(analyticsData.keywords),
          JSON.stringify(analyticsData.patterns)
        ]);

        return conversationId;
      });

      // Return both the formatted ID and the numeric ID
      return {
        conversationId: `conversation-${conversationId}`,
        numericId: conversationId,
        toString: () => `conversation-${conversationId}` // For backward compatibility
      };
      
    } catch (error) {
      console.error('Error saving summary to SQLite:', error);
      throw error;
    }
  }

  /**
   * Save conversation messages to the database
   * @param {number} conversationId - Numeric conversation ID
   * @param {Array} messages - Array of message objects {role, content, timestamp}
   * @returns {Promise<void>}
   */
  async saveMessages(conversationId, messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
      return; // No messages to save
    }

    try {
      // Validate message structure and roles
      for (const message of messages) {
        if (!message.role || !['user', 'assistant', 'system'].includes(message.role)) {
          throw new Error(`Invalid message role: ${message.role}`);
        }
        if (typeof message.content !== 'string') {
          throw new Error('Message content must be a string');
        }
        if (!message.timestamp) {
          throw new Error('Message timestamp is required');
        }
      }

      // Use transaction for batch insert
      await this.db.transaction(() => {
        // Clear existing messages for this conversation first
        this.db.runSync('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);

        // Batch insert all messages using runSync
        for (const message of messages) {
          this.db.runSync(`
            INSERT INTO messages (conversation_id, role, content, timestamp)
            VALUES (?, ?, ?, ?)
          `, [
            conversationId,
            message.role,
            message.content,
            message.timestamp
          ]);
        }
      });

    } catch (error) {
      console.error('Error saving messages to SQLite:', error);
      throw error;
    }
  }

  /**
   * Load conversation messages from the database
   * @param {string} conversationId - Conversation ID in format 'conversation-123'
   * @returns {Promise<Array>} Array of message objects
   */
  async loadMessages(conversationId) {
    // Validate conversation ID format
    if (!conversationId.startsWith('conversation-')) {
      throw new Error(`Invalid conversation ID format: ${conversationId}`);
    }

    const id = parseInt(conversationId.replace('conversation-', ''));
    if (isNaN(id)) {
      throw new Error(`Invalid conversation ID format: ${conversationId}`);
    }

    try {
      // First verify conversation exists
      const conversation = await this.db.get(
        'SELECT id FROM conversations WHERE id = ?',
        [id]
      );

      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }

      // Load messages ordered by timestamp
      const messages = await this.db.all(`
        SELECT role, content, timestamp
        FROM messages 
        WHERE conversation_id = ?
        ORDER BY timestamp ASC
      `, [id]);

      return messages || [];

    } catch (error) {
      console.error('Error loading messages from SQLite:', error);
      throw error;
    }
  }

  /**
   * Get recent conversation summaries
   * @param {number} limit - Number of recent summaries to retrieve
   * @returns {Promise<Array>} Array of recent summaries
   */
  async getRecentSummaries(limit = 5) {
    try {
      const sql = `
        SELECT 
          c.call_sid,
          c.start_time,
          c.end_time,
          c.duration,
          c.caller_info,
          s.summary_text,
          s.created_at
        FROM conversations c
        LEFT JOIN summaries s ON c.id = s.conversation_id
        ORDER BY c.start_time DESC
        LIMIT ?
      `;
      
      return await this.db.query(sql, [limit]);
    } catch (error) {
      console.error('Error retrieving recent summaries:', error);
      return [];
    }
  }

  async loadSummary(conversationId) {
    // Validate conversation ID format
    if (!conversationId.startsWith('conversation-')) {
      throw new Error(`Invalid conversation ID format: ${conversationId}`);
    }

    const id = parseInt(conversationId.replace('conversation-', ''));
    if (isNaN(id)) {
      throw new Error(`Invalid conversation ID format: ${conversationId}`);
    }

    try {
      const conversation = await this.db.get(
        'SELECT * FROM conversations WHERE id = ?',
        [id]
      );

      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }

      const summaryRecord = await this.db.get(
        'SELECT summary_text FROM summaries WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1',
        [id]
      );

      if (!summaryRecord) {
        throw new Error(`Summary not found for conversation: ${conversationId}`);
      }

      // Parse and return the full summary
      const summary = JSON.parse(summaryRecord.summary_text);
      
      // Ensure consistency with database values
      summary.callSid = conversation.call_sid;
      summary.startTime = conversation.start_time;
      summary.endTime = conversation.end_time;
      
      if (conversation.caller_info) {
        try {
          const callerInfo = JSON.parse(conversation.caller_info);
          summary.callMetadata = { ...summary.callMetadata, ...callerInfo };
        } catch (parseError) {
          console.warn('Failed to parse caller_info JSON:', parseError);
        }
      }

      return summary;
      
    } catch (error) {
      console.error('Error loading summary from SQLite:', error);
      throw error;
    }
  }

  async listSummariesForDate(date) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const conversations = await this.db.all(`
        SELECT id FROM conversations 
        WHERE datetime(start_time) >= datetime(?) AND datetime(start_time) <= datetime(?)
        ORDER BY start_time ASC
      `, [
        startOfDay.toISOString(),
        endOfDay.toISOString()
      ]);

      return conversations.map(conv => `conversation-${conv.id}`);
      
    } catch (error) {
      console.error('Error listing summaries for date:', error);
      return [];
    }
  }

  async generateWeeklyReport(startDate) {
    try {
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);

      // Get all conversations for the week
      const conversations = await this.db.all(`
        SELECT 
          DATE(start_time) as call_date,
          COUNT(*) as total_calls,
          AVG(duration) as avg_duration,
          SUM(duration) as total_duration,
          MIN(start_time) as first_call,
          MAX(start_time) as last_call
        FROM conversations 
        WHERE start_time >= ? AND start_time <= ?
        GROUP BY DATE(start_time)
        ORDER BY call_date ASC
      `, [
        startDate.toISOString(),
        endDate.toISOString()
      ]);

      // Calculate weekly statistics
      const weeklyStats = {
        weekStart: startDate.toISOString().split('T')[0],
        weekEnd: endDate.toISOString().split('T')[0],
        weekNumber: this.getWeekNumber(startDate),
        year: startDate.getFullYear(),
        totalCalls: 0,
        totalDuration: 0,
        averageCallsPerDay: 0,
        averageDurationPerCall: 0,
        dailyBreakdown: [],
        generatedAt: new Date().toISOString()
      };

      // Process daily data
      const currentDate = new Date(startDate);
      for (let i = 0; i < 7; i++) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayData = conversations.find(c => c.call_date === dateStr);
        
        const dayInfo = {
          date: dateStr,
          totalCalls: dayData ? dayData.total_calls : 0,
          totalDuration: dayData ? Math.round(dayData.total_duration || 0) : 0,
          averageDuration: dayData ? Math.round(dayData.avg_duration || 0) : 0,
          calls: [] // Could be populated with more detail if needed
        };

        weeklyStats.dailyBreakdown.push(dayInfo);
        weeklyStats.totalCalls += dayInfo.totalCalls;
        weeklyStats.totalDuration += dayInfo.totalDuration;
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Calculate averages
      weeklyStats.averageCallsPerDay = Math.round(weeklyStats.totalCalls / 7 * 10) / 10;
      if (weeklyStats.totalCalls > 0) {
        weeklyStats.averageDurationPerCall = Math.round(weeklyStats.totalDuration / weeklyStats.totalCalls);
      }

      // For now, don't store weekly reports in analytics table due to foreign key constraints
      // Store the report data locally or return it directly
      // Future enhancement: create a separate reports table
      return {
        reportId: `weekly-report-${Date.now()}`,
        data: weeklyStats
      };
      
    } catch (error) {
      console.error('Error generating weekly report:', error);
      throw error;
    }
  }

  // Helper methods for extracting analytics data
  extractSentimentScores(summary) {
    const scores = {};
    
    if (summary.mentalStateIndicators) {
      scores.anxiety = summary.mentalStateIndicators.anxietyLevel || 0;
      scores.agitation = summary.mentalStateIndicators.agitationLevel || 0;
      scores.positiveEngagement = summary.mentalStateIndicators.positiveEngagement || 0;
      scores.overallMood = summary.mentalStateIndicators.overallMoodTrend || 'stable';
    }
    
    return scores;
  }

  extractKeywords(summary) {
    const keywords = [];
    
    if (summary.conversationMetrics?.topicsDiscussed) {
      keywords.push(...summary.conversationMetrics.topicsDiscussed);
    }
    
    if (summary.careIndicators?.medicationConcerns) {
      keywords.push(...summary.careIndicators.medicationConcerns.map(m => `medication:${m}`));
    }
    
    if (summary.supportEffectiveness?.triggerTopics) {
      keywords.push(...summary.supportEffectiveness.triggerTopics.map(t => `trigger:${t.topic}`));
    }
    
    return [...new Set(keywords)]; // Remove duplicates
  }

  extractPatterns(summary) {
    const patterns = {};
    
    if (summary.behavioralPatterns) {
      patterns.responseLatency = summary.behavioralPatterns.responseLatency;
      patterns.coherenceLevel = summary.behavioralPatterns.coherenceLevel;
      patterns.memoryIndicators = summary.behavioralPatterns.memoryIndicators;
      patterns.sundowningRisk = summary.behavioralPatterns.sundowningRisk;
    }
    
    if (summary.conversationMetrics) {
      patterns.repetitionCount = summary.conversationMetrics.repetitionCount;
      patterns.interruptionCount = summary.conversationMetrics.interruptionCount;
    }
    
    return patterns;
  }

  getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  // Health check method
  isHealthy() {
    try {
      return this.db.isHealthy();
    } catch (error) {
      return false;
    }
  }

  // Method to get statistics
  async getStatistics() {
    try {
      const stats = await this.db.get(`
        SELECT 
          COUNT(*) as total_conversations,
          COUNT(DISTINCT DATE(start_time)) as active_days,
          AVG(duration) as avg_duration,
          MIN(start_time) as first_conversation,
          MAX(start_time) as last_conversation
        FROM conversations
      `);

      return {
        totalConversations: stats.total_conversations,
        activeDays: stats.active_days,
        averageDuration: Math.round(stats.avg_duration || 0),
        firstConversation: stats.first_conversation,
        lastConversation: stats.last_conversation
      };
    } catch (error) {
      console.error('Error getting statistics:', error);
      return null;
    }
  }
}

module.exports = SqliteStorageService;