/**
 * Unit Tests for Call Statistics Utilities
 * 
 * Tests timezone-aware call counting functionality to ensure consistent
 * statistics across admin dashboard and conversation APIs.
 */

const CallStatsUtils = require('../utils/call-stats-utils');

// Mock database manager for testing
class MockDatabaseManager {
  constructor() {
    this.initialized = true;
    this.testData = {
      conversations: [],
      todayCallCount: 0
    };
  }

  async waitForInitialization() {
    return Promise.resolve();
  }

  async get(query, params = []) {
    if (query.includes('COUNT(*)') && query.includes('DATE(start_time, \'localtime\')') && query.includes('callsToday')) {
      // Mock today's call count query
      return { callsToday: this.testData.todayCallCount };
    }
    
    if (query.includes('COUNT(*) as count')) {
      // Mock date range call count query - return count based on test data
      // This handles queries with WHERE clauses for date filtering
      return { count: this.testData.conversations.length };
    }
    
    if (query.includes('COUNT(*) as total')) {
      // Mock total calls query
      return { total: this.testData.conversations.length };
    }
    
    return null;
  }

  // Method to set test data
  setTestData(data) {
    this.testData = { ...this.testData, ...data };
  }

  // Mock getTodayCallStats for consistency validation
  async getTodayCallStats() {
    return {
      callsToday: this.testData.todayCallCount,
      lastCallTime: null,
      timeSinceLastCall: null
    };
  }
}

