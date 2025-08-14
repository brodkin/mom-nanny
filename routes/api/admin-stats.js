const express = require('express');
const router = express.Router();

/**
 * Admin Statistics API Routes
 * 
 * Provides endpoints for system statistics, call data, and activity monitoring
 * Currently returns mock data with realistic structure for development
 */

// Helper function to generate realistic mock data
const generateMockCallData = (count = 10) => {
  const calls = [];
  const now = new Date();
  
  // Generate calls over the past 7 days
  for (let i = 0; i < count; i++) {
    const callDate = new Date(now.getTime() - (Math.random() * 7 * 24 * 60 * 60 * 1000));
    const duration = Math.floor(Math.random() * 1800) + 30; // 30 seconds to 30 minutes
    const status = Math.random() > 0.1 ? 'completed' : 'failed'; // 90% success rate
    
    calls.push({
      id: `call_${Date.now()}_${i}`,
      callSid: `CA${Math.random().toString(36).substr(2, 32)}`,
      from: '+15551234567', // Mock number for privacy
      to: process.env.APP_NUMBER || '+15559876543',
      startTime: callDate.toISOString(),
      duration: duration,
      status: status,
      transcriptSummary: generateCallSummary(),
      sentiment: Math.random() > 0.3 ? 'positive' : 'anxious',
      interactionCount: Math.floor(Math.random() * 20) + 1,
      aiResponseTime: Math.floor(Math.random() * 3000) + 500 // 500ms to 3.5s
    });
  }
  
  return calls.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
};

const generateCallSummary = () => {
  const summaries = [
    'Caller asked about her day and discussed her dogs. Conversation was calm and positive.',
    'Called asking about meal times. Redirected to discussing Hawaii vacation memories.',
    'Anxious call about facility staff. Provided reassurance and discussed positive topics.',
    'Short call asking about weather. Discussed gardening and her favorite flowers.',
    'Longer conversation about family memories and her late husband. Very engaged.',
    'Called multiple times in succession. Each call was brief but peaceful.',
    'Discussed her concerns about memory. Provided comfort and talked about her pets.',
    'Pleasant conversation about her hobbies and interests. Good mood throughout.'
  ];
  
  return summaries[Math.floor(Math.random() * summaries.length)];
};

