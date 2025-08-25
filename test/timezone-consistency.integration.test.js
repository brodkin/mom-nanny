/**
 * Integration Tests for Timezone-Aware Call Counting Consistency
 * 
 * This test suite validates that all call counting methods across the system
 * produce consistent results using the same timezone-aware logic.
 * 
 * Tests the issue described in tasks.md where admin dashboard shows different
 * counts than the system prompt due to UTC vs local timezone differences.
 */

const DatabaseManager = require('../services/database-manager');
const DashboardDataService = require('../services/dashboard-data-service');
const CallStatsUtils = require('../utils/call-stats-utils');
const fs = require('fs').promises;
const path = require('path');

describe('Timezone Consistency Integration Tests', () => {
  let testDbManager;
  let testDbPath;
  let dashboardService;

  beforeAll(async () => {
    // Create a temporary test database
    testDbPath = path.join(__dirname, 'temp-test-timezone.db');
    
    // Remove existing test database if it exists
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // File doesn't exist, that's fine
    }

    // Create new database manager instance for testing
    testDbManager = new DatabaseManager(testDbPath);
    await testDbManager.waitForInitialization();
    
    // Create dashboard service
    dashboardService = new DashboardDataService(testDbManager);
    await dashboardService.initialize();
  });

  afterAll(async () => {
    // Clean up test database
    if (testDbManager) {
      testDbManager.close();
    }
    
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Clear existing data before each test
    await testDbManager.exec('DELETE FROM conversations');
    await testDbManager.exec('DELETE FROM summaries');
    await testDbManager.exec('DELETE FROM messages');
    await testDbManager.exec('DELETE FROM analytics');
    await testDbManager.exec('DELETE FROM emotional_metrics');
    await testDbManager.exec('DELETE FROM memories');
  });

  describe('Call Count Consistency Across Services', () => {
    it('should return consistent "today" call counts across all services', async () => {
      // Insert test conversations for "today" in different time formats
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Insert conversations that should be counted as "today"
      const todayConversations = [
        {
          call_sid: 'test-call-1',
          start_time: today.toISOString(),
          end_time: new Date(today.getTime() + 300000).toISOString(), // 5 minutes later
          duration: 300,
          created_at: today.toISOString()
        },
        {
          call_sid: 'test-call-2', 
          start_time: today.toISOString(),
          end_time: new Date(today.getTime() + 600000).toISOString(), // 10 minutes later
          duration: 600,
          created_at: today.toISOString()
        }
      ];

      // Insert conversations that should NOT be counted as "today"
      const yesterdayConversations = [
        {
          call_sid: 'test-call-yesterday-1',
          start_time: yesterday.toISOString(),
          end_time: new Date(yesterday.getTime() + 400000).toISOString(),
          duration: 400,
          created_at: yesterday.toISOString()
        }
      ];

      // Insert all conversations
      const allConversations = [...todayConversations, ...yesterdayConversations];
      for (const conv of allConversations) {
        await testDbManager.run(
          `INSERT INTO conversations (call_sid, start_time, end_time, duration, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [conv.call_sid, conv.start_time, conv.end_time, conv.duration, conv.created_at]
        );
      }

      // Test 1: DatabaseManager.getTodayCallStats() (used by system prompt)
      const systemPromptStats = await testDbManager.getTodayCallStats();
      
      // Test 2: CallStatsUtils.getTodayCallCount() (centralized utility)
      const utilityCount = await CallStatsUtils.getTodayCallCount(testDbManager);
      
      // Test 3: DashboardDataService._getConversationStats() (admin dashboard)
      const dashboardOverview = await dashboardService.getOverviewStats();
      
      // Test 4: Consistency validation
      const consistencyCheck = await CallStatsUtils.validateCallCountConsistency(testDbManager);

      // All methods should return the same count for "today"
      const expectedTodayCount = todayConversations.length; // Should be 2
      
      expect(systemPromptStats.callsToday).toBe(expectedTodayCount);
      expect(utilityCount).toBe(expectedTodayCount);
      expect(dashboardOverview.conversations.today).toBe(expectedTodayCount);
      expect(consistencyCheck.consistent).toBe(true);
      expect(consistencyCheck.utilityCount).toBe(systemPromptStats.callsToday);

      console.log('Timezone Consistency Test Results:', {
        systemPrompt: systemPromptStats.callsToday,
        utility: utilityCount,
        dashboard: dashboardOverview.conversations.today,
        consistent: consistencyCheck.consistent,
        timezone: CallStatsUtils.getConfiguredTimezone()
      });
    });

    it('should handle timezone transitions correctly (DST boundaries)', async () => {
      // Test with dates around DST transitions for PST/PDT
      const dstTransitionDates = [
        // Spring forward (2024) - March 10, 2024 2:00 AM becomes 3:00 AM
        new Date('2024-03-10T09:00:00.000Z'), // 1:00 AM PST (before transition)
        new Date('2024-03-10T11:00:00.000Z'), // 3:00 AM PDT (after transition)
        
        // Fall back (2024) - November 3, 2024 2:00 AM becomes 1:00 AM
        new Date('2024-11-03T08:00:00.000Z'), // 1:00 AM PDT (before transition)
        new Date('2024-11-03T10:00:00.000Z'), // 2:00 AM PST (after transition)
      ];

      for (const testDate of dstTransitionDates) {
        // Clear previous data
        await testDbManager.exec('DELETE FROM conversations');
        
        // Insert conversation on transition date
        await testDbManager.run(
          `INSERT INTO conversations (call_sid, start_time, end_time, duration, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            'dst-test-call',
            testDate.toISOString(),
            new Date(testDate.getTime() + 300000).toISOString(),
            300,
            testDate.toISOString()
          ]
        );

        // Test consistency across all methods
        const [systemStats, utilityCount, dashboardStats] = await Promise.all([
          testDbManager.getTodayCallStats(),
          CallStatsUtils.getTodayCallCount(testDbManager),
          dashboardService.getOverviewStats()
        ]);

        // Results should be consistent even across DST boundaries
        expect(utilityCount).toBe(systemStats.callsToday);
        expect(dashboardStats.conversations.today).toBe(systemStats.callsToday);

        console.log(`DST Test for ${testDate.toISOString()}:`, {
          systemPrompt: systemStats.callsToday,
          utility: utilityCount,
          dashboard: dashboardStats.conversations.today
        });
      }
    });

    it('should respect TIMEZONE environment variable consistently', async () => {
      const testTimezones = [
        'America/Los_Angeles',
        'America/New_York', 
        'Europe/London',
        'Asia/Tokyo'
      ];

      const originalTimezone = process.env.TIMEZONE;

      try {
        // Test each timezone configuration
        for (const timezone of testTimezones) {
          process.env.TIMEZONE = timezone;
          
          // Clear previous data
          await testDbManager.exec('DELETE FROM conversations');
          
          // Insert conversation
          const now = new Date();
          await testDbManager.run(
            `INSERT INTO conversations (call_sid, start_time, end_time, duration, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            ['tz-test-call', now.toISOString(), now.toISOString(), 300, now.toISOString()]
          );

          // Test all counting methods
          const [systemStats, utilityCount, dashboardStats] = await Promise.all([
            testDbManager.getTodayCallStats(),
            CallStatsUtils.getTodayCallCount(testDbManager),
            dashboardService.getOverviewStats()
          ]);

          // Verify timezone is respected
          expect(CallStatsUtils.getConfiguredTimezone()).toBe(timezone);
          
          // All methods should be consistent
          expect(utilityCount).toBe(systemStats.callsToday);
          expect(dashboardStats.conversations.today).toBe(systemStats.callsToday);

          console.log(`Timezone ${timezone} consistency:`, {
            systemPrompt: systemStats.callsToday,
            utility: utilityCount,
            dashboard: dashboardStats.conversations.today
          });
        }
      } finally {
        // Restore original timezone
        if (originalTimezone) {
          process.env.TIMEZONE = originalTimezone;
        } else {
          delete process.env.TIMEZONE;
        }
      }
    });
  });

  describe('Date Range Filtering Consistency', () => {
    it('should apply timezone-aware filtering consistently in conversation API', async () => {
      // Insert conversations spanning multiple days
      const testDates = [
        new Date('2024-01-15T10:00:00.000Z'), // Day 1
        new Date('2024-01-16T14:00:00.000Z'), // Day 2  
        new Date('2024-01-17T18:00:00.000Z'), // Day 3
      ];

      for (let i = 0; i < testDates.length; i++) {
        await testDbManager.run(
          `INSERT INTO conversations (call_sid, start_time, end_time, duration, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            `multi-day-call-${i + 1}`,
            testDates[i].toISOString(),
            new Date(testDates[i].getTime() + 300000).toISOString(),
            300,
            testDates[i].toISOString()
          ]
        );
      }

      // Test date range filtering using centralized utility
      const jan16Count = await CallStatsUtils.getCallsByDateRange(testDbManager, {
        startDate: '2024-01-16',
        endDate: '2024-01-16',
        timeField: 'start_time'
      });

      const jan15to17Count = await CallStatsUtils.getCallsByDateRange(testDbManager, {
        startDate: '2024-01-15',
        endDate: '2024-01-17', 
        timeField: 'start_time'
      });

      // Should filter correctly by local dates
      expect(jan16Count).toBe(1); // Only the Jan 16 conversation
      expect(jan15to17Count).toBe(3); // All three conversations

      console.log('Date range filtering test:', {
        singleDay: jan16Count,
        multiDay: jan15to17Count,
        timezone: CallStatsUtils.getConfiguredTimezone()
      });
    });

    it('should generate consistent SQL filters', () => {
      const testCases = [
        { 
          startDate: '2024-01-01', 
          endDate: '2024-01-31',
          expectedConditions: 2,
          expectedParams: ['2024-01-01', '2024-01-31']
        },
        {
          startDate: '2024-01-01',
          endDate: null,
          expectedConditions: 1,
          expectedParams: ['2024-01-01']
        },
        {
          startDate: null,
          endDate: '2024-01-31',
          expectedConditions: 1,
          expectedParams: ['2024-01-31']
        },
        {
          startDate: null,
          endDate: null,
          expectedConditions: 0,
          expectedParams: []
        }
      ];

      testCases.forEach((testCase, index) => {
        const filter = CallStatsUtils.buildTimezoneAwareDateFilter(
          testCase.startDate,
          testCase.endDate,
          'start_time'
        );

        expect(filter.conditions).toHaveLength(testCase.expectedConditions);
        expect(filter.params).toEqual(testCase.expectedParams);
        
        // All conditions should use timezone-aware DATE function
        filter.conditions.forEach(condition => {
          expect(condition).toContain("DATE(start_time, 'localtime')");
        });

        console.log(`Filter test case ${index + 1}:`, {
          input: testCase,
          output: filter
        });
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle database connection failures gracefully', async () => {
      // Create a closed/invalid database manager
      const invalidDbManager = new DatabaseManager(':memory:');
      invalidDbManager.close(); // Force close
      
      // All methods should return default values without throwing
      const utilityCount = await CallStatsUtils.getTodayCallCount(invalidDbManager);
      expect(utilityCount).toBe(0);
      
      const stats = await CallStatsUtils.getCallStatistics(invalidDbManager);
      expect(stats).toHaveProperty('error');
      expect(stats.today).toBe(0);
    });

    it('should validate data integrity across all methods', async () => {
      // Insert a large number of conversations to test performance and consistency
      const largeDataSet = Array.from({ length: 100 }, (_, i) => ({
        call_sid: `bulk-test-${i + 1}`,
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 300000).toISOString(),
        duration: 300,
        created_at: new Date().toISOString()
      }));

      // Insert all conversations
      for (const conv of largeDataSet) {
        await testDbManager.run(
          `INSERT INTO conversations (call_sid, start_time, end_time, duration, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [conv.call_sid, conv.start_time, conv.end_time, conv.duration, conv.created_at]
        );
      }

      // Test consistency with large dataset
      const consistencyCheck = await CallStatsUtils.validateCallCountConsistency(testDbManager);
      
      expect(consistencyCheck.consistent).toBe(true);
      expect(consistencyCheck.utilityCount).toBe(100);
      expect(consistencyCheck.existingCount).toBe(100);
      expect(consistencyCheck.difference).toBe(0);

      console.log('Large dataset consistency test:', {
        recordCount: largeDataSet.length,
        consistent: consistencyCheck.consistent,
        utilityCount: consistencyCheck.utilityCount,
        existingCount: consistencyCheck.existingCount
      });
    });
  });

  describe('Real-world Scenario Validation', () => {
    it('should resolve the admin dashboard vs system prompt discrepancy', async () => {
      // Simulate the real-world scenario described in tasks.md
      // where admin dashboard showed 9 calls but system prompt showed 16 calls
      
      const now = new Date();
      const conversations = [];
      
      // Create conversations at different times throughout "today"
      // to test edge cases around midnight boundaries
      for (let hour = 0; hour < 16; hour++) {
        const callTime = new Date(now);
        callTime.setHours(hour, 0, 0, 0);
        
        conversations.push({
          call_sid: `scenario-test-${hour}`,
          start_time: callTime.toISOString(),
          end_time: new Date(callTime.getTime() + 300000).toISOString(),
          duration: 300,
          created_at: callTime.toISOString()
        });
      }

      // Insert all conversations
      for (const conv of conversations) {
        await testDbManager.run(
          `INSERT INTO conversations (call_sid, start_time, end_time, duration, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [conv.call_sid, conv.start_time, conv.end_time, conv.duration, conv.created_at]
        );
      }

      // Test all counting methods that were previously inconsistent
      const [
        systemPromptStats,      // Used to show 16
        utilityCount,          // New centralized method
        dashboardStats         // Used to show 9
      ] = await Promise.all([
        testDbManager.getTodayCallStats(),
        CallStatsUtils.getTodayCallCount(testDbManager),
        dashboardService.getOverviewStats()
      ]);

      // All should now show the same count (16 in this test case)
      const expectedCount = conversations.length;
      
      expect(systemPromptStats.callsToday).toBe(expectedCount);
      expect(utilityCount).toBe(expectedCount);
      expect(dashboardStats.conversations.today).toBe(expectedCount);

      // Validate that the discrepancy is resolved
      const consistency = await CallStatsUtils.validateCallCountConsistency(testDbManager);
      expect(consistency.consistent).toBe(true);
      expect(consistency.difference).toBe(0);

      console.log('Real-world scenario validation:', {
        expectedCount,
        systemPromptResult: systemPromptStats.callsToday,
        utilityResult: utilityCount, 
        dashboardResult: dashboardStats.conversations.today,
        discrepancyResolved: consistency.consistent,
        timezone: CallStatsUtils.getConfiguredTimezone()
      });
    });
  });
});