describe('CallStatsUtils', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = new MockDatabaseManager();
  });

  describe('getConfiguredTimezone', () => {
    it('should return default timezone when no environment variable is set', () => {
      delete process.env.TIMEZONE;
      const timezone = CallStatsUtils.getConfiguredTimezone();
      expect(timezone).toBe('America/Los_Angeles');
    });

    it('should return configured timezone from environment variable', () => {
      process.env.TIMEZONE = 'America/New_York';
      const timezone = CallStatsUtils.getConfiguredTimezone();
      expect(timezone).toBe('America/New_York');
      
      // Cleanup
      delete process.env.TIMEZONE;
    });
  });

  describe('getTodayCallCount', () => {
    it('should return call count for today', async () => {
      mockDb.setTestData({ todayCallCount: 5 });
      
      const count = await CallStatsUtils.getTodayCallCount(mockDb);
      expect(count).toBe(5);
    });

    it('should return 0 when there are no calls today', async () => {
      mockDb.setTestData({ todayCallCount: 0 });
      
      const count = await CallStatsUtils.getTodayCallCount(mockDb);
      expect(count).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockDb.get = jest.fn().mockRejectedValue(new Error('Database error'));
      
      const count = await CallStatsUtils.getTodayCallCount(mockDb);
      expect(count).toBe(0);
    });
  });

  describe('getCallsByDateRange', () => {
    it('should return call count for date range', async () => {
      mockDb.setTestData({ conversations: [{}, {}, {}] }); // 3 mock conversations
      
      const count = await CallStatsUtils.getCallsByDateRange(mockDb, {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        timeField: 'start_time'
      });
      
      expect(count).toBe(3);
    });

    it('should work with only start date', async () => {
      mockDb.setTestData({ conversations: [{}, {}] }); // 2 mock conversations
      
      const count = await CallStatsUtils.getCallsByDateRange(mockDb, {
        startDate: '2024-01-01',
        timeField: 'created_at'
      });
      
      expect(count).toBe(2);
    });

    it('should work with only end date', async () => {
      mockDb.setTestData({ conversations: [{}] }); // 1 mock conversation
      
      const count = await CallStatsUtils.getCallsByDateRange(mockDb, {
        endDate: '2024-01-31',
        timeField: 'start_time'
      });
      
      expect(count).toBe(1);
    });

    it('should handle database errors gracefully', async () => {
      mockDb.get = jest.fn().mockRejectedValue(new Error('Database error'));
      
      const count = await CallStatsUtils.getCallsByDateRange(mockDb, {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });
      
      expect(count).toBe(0);
    });
  });

  describe('buildTimezoneAwareDateFilter', () => {
    it('should build correct filter conditions for both dates', () => {
      const filter = CallStatsUtils.buildTimezoneAwareDateFilter(
        '2024-01-01', 
        '2024-01-31', 
        'start_time'
      );
      
      expect(filter.conditions).toHaveLength(2);
      expect(filter.conditions[0]).toBe("DATE(start_time, 'localtime') >= ?");
      expect(filter.conditions[1]).toBe("DATE(start_time, 'localtime') <= ?");
      expect(filter.params).toEqual(['2024-01-01', '2024-01-31']);
      expect(filter.whereClause).toBe("WHERE DATE(start_time, 'localtime') >= ? AND DATE(start_time, 'localtime') <= ?");
    });

    it('should build filter with only start date', () => {
      const filter = CallStatsUtils.buildTimezoneAwareDateFilter(
        '2024-01-01', 
        null, 
        'created_at'
      );
      
      expect(filter.conditions).toHaveLength(1);
      expect(filter.conditions[0]).toBe("DATE(created_at, 'localtime') >= ?");
      expect(filter.params).toEqual(['2024-01-01']);
      expect(filter.whereClause).toBe("WHERE DATE(created_at, 'localtime') >= ?");
    });

    it('should build filter with only end date', () => {
      const filter = CallStatsUtils.buildTimezoneAwareDateFilter(
        null, 
        '2024-01-31', 
        'start_time'
      );
      
      expect(filter.conditions).toHaveLength(1);
      expect(filter.conditions[0]).toBe("DATE(start_time, 'localtime') <= ?");
      expect(filter.params).toEqual(['2024-01-31']);
      expect(filter.whereClause).toBe("WHERE DATE(start_time, 'localtime') <= ?");
    });

    it('should return empty filter when no dates provided', () => {
      const filter = CallStatsUtils.buildTimezoneAwareDateFilter(null, null, 'start_time');
      
      expect(filter.conditions).toHaveLength(0);
      expect(filter.params).toHaveLength(0);
      expect(filter.whereClause).toBe('');
    });

    it('should default to start_time field', () => {
      const filter = CallStatsUtils.buildTimezoneAwareDateFilter('2024-01-01');
      
      expect(filter.conditions[0]).toContain('start_time');
    });
  });

  describe('getCallStatistics', () => {
    it('should return comprehensive call statistics', async () => {
      mockDb.setTestData({ 
        todayCallCount: 3,
        conversations: Array(10).fill({}) // 10 mock conversations
      });
      
      const stats = await CallStatsUtils.getCallStatistics(mockDb);
      
      expect(stats).toHaveProperty('today');
      expect(stats).toHaveProperty('thisWeek');
      expect(stats).toHaveProperty('thisMonth');
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('timezone');
      expect(stats).toHaveProperty('generatedAt');
      
      expect(stats.today).toBe(3);
      expect(stats.total).toBe(10);
      expect(stats.timezone).toBe('America/Los_Angeles');
    });

    it('should handle errors gracefully and return default values', async () => {
      mockDb.get = jest.fn().mockRejectedValue(new Error('Database error'));
      
      const stats = await CallStatsUtils.getCallStatistics(mockDb);
      
      expect(stats).toHaveProperty('error');
      expect(stats.today).toBe(0);
      expect(stats.thisWeek).toBe(0);
      expect(stats.thisMonth).toBe(0);
      expect(stats.total).toBe(0);
    });
  });

  describe('validateCallCountConsistency', () => {
    it('should validate consistency between utility and existing method', async () => {
      mockDb.setTestData({ todayCallCount: 5 });
      
      const validation = await CallStatsUtils.validateCallCountConsistency(mockDb);
      
      expect(validation).toHaveProperty('consistent');
      expect(validation).toHaveProperty('utilityCount');
      expect(validation).toHaveProperty('existingCount');
      expect(validation).toHaveProperty('difference');
      expect(validation).toHaveProperty('timezone');
      expect(validation).toHaveProperty('validatedAt');
      
      expect(validation.consistent).toBe(true);
      expect(validation.utilityCount).toBe(5);
      expect(validation.existingCount).toBe(5);
      expect(validation.difference).toBe(0);
    });

    it('should detect inconsistency between methods', async () => {
      mockDb.setTestData({ todayCallCount: 3 });
      
      // Mock different result from getTodayCallStats
      mockDb.getTodayCallStats = jest.fn().mockResolvedValue({
        callsToday: 5,
        lastCallTime: null,
        timeSinceLastCall: null
      });
      
      const validation = await CallStatsUtils.validateCallCountConsistency(mockDb);
      
      expect(validation.consistent).toBe(false);
      expect(validation.utilityCount).toBe(3);
      expect(validation.existingCount).toBe(5);
      expect(validation.difference).toBe(2);
    });

    it('should handle validation errors gracefully', async () => {
      mockDb.getTodayCallStats = jest.fn().mockRejectedValue(new Error('Validation error'));
      
      const validation = await CallStatsUtils.validateCallCountConsistency(mockDb);
      
      expect(validation).toHaveProperty('consistent');
      expect(validation).toHaveProperty('error');
      expect(validation.consistent).toBe(false);
    });
  });

  describe('timezone configuration tests', () => {
    const originalTimezone = process.env.TIMEZONE;

    afterEach(() => {
      if (originalTimezone) {
        process.env.TIMEZONE = originalTimezone;
      } else {
        delete process.env.TIMEZONE;
      }
    });

    it('should respect TIMEZONE environment variable in all functions', () => {
      process.env.TIMEZONE = 'Europe/London';
      
      const timezone = CallStatsUtils.getConfiguredTimezone();
      expect(timezone).toBe('Europe/London');
      
      // Verify filter generation uses configured timezone context
      const filter = CallStatsUtils.buildTimezoneAwareDateFilter('2024-01-01', null, 'start_time');
      expect(filter.conditions[0]).toContain("DATE(start_time, 'localtime')");
    });

    it('should handle invalid timezone gracefully by falling back to default', () => {
      process.env.TIMEZONE = '';
      
      const timezone = CallStatsUtils.getConfiguredTimezone();
      expect(timezone).toBe('America/Los_Angeles');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle null/undefined database manager', async () => {
      const count = await CallStatsUtils.getTodayCallCount(null);
      expect(count).toBe(0);
    });

    it('should handle null query results', async () => {
      mockDb.get = jest.fn().mockResolvedValue(null);
      
      const count = await CallStatsUtils.getTodayCallCount(mockDb);
      expect(count).toBe(0);
    });

    it('should handle empty date strings', () => {
      const filter = CallStatsUtils.buildTimezoneAwareDateFilter('', '');
      expect(filter.conditions).toHaveLength(0);
    });

    it('should handle undefined options in getCallStatistics', async () => {
      mockDb.setTestData({ todayCallCount: 1, conversations: [{}] });
      
      const stats = await CallStatsUtils.getCallStatistics(mockDb, undefined);
      expect(stats).toHaveProperty('today');
      expect(stats.today).toBe(1);
    });
  });

  describe('SQL injection prevention', () => {
    it('should use parameterized queries in date filters', () => {
      const filter = CallStatsUtils.buildTimezoneAwareDateFilter(
        "'; DROP TABLE conversations; --", 
        "2024-01-31'; DELETE FROM conversations; --"
      );
      
      // Conditions should use placeholders, not direct string interpolation
      expect(filter.conditions[0]).toBe("DATE(start_time, 'localtime') >= ?");
      expect(filter.conditions[1]).toBe("DATE(start_time, 'localtime') <= ?");
      
      // Malicious input should be in params array, not in SQL string
      expect(filter.params[0]).toBe("'; DROP TABLE conversations; --");
      expect(filter.params[1]).toBe("2024-01-31'; DELETE FROM conversations; --");
    });
  });
});