const generateActivityData = (count = 20) => {
  const activities = [];
  const now = new Date();
  
  const activityTypes = [
    { type: 'call_completed', message: 'Call completed successfully', severity: 'info' },
    { type: 'call_started', message: 'New incoming call received', severity: 'info' },
    { type: 'function_called', message: 'Function executed: transferCall', severity: 'info' },
    { type: 'system_restart', message: 'System service restarted', severity: 'warning' },
    { type: 'config_updated', message: 'System configuration updated', severity: 'info' },
    { type: 'error_recovered', message: 'Recovered from transcription error', severity: 'warning' },
    { type: 'daily_summary', message: 'Daily call summary generated', severity: 'info' }
  ];
  
  for (let i = 0; i < count; i++) {
    const activityDate = new Date(now.getTime() - (Math.random() * 24 * 60 * 60 * 1000));
    const activity = activityTypes[Math.floor(Math.random() * activityTypes.length)];
    
    activities.push({
      id: `activity_${Date.now()}_${i}`,
      timestamp: activityDate.toISOString(),
      type: activity.type,
      message: activity.message,
      severity: activity.severity,
      details: {
        service: 'ai-companion',
        version: '1.0.0'
      }
    });
  }
  
  return activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

// GET /api/admin/stats - System statistics endpoint
router.get('/stats', (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    // Generate mock statistics
    const stats = {
      system: {
        status: 'operational',
        uptime: Math.floor(Math.random() * 86400 * 7), // Up to 7 days in seconds
        lastRestart: new Date(now.getTime() - (Math.random() * 86400 * 3 * 1000)).toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      },
      calls: {
        total: Math.floor(Math.random() * 1000) + 500,
        today: Math.floor(Math.random() * 20) + 5,
        thisWeek: Math.floor(Math.random() * 100) + 30,
        averageDuration: Math.floor(Math.random() * 600) + 300, // 5-15 minutes
        successRate: (95 + Math.random() * 5).toFixed(1) // 95-100%
      },
      performance: {
        averageResponseTime: Math.floor(Math.random() * 2000) + 500, // 0.5-2.5 seconds
        transcriptionAccuracy: (96 + Math.random() * 4).toFixed(1), // 96-100%
        ttsQuality: (94 + Math.random() * 6).toFixed(1), // 94-100%
        errorRate: (Math.random() * 2).toFixed(2) // 0-2%
      },
      ai: {
        modelVersion: 'gpt-4',
        contextLength: 8192,
        functionsAvailable: 5,
        averageTokensPerResponse: Math.floor(Math.random() * 300) + 150,
        sentimentBreakdown: {
          positive: Math.floor(Math.random() * 40) + 40, // 40-80%
          neutral: Math.floor(Math.random() * 30) + 15,  // 15-45%
          anxious: Math.floor(Math.random() * 25) + 5    // 5-30%
        }
      },
      services: {
        gpt: { status: 'healthy', lastCheck: now.toISOString() },
        deepgram: { status: 'healthy', lastCheck: now.toISOString() },
        twilio: { status: 'healthy', lastCheck: now.toISOString() },
        database: { status: 'healthy', lastCheck: now.toISOString() }
      }
    };
    
    res.json({
      success: true,
      data: stats,
      timestamp: now.toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system statistics',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/admin/calls - Recent calls data
router.get('/calls', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status; // Filter by status if provided
    
    let calls = generateMockCallData(Math.min(limit + offset + 10, 100));
    
    // Apply status filter if provided
    if (status) {
      calls = calls.filter(call => call.status === status);
    }
    
    // Apply pagination
    const paginatedCalls = calls.slice(offset, offset + limit);
    
    res.json({
      success: true,
      data: {
        calls: paginatedCalls,
        pagination: {
          total: calls.length,
          limit: limit,
          offset: offset,
          hasMore: offset + limit < calls.length
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching calls data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch calls data',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/admin/calls/:callId - Individual call details
router.get('/calls/:callId', (req, res) => {
  try {
    const { callId } = req.params;
    
    // Generate detailed mock call data
    const now = new Date();
    const callStart = new Date(now.getTime() - (Math.random() * 24 * 60 * 60 * 1000));
    const duration = Math.floor(Math.random() * 1800) + 30;
    
    const callDetails = {
      id: callId,
      callSid: `CA${Math.random().toString(36).substr(2, 32)}`,
      from: '+15551234567',
      to: process.env.APP_NUMBER || '+15559876543',
      startTime: callStart.toISOString(),
      endTime: new Date(callStart.getTime() + duration * 1000).toISOString(),
      duration: duration,
      status: 'completed',
      transcript: [
        { speaker: 'caller', timestamp: callStart.toISOString(), text: 'Hello? Is someone there?' },
        { speaker: 'ai', timestamp: new Date(callStart.getTime() + 2000).toISOString(), text: 'Hi Francine! How are you doing today?' },
        { speaker: 'caller', timestamp: new Date(callStart.getTime() + 8000).toISOString(), text: 'Oh, I\'m okay. I was just wondering about lunch.' },
        { speaker: 'ai', timestamp: new Date(callStart.getTime() + 12000).toISOString(), text: 'That sounds good! Have you been enjoying your meals lately? I remember you mentioning you like the soup they make.' }
      ],
      sentiment: 'positive',
      analysis: {
        interactionCount: 15,
        averageResponseTime: 1250,
        functionsUsed: [],
        topicsSummary: ['daily activities', 'meals', 'positive conversation'],
        moodProgression: 'started neutral, became more positive'
      },
      technicalMetrics: {
        audioQuality: 'good',
        transcriptionConfidence: 0.94,
        networkLatency: 120,
        errors: []
      }
    };
    
    res.json({
      success: true,
      data: callDetails,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching call details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch call details',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/admin/activity - Activity feed data
router.get('/activity', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const severity = req.query.severity; // Filter by severity if provided
    
    let activities = generateActivityData(Math.min(limit * 2, 200));
    
    // Apply severity filter if provided
    if (severity) {
      activities = activities.filter(activity => activity.severity === severity);
    }
    
    // Limit results
    activities = activities.slice(0, limit);
    
    res.json({
      success: true,
      data: {
        activities: activities,
        summary: {
          total: activities.length,
          severityBreakdown: {
            info: activities.filter(a => a.severity === 'info').length,
            warning: activities.filter(a => a.severity === 'warning').length,
            error: activities.filter(a => a.severity === 'error').length
          }
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching activity data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity data',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/admin/dashboard - Dashboard summary data
router.get('/dashboard', (req, res) => {
  try {
    const now = new Date();
    
    const dashboardData = {
      quickStats: {
        callsToday: Math.floor(Math.random() * 15) + 5,
        avgCallDuration: '8:30',
        systemUptime: '99.8%',
        lastCallTime: new Date(now.getTime() - Math.random() * 3600000).toISOString()
      },
      recentCalls: generateMockCallData(5),
      alerts: [
        {
          id: 'alert_1',
          type: 'info',
          message: 'System running normally',
          timestamp: now.toISOString()
        },
        {
          id: 'alert_2',
          type: 'success',
          message: 'All services healthy',
          timestamp: new Date(now.getTime() - 300000).toISOString()
        }
      ],
      trends: {
        callVolume: Array.from({ length: 7 }, (_, i) => ({
          date: new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          calls: Math.floor(Math.random() * 20) + 5
        })).reverse(),
        sentiment: {
          positive: 65,
          neutral: 25,
          anxious: 10
        }
      }
    };
    
    res.json({
      success: true,
      data: dashboardData,
      timestamp: now.toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;