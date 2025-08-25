/**
 * Call Statistics Utilities
 * 
 * Provides centralized, timezone-aware call counting functionality for consistent
 * statistics across the admin dashboard and conversation APIs. Ensures all call
 * counting uses the same timezone logic to prevent discrepancies.
 * 
 * Key Functions:
 * - getTodayCallCount: Get call count for today in configured timezone
 * - getCallsByDateRange: Get calls within a date range with timezone awareness
 * - buildTimezoneAwareDateFilter: Generate SQL WHERE clauses for date filtering
 */

/**
 * Get the configured timezone with fallback
 * @returns {string} IANA timezone identifier
 */
function getConfiguredTimezone() {
  return process.env.TIMEZONE || 'America/Los_Angeles';
}

/**
 * Get today's call count using timezone-aware filtering
 * @param {Object} dbManager - Database manager instance
 * @returns {Promise<number>} Number of calls today
 */
async function getTodayCallCount(dbManager) {
  if (!dbManager) {
    console.error('Error getting today call count: dbManager is null or undefined');
    return 0;
  }
  
  try {
    await dbManager.waitForInitialization();
    
    // Use consistent timezone-aware date filtering
    // This matches the logic in DatabaseManager.getTodayCallStats()
    const callCountQuery = `
      SELECT COUNT(*) as callsToday 
      FROM conversations 
      WHERE DATE(start_time, 'localtime') = DATE('now', 'localtime')
    `;
    
    const result = await dbManager.get(callCountQuery);
    return result?.callsToday || 0;
  } catch (error) {
    console.error('Error getting today call count:', error);
    return 0;
  }
}

/**
 * Get call counts for specific date range with timezone awareness
 * @param {Object} dbManager - Database manager instance
 * @param {Object} options - Query options
 * @param {string} options.startDate - Start date (YYYY-MM-DD format)
 * @param {string} options.endDate - End date (YYYY-MM-DD format)
 * @param {string} options.timeField - Database field to filter on ('start_time' or 'created_at')
 * @returns {Promise<number>} Number of calls in date range
 */
async function getCallsByDateRange(dbManager, { startDate, endDate, timeField = 'start_time' }) {
  if (!dbManager) {
    console.error('Error getting calls by date range: dbManager is null or undefined');
    return 0;
  }
  
  try {
    await dbManager.waitForInitialization();
    
    const conditions = [];
    const params = [];
    
    // Build timezone-aware date filtering conditions
    if (startDate) {
      conditions.push(`DATE(${timeField}, 'localtime') >= ?`);
      params.push(startDate);
    }
    
    if (endDate) {
      conditions.push(`DATE(${timeField}, 'localtime') <= ?`);
      params.push(endDate);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const query = `
      SELECT COUNT(*) as count 
      FROM conversations 
      ${whereClause}
    `;
    
    const result = await dbManager.get(query, params);
    return result?.count || 0;
  } catch (error) {
    console.error('Error getting calls by date range:', error);
    return 0;
  }
}

/**
 * Build timezone-aware SQL WHERE conditions for date filtering
 * @param {string} dateFrom - Start date (YYYY-MM-DD format) or null
 * @param {string} dateTo - End date (YYYY-MM-DD format) or null
 * @param {string} timeField - Database field to filter on ('start_time' or 'created_at')
 * @returns {Object} Object with conditions array and params array
 */
function buildTimezoneAwareDateFilter(dateFrom, dateTo, timeField = 'start_time') {
  const conditions = [];
  const params = [];
  
  if (dateFrom) {
    // Use timezone-aware date comparison
    conditions.push(`DATE(${timeField}, 'localtime') >= ?`);
    params.push(dateFrom);
  }
  
  if (dateTo) {
    // Use timezone-aware date comparison
    conditions.push(`DATE(${timeField}, 'localtime') <= ?`);
    params.push(dateTo);
  }
  
  return {
    conditions,
    params,
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  };
}

/**
 * Get comprehensive call statistics for a time period
 * @param {Object} dbManager - Database manager instance
 * @param {Object} options - Statistics options
 * @param {number} options.days - Number of days to analyze (default: 7)
 * @param {string} options.timeField - Database field to filter on ('start_time' or 'created_at')
 * @returns {Promise<Object>} Object with today, thisWeek, thisMonth, and total counts
 */
async function getCallStatistics(dbManager, { days = 7, timeField = 'start_time' } = {}) {
  await dbManager.waitForInitialization();
  
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    const weekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    const monthAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    
    const [todayCount, weekCount, monthCount, totalCount] = await Promise.all([
      getTodayCallCount(dbManager),
      getCallsByDateRange(dbManager, { startDate: today, timeField }),
      getCallsByDateRange(dbManager, { startDate: weekAgo, timeField }),
      getCallsByDateRange(dbManager, { startDate: monthAgo, timeField }),
    ]);
    
    // Get total count (no date filter)
    const totalQuery = 'SELECT COUNT(*) as total FROM conversations';
    const totalResult = await dbManager.get(totalQuery);
    
    return {
      today: todayCount,
      thisWeek: weekCount,
      thisMonth: monthCount,
      total: totalResult?.total || 0,
      timezone: getConfiguredTimezone(),
      generatedAt: now.toISOString()
    };
  } catch (error) {
    console.error('Error getting call statistics:', error);
    return {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      total: 0,
      timezone: getConfiguredTimezone(),
      generatedAt: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Check if two call counting methods produce consistent results
 * @param {Object} dbManager - Database manager instance
 * @returns {Promise<Object>} Comparison results with consistency status
 */
async function validateCallCountConsistency(dbManager) {
  try {
    // Compare our utility with existing getTodayCallStats()
    const [utilityResult, existingResult] = await Promise.all([
      getTodayCallCount(dbManager),
      dbManager.getTodayCallStats()
    ]);
    
    const consistent = utilityResult === existingResult.callsToday;
    
    return {
      consistent,
      utilityCount: utilityResult,
      existingCount: existingResult.callsToday,
      difference: Math.abs(utilityResult - existingResult.callsToday),
      timezone: getConfiguredTimezone(),
      validatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error validating call count consistency:', error);
    return {
      consistent: false,
      error: error.message,
      validatedAt: new Date().toISOString()
    };
  }
}

module.exports = {
  getTodayCallCount,
  getCallsByDateRange,
  buildTimezoneAwareDateFilter,
  getCallStatistics,
  validateCallCountConsistency,
  getConfiguredTimezone
};