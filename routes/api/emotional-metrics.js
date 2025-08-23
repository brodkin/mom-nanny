/**
 * Emotional Metrics API Routes
 * 
 * Provides comprehensive endpoints for mental health monitoring dashboard.
 * These endpoints extract emotional states from conversation data and provide
 * insights for caregivers monitoring dementia patients.
 * 
 * Endpoints:
 * - GET /api/emotional-metrics/dashboard - Dashboard summary with trends
 * - GET /api/emotional-metrics/trends - Historical emotional trend data
 * - GET /api/emotional-metrics/alerts - Critical care alerts
 */

const express = require('express');
const router = express.Router();
const DatabaseManager = require('../../services/database-manager');

// Get database manager instance (singleton)
function getDbManager() {
  return DatabaseManager.getInstance();
}

/**
 * Calculate time ranges for queries
 */
function getTimeRanges() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  return {
    today: today.toISOString(),
    yesterday: yesterday.toISOString(),
    week: week.toISOString(),
    month: month.toISOString()
  };
}

/**
 * GET /api/emotional-metrics/dashboard
 * Main dashboard data including stats cards and recent trends
 */
router.get('/dashboard', async (req, res) => {
  try {
    const dbManager = getDbManager();
    await dbManager.waitForInitialization();
    
    const timeRanges = getTimeRanges();
    
    // Get overview statistics
    const overviewStats = await getOverviewStats(dbManager, timeRanges);
    
    // Get recent conversations with emotional data
    const recentConversations = await getRecentConversations(dbManager);
    
    // Get critical alerts
    const alerts = await getCriticalAlerts(dbManager, timeRanges);
    
    // Get trend data for sparklines (last 7 days)
    const trendData = await getTrendData(dbManager, timeRanges.week);
    
    res.json({
      success: true,
      data: {
        overview: overviewStats,
        recentConversations,
        alerts,
        trends: trendData
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching dashboard emotional metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/emotional-metrics/trends
 * Detailed historical trend data for charts
 */
router.get('/trends', async (req, res) => {
  try {
    const dbManager = getDbManager();
    await dbManager.waitForInitialization();
    
    const days = parseInt(req.query.days) || 7;
    const maxDays = Math.min(days, 90); // Limit to 90 days
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - maxDays);
    
    const sql = `
      SELECT 
        DATE(c.start_time) as date,
        AVG(em.anxiety_level) as avg_anxiety,
        AVG(em.agitation_level) as avg_agitation,
        AVG(em.confusion_level) as avg_confusion,
        AVG(em.comfort_level) as avg_comfort,
        MAX(em.anxiety_level) as max_anxiety,
        MAX(em.agitation_level) as max_agitation,
        COUNT(*) as conversation_count
      FROM conversations c
      LEFT JOIN emotional_metrics em ON c.id = em.conversation_id
      WHERE c.start_time >= ? AND em.id IS NOT NULL
      GROUP BY DATE(c.start_time)
      ORDER BY date ASC
    `;
    
    const trendResults = await dbManager.all(sql, [startDate.toISOString()]);
    
    // Fill in missing dates with null values for consistent charting
    const filledTrends = fillMissingDates(trendResults, startDate, maxDays);
    
    res.json({
      success: true,
      data: {
        trends: filledTrends,
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0],
          days: maxDays
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching trend data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trend data',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/emotional-metrics/alerts
 * Critical care alerts and concerning patterns
 */
router.get('/alerts', async (req, res) => {
  try {
    const dbManager = getDbManager();
    await dbManager.waitForInitialization();
    
    const timeRanges = getTimeRanges();
    const alerts = await getCriticalAlerts(dbManager, timeRanges);
    
    res.json({
      success: true,
      data: { alerts },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Helper function to get overview statistics
 */
async function getOverviewStats(dbManager, timeRanges) {
  try {
    // Get today's stats
    const todayStats = await dbManager.get(`
      SELECT 
        COUNT(*) as calls_today,
        AVG(em.anxiety_level) as avg_anxiety,
        AVG(em.comfort_level) as avg_comfort,
        AVG(c.duration) as avg_duration,
        MAX(c.start_time) as last_call_time
      FROM conversations c
      LEFT JOIN emotional_metrics em ON c.id = em.conversation_id
      WHERE c.start_time >= ?
    `, [timeRanges.today]);
    
    // Get weekly comparison
    const weekStats = await dbManager.get(`
      SELECT 
        COUNT(*) as calls_this_week,
        AVG(em.anxiety_level) as avg_anxiety_week,
        COUNT(CASE WHEN em.anxiety_level >= 7 THEN 1 END) as high_anxiety_count
      FROM conversations c
      LEFT JOIN emotional_metrics em ON c.id = em.conversation_id
      WHERE c.start_time >= ?
    `, [timeRanges.week]);
    
    // Get critical indicators
    const criticalCount = await dbManager.get(`
      SELECT 
        COUNT(CASE WHEN em.mentions_pain = 1 THEN 1 END) as pain_mentions,
        COUNT(CASE WHEN em.mentions_staff_complaint = 1 THEN 1 END) as staff_complaints,
        COUNT(CASE WHEN em.anxiety_level >= 8 THEN 1 END) as severe_anxiety_count
      FROM conversations c
      LEFT JOIN emotional_metrics em ON c.id = em.conversation_id
      WHERE c.start_time >= ?
    `, [timeRanges.week]);
    
    return {
      callsToday: todayStats?.calls_today || 0,
      avgAnxiety: Math.round((todayStats?.avg_anxiety || 0) * 10) / 10,
      avgComfort: Math.round((todayStats?.avg_comfort || 0) * 10) / 10,
      avgDuration: formatDuration(todayStats?.avg_duration || 0),
      lastCallTime: todayStats?.last_call_time,
      callsThisWeek: weekStats?.calls_this_week || 0,
      highAnxietyCount: weekStats?.high_anxiety_count || 0,
      alertCount: (criticalCount?.pain_mentions || 0) + 
                 (criticalCount?.staff_complaints || 0) + 
                 (criticalCount?.severe_anxiety_count || 0)
    };
  } catch (error) {
    console.error('Error getting overview stats:', error);
    return {
      callsToday: 0,
      avgAnxiety: 0,
      avgComfort: 0,
      avgDuration: '0:00',
      lastCallTime: null,
      callsThisWeek: 0,
      highAnxietyCount: 0,
      alertCount: 0
    };
  }
}

/**
 * Helper function to get recent conversations
 */
async function getRecentConversations(dbManager) {
  try {
    const sql = `
      SELECT 
        c.id,
        c.call_sid,
        c.start_time,
        c.duration,
        em.anxiety_level,
        em.agitation_level,
        em.confusion_level,
        em.comfort_level,
        em.overall_sentiment,
        em.mentions_pain,
        em.mentions_staff_complaint,
        em.mentions_medication,
        em.mentions_family,
        em.time_of_day,
        em.sentiment_score,
        s.summary_text
      FROM conversations c
      LEFT JOIN emotional_metrics em ON c.id = em.conversation_id
      LEFT JOIN summaries s ON c.id = s.conversation_id
      ORDER BY c.start_time DESC
      LIMIT 5
    `;
    
    const conversations = await dbManager.all(sql);
    
    return conversations.map(conv => ({
      id: conv.id,
      callSid: conv.call_sid,
      startTime: conv.start_time,
      duration: formatDurationHumanReadable(conv.duration),
      anxietyLevel: conv.anxiety_level,
      agitationLevel: conv.agitation_level,
      confusionLevel: conv.confusion_level,
      comfortLevel: conv.comfort_level,
      sentiment: conv.overall_sentiment,
      sentimentScore: conv.sentiment_score,
      timeOfDay: conv.time_of_day,
      mentionsPain: conv.mentions_pain,
      mentionsMedication: conv.mentions_medication,
      mentionsFamily: conv.mentions_family,
      hasCareIndicators: conv.mentions_pain || conv.mentions_staff_complaint,
      emotionalState: determineEmotionalState(conv),
      callTitle: generateCallTitle(conv)
    }));
  } catch (error) {
    console.error('Error getting recent conversations:', error);
    return [];
  }
}

/**
 * Helper function to get critical alerts
 */
async function getCriticalAlerts(dbManager, timeRanges) {
  try {
    const alerts = [];
    
    // Check for high anxiety patterns (last 24 hours)
    const highAnxietyCount = await dbManager.get(`
      SELECT COUNT(*) as count
      FROM conversations c
      JOIN emotional_metrics em ON c.id = em.conversation_id
      WHERE c.start_time >= ? AND em.anxiety_level >= 8
    `, [timeRanges.yesterday]);
    
    if ((highAnxietyCount?.count || 0) >= 2) {
      alerts.push({
        id: 'high_anxiety_pattern',
        type: 'warning',
        severity: 'high',
        title: 'Elevated Anxiety Pattern Detected',
        message: `${highAnxietyCount.count} conversations with high anxiety in the last 24 hours`,
        timestamp: new Date().toISOString(),
        action: 'Consider contacting care team'
      });
    }
    
    // Check for pain mentions (last 7 days)
    const painMentions = await dbManager.get(`
      SELECT COUNT(*) as count, MAX(c.start_time) as last_mention
      FROM conversations c
      JOIN emotional_metrics em ON c.id = em.conversation_id
      WHERE c.start_time >= ? AND em.mentions_pain = 1
    `, [timeRanges.week]);
    
    if ((painMentions?.count || 0) > 0) {
      alerts.push({
        id: 'pain_mentions',
        type: 'error',
        severity: 'critical',
        title: 'Pain Mentioned in Conversations',
        message: `Pain mentioned in ${painMentions.count} conversation(s) this week`,
        timestamp: painMentions.last_mention,
        action: 'Review with medical staff immediately'
      });
    }
    
    // Check for staff complaints
    const staffComplaints = await dbManager.get(`
      SELECT COUNT(*) as count, MAX(c.start_time) as last_complaint
      FROM conversations c
      JOIN emotional_metrics em ON c.id = em.conversation_id
      WHERE c.start_time >= ? AND em.mentions_staff_complaint = 1
    `, [timeRanges.week]);
    
    if ((staffComplaints?.count || 0) > 0) {
      alerts.push({
        id: 'staff_complaints',
        type: 'warning',
        severity: 'medium',
        title: 'Staff-Related Concerns Expressed',
        message: `Concerns about staff mentioned in ${staffComplaints.count} conversation(s)`,
        timestamp: staffComplaints.last_complaint,
        action: 'Follow up with facility management'
      });
    }
    
    return alerts;
  } catch (error) {
    console.error('Error getting critical alerts:', error);
    return [];
  }
}

/**
 * Helper function to get trend data for sparklines
 */
async function getTrendData(dbManager, startDate) {
  try {
    const sql = `
      SELECT 
        DATE(c.start_time) as date,
        AVG(em.anxiety_level) as anxiety,
        AVG(em.agitation_level) as agitation,
        AVG(em.confusion_level) as confusion,
        AVG(em.comfort_level) as comfort
      FROM conversations c
      LEFT JOIN emotional_metrics em ON c.id = em.conversation_id
      WHERE c.start_time >= ? AND em.id IS NOT NULL
      GROUP BY DATE(c.start_time)
      ORDER BY date ASC
    `;
    
    const results = await dbManager.all(sql, [startDate]);
    
    return {
      anxiety: results.map(r => ({ date: r.date, value: Math.round((r.anxiety || 0) * 10) / 10 })),
      agitation: results.map(r => ({ date: r.date, value: Math.round((r.agitation || 0) * 10) / 10 })),
      confusion: results.map(r => ({ date: r.date, value: Math.round((r.confusion || 0) * 10) / 10 })),
      comfort: results.map(r => ({ date: r.date, value: Math.round((r.comfort || 0) * 10) / 10 }))
    };
  } catch (error) {
    console.error('Error getting trend data:', error);
    return {
      anxiety: [],
      agitation: [],
      confusion: [],
      comfort: []
    };
  }
}

/**
 * Helper functions
 */
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatDurationHumanReadable(seconds) {
  if (!seconds || seconds < 1) return 'Less than 1 second';
  
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  
  if (minutes === 0) {
    return `${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
  } else if (remainingSeconds === 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}, ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
  }
}

function generateCallTitle(conversation) {
  // Extract key insights from summary data if available
  let title = null;
  
  if (conversation.summary_text) {
    try {
      const summary = JSON.parse(conversation.summary_text);
      
      // Check for specific concerns in care indicators
      if (summary.careIndicators) {
        if (summary.careIndicators.painComplaints && summary.careIndicators.painComplaints.length > 0) {
          title = 'Pain & Discomfort Concerns';
        } else if (summary.careIndicators.medicationConcerns && summary.careIndicators.medicationConcerns.length > 0) {
          title = 'Medication Questions';
        } else if (summary.careIndicators.staffComplaints && summary.careIndicators.staffComplaints.length > 0) {
          title = 'Staff Concerns';
        } else if (summary.careIndicators.hospitalRequests > 0) {
          title = 'Hospital/Medical Requests';
        }
      }
      
      // Check mental state indicators for specific patterns
      if (!title && summary.mentalStateIndicators) {
        const anxietyLevel = summary.mentalStateIndicators.anxietyLevel;
        if (anxietyLevel >= 7) {
          title = 'High Anxiety Episode';
        } else if (anxietyLevel >= 4) {
          title = 'Mild Anxiety & Reassurance';
        }
      }
      
      // Check clinical observations
      if (!title && summary.clinicalObservations) {
        if (summary.clinicalObservations.hypochondriaEvents > 0) {
          title = 'Health Anxiety & Reassurance';
        } else if (summary.clinicalObservations.delusionalStatements && summary.clinicalObservations.delusionalStatements.length > 0) {
          title = 'Confusion & Gentle Redirection';
        } else if (summary.clinicalObservations.paranoiaLevel !== 'none') {
          title = 'Paranoid Thoughts';
        }
      }
      
      // Check engagement quality for positive calls
      if (!title && summary.supportEffectiveness && summary.supportEffectiveness.engagementQuality) {
        const engagement = summary.supportEffectiveness.engagementQuality;
        if (engagement.level === 'high' && engagement.score >= 80) {
          title = 'Pleasant Conversation';
        }
      }
      
    } catch (e) {
      // If summary parsing fails, fall back to emotional metrics
    }
  }
  
  // Fallback to emotional state analysis
  if (!title) {
    const anxiety = conversation.anxiety_level || 0;
    const comfort = conversation.comfort_level || 0;
    const agitation = conversation.agitation_level || 0;
    
    if (conversation.mentions_pain) {
      title = 'Pain & Discomfort Discussion';
    } else if (conversation.mentions_medication) {
      title = 'Medication Conversation';
    } else if (conversation.mentions_family) {
      title = 'Family & Memory Sharing';
    } else if (anxiety >= 7 || agitation >= 7) {
      title = 'High Distress & Support';
    } else if (anxiety >= 4) {
      title = 'Mild Anxiety & Reassurance';
    } else if (comfort >= 7) {
      title = 'Comfortable Check-in';
    } else if (conversation.overall_sentiment === 'positive') {
      title = 'Positive Interaction';
    } else if (conversation.overall_sentiment === 'negative') {
      title = 'Emotional Support Call';
    } else {
      title = 'General Conversation';
    }
  }
  
  return title;
}

// Keep the old function for backward compatibility
function _generateCallIdentifier(conversation) {
  return generateCallTitle(conversation);
}

function determineEmotionalState(conversation) {
  const anxiety = conversation.anxiety_level || 0;
  const agitation = conversation.agitation_level || 0;
  const comfort = conversation.comfort_level || 0;
  
  if (anxiety >= 7 || agitation >= 7) return 'distressed';
  if (comfort >= 7 && anxiety <= 3 && agitation <= 3) return 'comfortable';
  return 'neutral';
}

function fillMissingDates(data, startDate, days) {
  const filled = [];
  const dataMap = new Map(data.map(d => [d.date, d]));
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    if (dataMap.has(dateStr)) {
      filled.push(dataMap.get(dateStr));
    } else {
      filled.push({
        date: dateStr,
        avg_anxiety: null,
        avg_agitation: null,
        avg_confusion: null,
        avg_comfort: null,
        max_anxiety: null,
        max_agitation: null,
        conversation_count: 0
      });
    }
  }
  
  return filled;
}

module.exports = router;