// Integration test with actual date logic (requires timezone setup)
describe('CallStatsUtils Timezone Integration', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = new MockDatabaseManager();
  });

  it('should generate consistent date formats across different timezones', () => {
    const timezones = ['America/Los_Angeles', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];
    
    timezones.forEach(timezone => {
      process.env.TIMEZONE = timezone;
      
      const configuredTimezone = CallStatsUtils.getConfiguredTimezone();
      expect(configuredTimezone).toBe(timezone);
      
      // Verify date filter generation is consistent
      const filter = CallStatsUtils.buildTimezoneAwareDateFilter('2024-01-01', '2024-01-31');
      expect(filter.conditions).toHaveLength(2);
      expect(filter.params).toEqual(['2024-01-01', '2024-01-31']);
    });
    
    // Cleanup
    delete process.env.TIMEZONE;
  });

  it('should maintain consistency between different call counting methods', async () => {
    const testCases = [
      { todayCount: 0, description: 'no calls' },
      { todayCount: 1, description: 'single call' },
      { todayCount: 10, description: 'multiple calls' },
      { todayCount: 100, description: 'high volume' }
    ];

    for (const testCase of testCases) {
      mockDb.setTestData({ todayCallCount: testCase.todayCount });
      
      const validation = await CallStatsUtils.validateCallCountConsistency(mockDb);
      
      expect(validation.consistent).toBe(true);
      expect(validation.utilityCount).toBe(testCase.todayCount);
      expect(validation.existingCount).toBe(testCase.todayCount);
      expect(validation.difference).toBe(0);
    }
  });
});