const fs = require('fs').promises;
const path = require('path');

class StorageService {
  constructor() {
    this.baseDir = 'conversation-summaries';
  }
  
  async saveSummary(summary) {
    const date = new Date(summary.startTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const monthName = date.toLocaleString('en-US', { month: 'long' });
    const day = String(date.getDate()).padStart(2, '0');
    const time = date.toTimeString().slice(0, 5).replace(':', '-');
    
    // Directory structure: conversation-summaries/2024/01-January/
    const dirPath = path.join(
      this.baseDir,
      String(year),
      `${month}-${monthName}`
    );
    
    // Ensure directory exists
    await this.ensureDirectory(dirPath);
    
    // File name: 2024-01-15_14-30_call-abc123.json
    const fileName = `${year}-${month}-${day}_${time}_call-${summary.callSid}.json`;
    const filePath = path.join(dirPath, fileName);
    
    // Write with pretty formatting - atomic write to prevent corruption
    const tempFilePath = filePath + '.tmp';
    await fs.writeFile(
      tempFilePath,
      JSON.stringify(summary, null, 2),
      'utf8'
    );
    
    // Atomic rename to final location
    await fs.rename(tempFilePath, filePath);
    
    // Also update daily aggregate
    await this.updateDailyAggregate(summary, year, month, day);
    
    return filePath;
  }
  
  async ensureDirectory(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
  }
  
  async updateDailyAggregate(summary, year, month, day) {
    const aggregateFileName = `daily-aggregate-${year}-${month}-${day}.json`;
    const aggregatePath = path.join(
      this.baseDir,
      String(year),
      `${month}-${this.getMonthName(parseInt(month) - 1)}`,
      aggregateFileName
    );
    
    // Try to load existing aggregate
    let aggregate;
    try {
      await fs.access(aggregatePath);
      const data = await fs.readFile(aggregatePath, 'utf8');
      aggregate = JSON.parse(data);
    } catch (error) {
      // File doesn't exist, create new aggregate
      aggregate = {
        date: `${year}-${month}-${day}`,
        totalCalls: 0,
        totalDuration: 0,
        averageDuration: 0,
        calls: []
      };
    }
    
    // Add current summary to aggregate
    const callSummary = {
      callSid: summary.callSid,
      startTime: summary.startTime,
      endTime: summary.endTime,
      duration: summary.callMetadata ? summary.callMetadata.duration : 
        (new Date(summary.endTime).getTime() - new Date(summary.startTime).getTime()) / 1000
    };
    
    aggregate.calls.push(callSummary);
    aggregate.totalCalls = aggregate.calls.length;
    aggregate.totalDuration = aggregate.calls.reduce((sum, call) => sum + call.duration, 0);
    aggregate.averageDuration = Math.round(aggregate.totalDuration / aggregate.totalCalls);
    
    // Write updated aggregate atomically
    const tempPath = aggregatePath + '.tmp';
    await fs.writeFile(
      tempPath,
      JSON.stringify(aggregate, null, 2),
      'utf8'
    );
    await fs.rename(tempPath, aggregatePath);
  }
  
  async loadSummary(filePath) {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  }
  
  async listSummariesForDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const monthName = this.getMonthName(date.getMonth());
    
    const dirPath = path.join(
      this.baseDir,
      String(year),
      `${month}-${monthName}`
    );
    
    try {
      const files = await fs.readdir(dirPath);
      const datePrefix = `${year}-${month}-${day}`;
      
      return files
        .filter(file => file.startsWith(datePrefix) && file.endsWith('.json') && !file.includes('daily-aggregate'))
        .map(file => path.join(dirPath, file));
    } catch (error) {
      // Directory doesn't exist
      return [];
    }
  }
  
  async generateWeeklyReport(startDate) {
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    
    const year = startDate.getFullYear();
    const weekNumber = this.getWeekNumber(startDate);
    
    const reportFileName = `weekly-report-${year}-W${String(weekNumber).padStart(2, '0')}.json`;
    const reportPath = path.join(
      this.baseDir,
      String(year),
      reportFileName
    );
    
    // Collect data for each day of the week
    const weekData = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const monthName = this.getMonthName(currentDate.getMonth());
      
      const aggregateFileName = `daily-aggregate-${year}-${month}-${day}.json`;
      const aggregatePath = path.join(
        this.baseDir,
        String(year),
        `${month}-${monthName}`,
        aggregateFileName
      );
      
      try {
        const data = await fs.readFile(aggregatePath, 'utf8');
        const dailyData = JSON.parse(data);
        weekData.push(dailyData);
      } catch (error) {
        // No data for this day
        weekData.push({
          date: `${year}-${month}-${day}`,
          totalCalls: 0,
          totalDuration: 0,
          averageDuration: 0,
          calls: []
        });
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Generate weekly summary
    const weeklyReport = {
      weekStart: startDate.toISOString().split('T')[0],
      weekEnd: endDate.toISOString().split('T')[0],
      weekNumber: weekNumber,
      year: year,
      totalCalls: weekData.reduce((sum, day) => sum + day.totalCalls, 0),
      totalDuration: weekData.reduce((sum, day) => sum + day.totalDuration, 0),
      averageCallsPerDay: Math.round(weekData.reduce((sum, day) => sum + day.totalCalls, 0) / 7 * 10) / 10,
      averageDurationPerCall: 0,
      dailyBreakdown: weekData,
      generatedAt: new Date().toISOString()
    };
    
    if (weeklyReport.totalCalls > 0) {
      weeklyReport.averageDurationPerCall = Math.round(weeklyReport.totalDuration / weeklyReport.totalCalls);
    }
    
    // Ensure directory exists
    await this.ensureDirectory(path.join(this.baseDir, String(year)));
    
    // Write weekly report atomically
    const tempPath = reportPath + '.tmp';
    await fs.writeFile(
      tempPath,
      JSON.stringify(weeklyReport, null, 2),
      'utf8'
    );
    await fs.rename(tempPath, reportPath);
    
    return reportPath;
  }
  
  getMonthName(monthIndex) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex];
  }
  
  getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }
}

module.exports = StorageService;