/**
 * Test suite for DashboardDataService getConversationTrends method
 * Tests for SQL parameter error reproduction and fix validation
 */

const DashboardDataService = require('../services/dashboard-data-service');

// Mock database manager
class MockDatabaseManager {
  constructor() {
    this.initialized = false;
    this.queries = [];
    this.parameters = [];
  }

  async waitForInitialization() {
    this.initialized = true;
  }

  async exec(query) {
    this.queries.push(query);
    return true;
  }

  async all(query, params = []) {
    this.queries.push(query);
    this.parameters.push(params);
    
    // Simulate the SQL parameter error
    const placeholderCount = (query.match(/\?/g) || []).length;
    const paramCount = params.length;
    
    if (placeholderCount !== paramCount) {
      throw new RangeError(`Too few parameter values were provided. Expected ${placeholderCount}, got ${paramCount}`);
    }

    // Return mock data for successful queries
    if (query.includes('DATE(start_time)')) {
      return [
        { call_date: '2024-01-01', call_count: 3, avg_duration: 120, min_duration: 60, max_duration: 180 },
        { call_date: '2024-01-02', call_count: 2, avg_duration: 150, min_duration: 90, max_duration: 210 }
      ];
    }

    return [];
  }

  async get(query, params = []) {
    this.queries.push(query);
    this.parameters.push(params);
    
    const placeholderCount = (query.match(/\?/g) || []).length;
    const paramCount = params.length;
    
    if (placeholderCount !== paramCount) {
      throw new RangeError(`Too few parameter values were provided. Expected ${placeholderCount}, got ${paramCount}`);
    }

    return { count: 0 };
  }
}

describe('DashboardDataService - getConversationTrends SQL Parameter Error', () => {
  let service;
  let mockDb;

  beforeEach(() => {
    mockDb = new MockDatabaseManager();
    service = new DashboardDataService(mockDb);
  });

  test('should NOT have SQL parameter error in getConversationTrends (bug fixed)', async () => {
    // This test verifies the bug is fixed - it should now work without error
    const result = await service.getConversationTrends(30);
    expect(result).toHaveProperty('timeRange');
    expect(result).toHaveProperty('dailyPatterns');
    expect(result).toHaveProperty('engagementMetrics');
  });

  test('should handle valid parameters correctly after fix', async () => {
    // This test will pass once the bug is fixed
    const result = await service.getConversationTrends(7);
    
    expect(result).toHaveProperty('timeRange');
    expect(result).toHaveProperty('dailyPatterns');
    expect(result.timeRange.days).toBe(7);
    expect(Array.isArray(result.dailyPatterns)).toBe(true);
  });

  test('should execute queries without SQL parameter errors', async () => {
    // This test verifies that the main bug is fixed and queries execute successfully
    const result = await service.getConversationTrends(14);
    
    // The result should be complete without any SQL parameter errors
    expect(result).toHaveProperty('timeRange');
    expect(result).toHaveProperty('dailyPatterns');
    expect(result).toHaveProperty('hourlyDistribution');
    expect(result).toHaveProperty('engagementMetrics');
    expect(result).toHaveProperty('functionUsage');
    expect(result).toHaveProperty('insights');
    
    // Verify the timeRange is set correctly
    expect(result.timeRange.days).toBe(14);
    expect(Array.isArray(result.dailyPatterns)).toBe(true);
    expect(Array.isArray(result.hourlyDistribution)).toBe(true);
    expect(Array.isArray(result.insights)).toBe(true);
  });

  test('should handle edge case with 0 days parameter', async () => {
    const result = await service.getConversationTrends(0);
    expect(result).toHaveProperty('timeRange');
    expect(result.timeRange.days).toBe(0);
  });

  test('should handle large days parameter', async () => {
    const result = await service.getConversationTrends(365);
    expect(result).toHaveProperty('timeRange');
    expect(result.timeRange.days).toBe(365);
  });
});