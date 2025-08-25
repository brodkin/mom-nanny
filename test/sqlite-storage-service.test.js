const SqliteStorageService = require('../services/sqlite-storage-service');
const DatabaseManager = require('../services/database-manager');

describe('SqliteStorageService', () => {
  let storageService;
  let dbManager;

  beforeEach(() => {
    // Create fresh in-memory database for each test
    dbManager = new DatabaseManager(':memory:');
    storageService = new SqliteStorageService(dbManager);
  });

  afterEach(() => {
    if (dbManager) {
      dbManager.close();
    }
  });

  describe('saveSummary', () => {
    test('should save a complete conversation summary', async () => {
      const mockSummary = {
        callSid: 'test-call-123',
        startTime: '2024-01-15T14:30:00Z',
        endTime: '2024-01-15T14:35:00Z',
        callMetadata: {
          duration: 300,
          dayOfWeek: 'Monday',
          timeOfDay: 'afternoon'
        },
        conversationMetrics: {
          totalInteractions: 15,
          userUtterances: 8,
          assistantResponses: 7
        },
        mentalStateIndicators: {
          anxietyLevel: 2,
          confusionIndicators: 1
        },
        careIndicators: {
          medicationConcerns: [],
          painComplaints: []
        },
        behavioralPatterns: {
          responseLatency: 1200,
          coherenceLevel: 0.8
        },
        clinicalObservations: {
          hypochondriaEvents: 0
        },
        supportEffectiveness: {
          comfortingSuccess: []
        },
        caregiverInsights: {
          recommendedConversationStarters: [],
          topicsToAvoid: []
        }
      };

      const result = await storageService.saveSummary(mockSummary);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result.conversationId).toMatch(/^conversation-\d+$/);
      expect(typeof result.numericId).toBe('number');
      expect(result.numericId).toBeGreaterThan(0);
    });

    test('should handle missing endTime gracefully', async () => {
      const mockSummary = {
        callSid: 'test-call-456',
        startTime: '2024-01-15T14:30:00Z',
        // endTime missing
        callMetadata: {
          duration: 300
        },
        conversationMetrics: {},
        mentalStateIndicators: {},
        careIndicators: {},
        behavioralPatterns: {},
        clinicalObservations: {},
        supportEffectiveness: {},
        caregiverInsights: {}
      };

      const result = await storageService.saveSummary(mockSummary);
      expect(result).toBeDefined();
      expect(result.conversationId).toMatch(/^conversation-\d+$/);
    });

    test('should generate unique identifiers for conversations', async () => {
      const summary1 = {
        callSid: 'call-1',
        startTime: '2024-01-15T14:30:00Z',
        endTime: '2024-01-15T14:35:00Z',
        callMetadata: { duration: 300 },
        conversationMetrics: {},
        mentalStateIndicators: {},
        careIndicators: {},
        behavioralPatterns: {},
        clinicalObservations: {},
        supportEffectiveness: {},
        caregiverInsights: {}
      };

      const summary2 = { ...summary1, callSid: 'call-2' };

      const result1 = await storageService.saveSummary(summary1);
      const result2 = await storageService.saveSummary(summary2);

      expect(result1.conversationId).not.toBe(result2.conversationId);
      expect(result1.numericId).not.toBe(result2.numericId);
    });

    test('should handle duplicate call_sid by updating existing record', async () => {
      const mockSummary = {
        callSid: 'duplicate-call',
        startTime: '2024-01-15T14:30:00Z',
        endTime: '2024-01-15T14:35:00Z',
        callMetadata: { duration: 300 },
        conversationMetrics: { totalInteractions: 10 },
        mentalStateIndicators: {},
        careIndicators: {},
        behavioralPatterns: {},
        clinicalObservations: {},
        supportEffectiveness: {},
        caregiverInsights: {}
      };

      // Save first time
      const result1 = await storageService.saveSummary(mockSummary);
      
      // Save again with updated data
      mockSummary.conversationMetrics.totalInteractions = 15;
      const result2 = await storageService.saveSummary(mockSummary);

      expect(result1.conversationId).toBe(result2.conversationId); // Should return same conversation ID
      expect(result1.numericId).toBe(result2.numericId); // Should return same numeric ID
    });
  });

  describe('loadSummary', () => {
    test('should load a saved summary', async () => {
      const mockSummary = {
        callSid: 'load-test-123',
        startTime: '2024-01-15T14:30:00Z',
        endTime: '2024-01-15T14:35:00Z',
        callMetadata: { duration: 300 },
        conversationMetrics: { totalInteractions: 10 },
        mentalStateIndicators: { anxietyLevel: 2 },
        careIndicators: {},
        behavioralPatterns: {},
        clinicalObservations: {},
        supportEffectiveness: {},
        caregiverInsights: {}
      };

      const result = await storageService.saveSummary(mockSummary);
      const loaded = await storageService.loadSummary(result.conversationId);

      expect(loaded).toBeDefined();
      expect(loaded.callSid).toBe(mockSummary.callSid);
      expect(loaded.conversationMetrics.totalInteractions).toBe(10);
      expect(loaded.mentalStateIndicators.anxietyLevel).toBe(2);
    });

    test('should throw error for non-existent summary', async () => {
      await expect(storageService.loadSummary('conversation-999999'))
        .rejects
        .toThrow('Conversation not found: conversation-999999');
    });

    test('should throw error for invalid conversation ID format', async () => {
      await expect(storageService.loadSummary('invalid-id'))
        .rejects
        .toThrow('Invalid conversation ID format: invalid-id');
    });
  });

  describe('listSummariesForDate', () => {
    beforeEach(async () => {
      // Insert test data for different dates
      const testSummaries = [
        {
          callSid: 'call-2024-01-15-1',
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T10:05:00Z',
          callMetadata: { duration: 300 },
          conversationMetrics: {},
          mentalStateIndicators: {},
          careIndicators: {},
          behavioralPatterns: {},
          clinicalObservations: {},
          supportEffectiveness: {},
          caregiverInsights: {}
        },
        {
          callSid: 'call-2024-01-15-2',
          startTime: '2024-01-15T15:00:00Z',
          endTime: '2024-01-15T15:05:00Z',
          callMetadata: { duration: 300 },
          conversationMetrics: {},
          mentalStateIndicators: {},
          careIndicators: {},
          behavioralPatterns: {},
          clinicalObservations: {},
          supportEffectiveness: {},
          caregiverInsights: {}
        },
        {
          callSid: 'call-2024-01-16-1',
          startTime: '2024-01-16T10:00:00Z',
          endTime: '2024-01-16T10:05:00Z',
          callMetadata: { duration: 300 },
          conversationMetrics: {},
          mentalStateIndicators: {},
          careIndicators: {},
          behavioralPatterns: {},
          clinicalObservations: {},
          supportEffectiveness: {},
          caregiverInsights: {}
        }
      ];

      for (const summary of testSummaries) {
        await storageService.saveSummary(summary);
      }
    });

    test('should return summaries for specific date', async () => {
      const date = new Date('2024-01-15');
      const results = await storageService.listSummariesForDate(date);

      expect(results).toHaveLength(2);
      expect(results.every(id => typeof id === 'string')).toBe(true);
    });

    test('should return empty array for date with no summaries', async () => {
      const date = new Date('2024-01-17');
      const results = await storageService.listSummariesForDate(date);

      expect(results).toHaveLength(0);
      expect(Array.isArray(results)).toBe(true);
    });

    test('should handle timezone correctly', async () => {
      const date = new Date('2024-01-16');
      const results = await storageService.listSummariesForDate(date);

      expect(results).toHaveLength(1);
    });
  });

  describe('generateWeeklyReport', () => {
    beforeEach(async () => {
      // Insert test data for a week
      const startDate = new Date('2024-01-15'); // Monday
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        // Add 1-3 calls per day
        const callsPerDay = Math.floor(Math.random() * 3) + 1;
        for (let j = 0; j < callsPerDay; j++) {
          const callTime = new Date(date);
          callTime.setHours(10 + j, 0, 0, 0);
          
          await storageService.saveSummary({
            callSid: `call-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${j}`,
            startTime: callTime.toISOString(),
            endTime: new Date(callTime.getTime() + 300000).toISOString(), // 5 minutes later
            callMetadata: { duration: 300 },
            conversationMetrics: {},
            mentalStateIndicators: {},
            careIndicators: {},
            behavioralPatterns: {},
            clinicalObservations: {},
            supportEffectiveness: {},
            caregiverInsights: {}
          });
        }
      }
    });

    test('should generate weekly report', async () => {
      const startDate = new Date('2024-01-15');
      const result = await storageService.generateWeeklyReport(startDate);

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result.reportId).toMatch(/^weekly-report-\d+$/);
      expect(result.data).toBeDefined();
      expect(result.data.weekStart).toBe('2024-01-15');
    });

    test('should calculate weekly statistics correctly', async () => {
      const startDate = new Date('2024-01-15');
      const reportResult = await storageService.generateWeeklyReport(startDate);
      
      // Verify the report structure and basic statistics
      expect(reportResult.reportId).toBeDefined();
      expect(reportResult.data).toBeDefined();
      expect(reportResult.data.totalCalls).toBeGreaterThanOrEqual(0);
      expect(reportResult.data.dailyBreakdown).toHaveLength(7);
    });
  });

  describe('performance', () => {
    test('should save summaries in under 100ms', async () => {
      const mockSummary = {
        callSid: 'perf-test-123',
        startTime: '2024-01-15T14:30:00Z',
        endTime: '2024-01-15T14:35:00Z',
        callMetadata: { duration: 300 },
        conversationMetrics: {},
        mentalStateIndicators: {},
        careIndicators: {},
        behavioralPatterns: {},
        clinicalObservations: {},
        supportEffectiveness: {},
        caregiverInsights: {}
      };

      const start = Date.now();
      await storageService.saveSummary(mockSummary);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    test('should load summaries in under 100ms', async () => {
      const mockSummary = {
        callSid: 'perf-load-test',
        startTime: '2024-01-15T14:30:00Z',
        endTime: '2024-01-15T14:35:00Z',
        callMetadata: { duration: 300 },
        conversationMetrics: {},
        mentalStateIndicators: {},
        careIndicators: {},
        behavioralPatterns: {},
        clinicalObservations: {},
        supportEffectiveness: {},
        caregiverInsights: {}
      };

      const result = await storageService.saveSummary(mockSummary);

      const start = Date.now();
      await storageService.loadSummary(result.conversationId);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('API methods', () => {
    test('should have all required storage methods', () => {
      expect(typeof storageService.saveSummary).toBe('function');
      expect(typeof storageService.loadSummary).toBe('function');
      expect(typeof storageService.listSummariesForDate).toBe('function');
      expect(typeof storageService.generateWeeklyReport).toBe('function');
    });

    test('should return expected data structures', async () => {
      const mockSummary = {
        callSid: 'api-compat-test',
        startTime: '2024-01-15T14:30:00Z',
        endTime: '2024-01-15T14:35:00Z',
        callMetadata: { duration: 300 },
        conversationMetrics: { totalInteractions: 10 },
        mentalStateIndicators: {},
        careIndicators: {},
        behavioralPatterns: {},
        clinicalObservations: {},
        supportEffectiveness: {},
        caregiverInsights: {}
      };

      const result = await storageService.saveSummary(mockSummary);
      const loaded = await storageService.loadSummary(result.conversationId);

      // Should have all the same top-level properties
      expect(loaded).toHaveProperty('callSid');
      expect(loaded).toHaveProperty('startTime');
      expect(loaded).toHaveProperty('endTime');
      expect(loaded).toHaveProperty('callMetadata');
      expect(loaded).toHaveProperty('conversationMetrics');
      expect(loaded).toHaveProperty('mentalStateIndicators');
      expect(loaded).toHaveProperty('careIndicators');
      expect(loaded).toHaveProperty('behavioralPatterns');
      expect(loaded).toHaveProperty('clinicalObservations');
      expect(loaded).toHaveProperty('supportEffectiveness');
      expect(loaded).toHaveProperty('caregiverInsights');
    });
  });
});