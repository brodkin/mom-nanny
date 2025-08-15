/**
 * Dashboard Data Service
 * Mock service for testing dashboard functionality
 */

class DashboardDataService {
  constructor(dbManager) {
    this.dbManager = dbManager;
  }

  async getOverviewStats() {
    return {
      conversations: {
        today: 5,
        averageDuration: 720, // 12 minutes
        successRate: 95,
        total: 150
      },
      performance: {
        avgResponseTime: 1.2,
        avgMessageLength: 50
      },
      services: {
        gpt: { status: 'healthy', lastCheck: new Date().toISOString() },
        deepgram: { status: 'healthy', lastCheck: new Date().toISOString() },
        twilio: { status: 'healthy', lastCheck: new Date().toISOString() },
        database: { status: 'healthy', lastCheck: new Date().toISOString() }
      },
      memories: {
        totalMemories: 23
      },
      timestamp: new Date().toISOString()
    };
  }

  async getMentalStateIndicators(days = 7) {
    return {
      timeRange: {
        start: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
        days
      },
      trends: Array.from({ length: days }, (_, i) => ({
        date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toISOString(),
        anxietyLevel: Math.random() * 0.5,
        confusionLevel: Math.random() * 0.3,
        agitationLevel: Math.random() * 0.2
      })),
      summary: {
        overallStatus: 'calm',
        avgAnxietyLevel: 0.3,
        avgConfusionLevel: 0.2
      },
      anxietyPatterns: [],
      confusionIndicators: []
    };
  }

  async getCareIndicators(days = 30) {
    return {
      timeRange: {
        start: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
        days
      },
      indicators: {
        medicationMentions: 3,
        painComplaints: 2,
        hospitalRequests: 0,
        staffComplaints: 1
      },
      medicationTrends: {
        trend: 'stable',
        weeklyAverage: 1.2,
        commonConcerns: ['timing', 'dosage']
      },
      painComplaintsTrends: {
        trend: 'down',
        weeklyAverage: 0.8,
        commonAreas: ['back', 'head', 'joints']
      },
      hospitalRequests: {
        trend: 'stable',
        weeklyAverage: 0,
        commonReasons: []
      },
      riskAssessment: {
        level: 'low',
        score: 0.2,
        factors: []
      },
      recommendations: []
    };
  }

  async getConversationTrends(days = 30) {
    return {
      timeRange: {
        start: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
        days
      },
      dailyPatterns: Array.from({ length: Math.min(days, 7) }, (_, i) => ({
        date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString(),
        callCount: Math.floor(Math.random() * 8) + 2,
        avgDuration: Math.floor(Math.random() * 600) + 300
      })),
      hourlyDistribution: [
        { hour: 9, callCount: 2 },
        { hour: 10, callCount: 3 },
        { hour: 11, callCount: 4 },
        { hour: 14, callCount: 5 },
        { hour: 15, callCount: 4 },
        { hour: 16, callCount: 3 },
        { hour: 19, callCount: 2 },
        { hour: 20, callCount: 1 }
      ],
      functionUsage: {
        'News Headlines': 35,
        'Memory Functions': 25,
        'Comfort Responses': 30,
        'Care Check': 10
      },
      engagementMetrics: {
        averageCallDuration: 720,
        responseRate: 0.95,
        satisfactionScore: 0.85
      },
      insights: [
        'Consistent engagement patterns',
        'Stable call duration',
        'Good response rates'
      ]
    };
  }
}

module.exports = DashboardDataService;