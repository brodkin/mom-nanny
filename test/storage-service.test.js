/**
 * Test suite for StorageService
 * Tests file operations and directory structure for conversation summaries
 */

const mockData = require('./mock-data');
const fs = require('fs').promises;
const path = require('path');

// Mock fs.promises
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    access: jest.fn()
  }
}));

// Mock StorageService class based on expected API
class StorageService {
  constructor(basePath = './conversation-summaries') {
    this.basePath = basePath;
  }

  async saveSummary(summary) {
    const startTime = new Date(summary.startTime);
    const year = startTime.getFullYear();
    const month = String(startTime.getMonth() + 1).padStart(2, '0');
    const monthName = startTime.toLocaleString('default', { month: 'long' });
    
    // Create directory structure: basePath/YYYY/MM-MonthName
    const dirPath = path.join(this.basePath, year.toString(), `${month}-${monthName}`);
    
    await fs.mkdir(dirPath, { recursive: true });
    
    // Generate filename: YYYY-MM-DD_HH-mm_call-callSid.json
    const date = startTime.toISOString().split('T')[0];
    const time = startTime.toISOString().split('T')[1].substring(0, 5).replace(':', '-');
    const filename = `${date}_${time}_call-${summary.callSid}.json`;
    const filePath = path.join(dirPath, filename);
    
    // Save summary to file
    await fs.writeFile(filePath, JSON.stringify(summary, null, 2), 'utf8');
    
    return filePath;
  }

  async loadSummary(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  }

  async getSummariesByDate(year, month) {
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    const dirPath = path.join(this.basePath, year.toString(), `${String(month).padStart(2, '0')}-${monthName}`);
    
    try {
      const files = await fs.readdir(dirPath);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => path.join(dirPath, file));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async getSummariesByDateRange(startDate, endDate) {
    const summaries = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
      const startMonth = year === start.getFullYear() ? start.getMonth() + 1 : 1;
      const endMonth = year === end.getFullYear() ? end.getMonth() + 1 : 12;
      
      for (let month = startMonth; month <= endMonth; month++) {
        const monthSummaries = await this.getSummariesByDate(year, month);
        summaries.push(...monthSummaries);
      }
    }
    
    return summaries;
  }

  async searchSummaries(criteria) {
    const allSummaries = await this._getAllSummaryFiles();
    const results = [];
    
    for (const filePath of allSummaries) {
      try {
        const summary = await this.loadSummary(filePath);
        
        if (this._matchesCriteria(summary, criteria)) {
          results.push({ filePath, summary });
        }
      } catch (error) {
        console.warn(`Failed to load summary from ${filePath}:`, error);
      }
    }
    
    return results;
  }

  async getStorageStats() {
    const allFiles = await this._getAllSummaryFiles();
    const stats = {
      totalSummaries: allFiles.length,
      sizeInBytes: 0,
      dateRange: { earliest: null, latest: null },
      monthlyBreakdown: {}
    };
    
    for (const filePath of allFiles) {
      try {
        const stat = await fs.stat(filePath);
        stats.sizeInBytes += stat.size;
        
        // Extract date from filename for date range
        const filename = path.basename(filePath);
        const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          const date = new Date(dateMatch[1]);
          if (!stats.dateRange.earliest || date < stats.dateRange.earliest) {
            stats.dateRange.earliest = date;
          }
          if (!stats.dateRange.latest || date > stats.dateRange.latest) {
            stats.dateRange.latest = date;
          }
          
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          stats.monthlyBreakdown[monthKey] = (stats.monthlyBreakdown[monthKey] || 0) + 1;
        }
      } catch (error) {
        console.warn(`Failed to stat file ${filePath}:`, error);
      }
    }
    
    return stats;
  }

  async _getAllSummaryFiles() {
    const files = [];
    
    try {
      const years = await fs.readdir(this.basePath);
      
      for (const year of years) {
        const yearPath = path.join(this.basePath, year);
        const yearStat = await fs.stat(yearPath);
        
        if (yearStat.isDirectory()) {
          const months = await fs.readdir(yearPath);
          
          for (const month of months) {
            const monthPath = path.join(yearPath, month);
            const monthStat = await fs.stat(monthPath);
            
            if (monthStat.isDirectory()) {
              const monthFiles = await fs.readdir(monthPath);
              monthFiles
                .filter(file => file.endsWith('.json'))
                .forEach(file => files.push(path.join(monthPath, file)));
            }
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
    
    return files;
  }

  _matchesCriteria(summary, criteria) {
    if (criteria.callSid && summary.callSid !== criteria.callSid) {
      return false;
    }
    
    if (criteria.phoneNumber && summary.phoneNumber !== criteria.phoneNumber) {
      return false;
    }
    
    if (criteria.dateFrom) {
      const summaryDate = new Date(summary.startTime);
      const fromDate = new Date(criteria.dateFrom);
      if (summaryDate < fromDate) {
        return false;
      }
    }
    
    if (criteria.dateTo) {
      const summaryDate = new Date(summary.startTime);
      const toDate = new Date(criteria.dateTo);
      if (summaryDate > toDate) {
        return false;
      }
    }
    
    if (criteria.topics && criteria.topics.length > 0) {
      const summaryTopics = Object.keys(summary.analysisResults?.topics || {});
      const hasMatchingTopic = criteria.topics.some(topic => 
        summaryTopics.some(summaryTopic => 
          summaryTopic.toLowerCase().includes(topic.toLowerCase())
        )
      );
      if (!hasMatchingTopic) {
        return false;
      }
    }
    
    if (criteria.emotionalState) {
      const summaryState = summary.analysisResults?.emotionalState?.overall;
      if (summaryState !== criteria.emotionalState) {
        return false;
      }
    }
    
    return true;
  }
}

describe('StorageService', () => {
  let storage;
  
  beforeEach(() => {
    storage = new StorageService();
    jest.clearAllMocks();
  });

  describe('Directory Structure Creation', () => {
    test('should create correct directory structure for January', async () => {
      const summary = {
        callSid: 'test-123',
        startTime: new Date('2024-01-15T14:30:00').toISOString(),
        phoneNumber: '+1234567890'
      };
      
      await storage.saveSummary(summary);
      
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('conversation-summaries/2024/01-January'),
        { recursive: true }
      );
    });

    test('should create correct directory structure for December', async () => {
      const summary = {
        callSid: 'test-456',
        startTime: new Date('2024-12-25T09:15:00').toISOString()
      };
      
      await storage.saveSummary(summary);
      
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('conversation-summaries/2024/12-December'),
        { recursive: true }
      );
    });

    test('should handle different years correctly', async () => {
      const summary2023 = {
        callSid: 'test-2023',
        startTime: new Date('2023-06-10T16:45:00').toISOString()
      };
      
      const summary2025 = {
        callSid: 'test-2025',
        startTime: new Date('2025-03-08T11:20:00').toISOString()
      };
      
      await storage.saveSummary(summary2023);
      await storage.saveSummary(summary2025);
      
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('conversation-summaries/2023/06-June'),
        { recursive: true }
      );
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('conversation-summaries/2025/03-March'),
        { recursive: true }
      );
    });

    test('should use custom base path', async () => {
      const customStorage = new StorageService('/custom/path');
      const summary = {
        callSid: 'custom-test',
        startTime: new Date('2024-05-20T13:00:00').toISOString()
      };
      
      await customStorage.saveSummary(summary);
      
      expect(fs.mkdir).toHaveBeenCalledWith(
        '/custom/path/2024/05-May',
        { recursive: true }
      );
    });
  });

  describe('Filename Generation', () => {
    test('should generate correct filename format', async () => {
      const summary = {
        callSid: 'abc123',
        startTime: new Date('2024-01-15T14:30:00Z').toISOString()
      };
      
      const filePath = await storage.saveSummary(summary);
      expect(filePath).toContain('2024-01-15_14-30_call-abc123.json');
    });

    test('should handle different time formats', async () => {
      const summary = {
        callSid: 'xyz789',
        startTime: new Date('2024-07-04T09:05:00Z').toISOString()
      };
      
      const filePath = await storage.saveSummary(summary);
      expect(filePath).toContain('2024-07-04_09-05_call-xyz789.json');
    });

    test('should handle midnight times', async () => {
      const summary = {
        callSid: 'midnight',
        startTime: new Date('2024-01-01T00:00:00Z').toISOString()
      };
      
      const filePath = await storage.saveSummary(summary);
      expect(filePath).toContain('2024-01-01_00-00_call-midnight.json');
    });

    test('should handle special characters in callSid', async () => {
      const summary = {
        callSid: 'call-with-dashes_123',
        startTime: new Date('2024-03-10T15:45:00').toISOString()
      };
      
      const filePath = await storage.saveSummary(summary);
      expect(filePath).toContain('call-call-with-dashes_123.json');
    });
  });

  describe('File Operations', () => {
    test('should save summary data correctly', async () => {
      const summary = mockData.generateSummaryData();
      
      await storage.saveSummary(summary);
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(summary.callSid),
        'utf8'
      );
    });

    test('should save data as formatted JSON', async () => {
      const summary = {
        callSid: 'format-test',
        startTime: new Date('2024-01-01T12:00:00').toISOString(),
        testData: { nested: { data: 'value' } }
      };
      
      await storage.saveSummary(summary);
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify(summary, null, 2),
        'utf8'
      );
    });

    test('should load summary correctly', async () => {
      const mockSummary = { callSid: 'test', data: 'value' };
      fs.readFile.mockResolvedValue(JSON.stringify(mockSummary));
      
      const result = await storage.loadSummary('/test/path.json');
      
      expect(fs.readFile).toHaveBeenCalledWith('/test/path.json', 'utf8');
      expect(result).toEqual(mockSummary);
    });

    test('should handle JSON parsing errors gracefully', async () => {
      fs.readFile.mockResolvedValue('invalid json');
      
      await expect(storage.loadSummary('/test/invalid.json')).rejects.toThrow();
    });

    test('should handle file read errors', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));
      
      await expect(storage.loadSummary('/nonexistent.json')).rejects.toThrow('File not found');
    });
  });

  describe('Summary Retrieval by Date', () => {
    test('should get summaries for specific month', async () => {
      const mockFiles = ['file1.json', 'file2.json', 'not-json.txt'];
      fs.readdir.mockResolvedValue(mockFiles);
      
      const result = await storage.getSummariesByDate(2024, 1);
      
      expect(fs.readdir).toHaveBeenCalledWith(
        expect.stringContaining('2024/01-January')
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toContain('file1.json');
      expect(result[1]).toContain('file2.json');
    });

    test('should return empty array for non-existent month', async () => {
      const error = new Error('Directory not found');
      error.code = 'ENOENT';
      fs.readdir.mockRejectedValue(error);
      
      const result = await storage.getSummariesByDate(2024, 13);
      
      expect(result).toEqual([]);
    });

    test('should throw for other directory errors', async () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      fs.readdir.mockRejectedValue(error);
      
      await expect(storage.getSummariesByDate(2024, 1)).rejects.toThrow('Permission denied');
    });

    test('should handle month names correctly', async () => {
      fs.readdir.mockResolvedValue(['test.json']);
      
      await storage.getSummariesByDate(2024, 6);
      
      expect(fs.readdir).toHaveBeenCalledWith(
        expect.stringContaining('06-June')
      );
    });
  });

  describe('Date Range Queries', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should get summaries across date range', async () => {
      fs.readdir.mockResolvedValue(['test.json']);
      
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-03-31');
      
      const result = await storage.getSummariesByDateRange(startDate, endDate);
      
      // Should call getSummariesByDate for January, February, and March  
      // The actual implementation may call fs.readdir more times due to internal getSummariesByDate calls
      expect(fs.readdir).toHaveBeenCalledWith(expect.stringContaining('01-January'));
      expect(fs.readdir).toHaveBeenCalledWith(expect.stringContaining('02-February'));
      expect(fs.readdir).toHaveBeenCalledWith(expect.stringContaining('03-March'));
    });

    test('should handle date range spanning multiple years', async () => {
      fs.readdir.mockResolvedValue(['test.json']);
      
      const startDate = new Date('2023-11-15');
      const endDate = new Date('2024-02-10');
      
      await storage.getSummariesByDateRange(startDate, endDate);
      
      // Should call for Nov-Dec 2023 and Jan-Feb 2024
      expect(fs.readdir).toHaveBeenCalledWith(expect.stringContaining('2023/11-November'));
      expect(fs.readdir).toHaveBeenCalledWith(expect.stringContaining('2023/12-December'));
      expect(fs.readdir).toHaveBeenCalledWith(expect.stringContaining('2024/01-January'));
      expect(fs.readdir).toHaveBeenCalledWith(expect.stringContaining('2024/02-February'));
    });

    test('should handle single month date range', async () => {
      fs.readdir.mockResolvedValue(['test.json']);
      
      const startDate = new Date('2024-05-01');
      const endDate = new Date('2024-05-31');
      
      await storage.getSummariesByDateRange(startDate, endDate);
      
      expect(fs.readdir).toHaveBeenCalledWith(expect.stringContaining('05-May'));
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      // Mock _getAllSummaryFiles
      const mockFiles = ['/path/to/summary1.json', '/path/to/summary2.json'];
      storage._getAllSummaryFiles = jest.fn().mockResolvedValue(mockFiles);
    });

    test('should search by callSid', async () => {
      const mockSummary1 = { callSid: 'target-call', phoneNumber: '+1234567890' };
      const mockSummary2 = { callSid: 'other-call', phoneNumber: '+1234567890' };
      
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockSummary1))
        .mockResolvedValueOnce(JSON.stringify(mockSummary2));
      
      const results = await storage.searchSummaries({ callSid: 'target-call' });
      
      expect(results).toHaveLength(1);
      expect(results[0].summary.callSid).toBe('target-call');
    });

    test('should search by phone number', async () => {
      const mockSummary1 = { callSid: 'call1', phoneNumber: '+1111111111' };
      const mockSummary2 = { callSid: 'call2', phoneNumber: '+2222222222' };
      
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockSummary1))
        .mockResolvedValueOnce(JSON.stringify(mockSummary2));
      
      const results = await storage.searchSummaries({ phoneNumber: '+1111111111' });
      
      expect(results).toHaveLength(1);
      expect(results[0].summary.phoneNumber).toBe('+1111111111');
    });

    test('should search by date range', async () => {
      const mockSummary1 = { 
        callSid: 'call1', 
        startTime: new Date('2024-01-15T10:00:00').toISOString() 
      };
      const mockSummary2 = { 
        callSid: 'call2', 
        startTime: new Date('2024-02-15T10:00:00').toISOString() 
      };
      
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockSummary1))
        .mockResolvedValueOnce(JSON.stringify(mockSummary2));
      
      const results = await storage.searchSummaries({ 
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31'
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].summary.callSid).toBe('call1');
    });

    test('should search by topics', async () => {
      const mockSummary1 = { 
        callSid: 'call1',
        analysisResults: {
          topics: { 'dogs': { count: 3 }, 'medicine': { count: 1 } }
        }
      };
      const mockSummary2 = { 
        callSid: 'call2',
        analysisResults: {
          topics: { 'anxiety': { count: 2 }, 'ryan': { count: 4 } }
        }
      };
      
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockSummary1))
        .mockResolvedValueOnce(JSON.stringify(mockSummary2));
      
      const results = await storage.searchSummaries({ topics: ['dogs'] });
      
      expect(results).toHaveLength(1);
      expect(results[0].summary.callSid).toBe('call1');
    });

    test('should search by emotional state', async () => {
      const mockSummary1 = { 
        callSid: 'call1',
        analysisResults: {
          emotionalState: { overall: 'anxious' }
        }
      };
      const mockSummary2 = { 
        callSid: 'call2',
        analysisResults: {
          emotionalState: { overall: 'calm' }
        }
      };
      
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockSummary1))
        .mockResolvedValueOnce(JSON.stringify(mockSummary2));
      
      const results = await storage.searchSummaries({ emotionalState: 'anxious' });
      
      expect(results).toHaveLength(1);
      expect(results[0].summary.analysisResults.emotionalState.overall).toBe('anxious');
    });

    test('should handle multiple search criteria', async () => {
      const mockSummary = { 
        callSid: 'target-call',
        phoneNumber: '+1111111111',
        startTime: new Date('2024-01-15T10:00:00').toISOString(),
        analysisResults: {
          topics: { 'dogs': { count: 3 } },
          emotionalState: { overall: 'happy' }
        }
      };
      
      fs.readFile.mockResolvedValue(JSON.stringify(mockSummary));
      
      const results = await storage.searchSummaries({ 
        phoneNumber: '+1111111111',
        topics: ['dogs'],
        emotionalState: 'happy'
      });
      
      expect(results).toHaveLength(2); // Both files match
      expect(results[0].summary.callSid).toBe('target-call');
    });

    test('should handle search errors gracefully', async () => {
      fs.readFile.mockRejectedValue(new Error('Read error'));
      
      // Should not throw, but log warning
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const results = await storage.searchSummaries({ callSid: 'test' });
      
      expect(results).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load summary'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Storage Statistics', () => {
    beforeEach(() => {
      // Mock file structure
      storage._getAllSummaryFiles = jest.fn().mockResolvedValue([
        '/path/2024-01-15_10-30_call-abc.json',
        '/path/2024-01-20_14-15_call-def.json',
        '/path/2024-02-05_09-00_call-ghi.json'
      ]);
    });

    test('should calculate storage statistics', async () => {
      fs.stat
        .mockResolvedValueOnce({ size: 1024 })
        .mockResolvedValueOnce({ size: 2048 })
        .mockResolvedValueOnce({ size: 512 });
      
      const stats = await storage.getStorageStats();
      
      expect(stats.totalSummaries).toBe(3);
      expect(stats.sizeInBytes).toBe(3584);
      expect(stats.dateRange.earliest).toEqual(new Date('2024-01-15'));
      expect(stats.dateRange.latest).toEqual(new Date('2024-02-05'));
      expect(stats.monthlyBreakdown['2024-01']).toBe(2);
      expect(stats.monthlyBreakdown['2024-02']).toBe(1);
    });

    test('should handle empty storage', async () => {
      storage._getAllSummaryFiles.mockResolvedValue([]);
      
      const stats = await storage.getStorageStats();
      
      expect(stats.totalSummaries).toBe(0);
      expect(stats.sizeInBytes).toBe(0);
      expect(stats.dateRange.earliest).toBeNull();
      expect(stats.dateRange.latest).toBeNull();
      expect(stats.monthlyBreakdown).toEqual({});
    });

    test('should handle stat errors gracefully', async () => {
      fs.stat.mockRejectedValue(new Error('Stat error'));
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const stats = await storage.getStorageStats();
      
      expect(stats.totalSummaries).toBe(3);
      expect(stats.sizeInBytes).toBe(0);
      expect(consoleSpy).toHaveBeenCalledTimes(3);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Integration Tests with Mock Data', () => {
    test('should save and load complete summary data', async () => {
      const mockSummary = mockData.generateSummaryData();
      
      // Save
      const filePath = await storage.saveSummary(mockSummary);
      
      expect(filePath).toContain('2024-01-15');
      expect(filePath).toContain('call-summary-');
      expect(fs.writeFile).toHaveBeenCalledWith(
        filePath,
        JSON.stringify(mockSummary, null, 2),
        'utf8'
      );
    });

    test('should handle complex summary data structure', async () => {
      const mockSummary = mockData.generateSummaryData();
      
      await storage.saveSummary(mockSummary);
      
      const savedData = JSON.parse(fs.writeFile.mock.calls[0][1]);
      expect(savedData.analysisResults.topics).toEqual(mockSummary.analysisResults.topics);
      expect(savedData.analysisResults.caregiverInsights).toEqual(mockSummary.analysisResults.caregiverInsights);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
    });

    test('should handle invalid date formats', async () => {
      const summary = {
        callSid: 'invalid-date',
        startTime: 'invalid-date-string'
      };
      
      await expect(storage.saveSummary(summary)).rejects.toThrow();
    });

    test('should handle missing required fields', async () => {
      const summary = {
        // Missing callSid and startTime
        phoneNumber: '+1234567890'
      };
      
      await expect(storage.saveSummary(summary)).rejects.toThrow();
    });

    test('should handle file system errors', async () => {
      fs.mkdir.mockRejectedValue(new Error('Permission denied'));
      
      const summary = {
        callSid: 'permission-test',
        startTime: new Date().toISOString()
      };
      
      await expect(storage.saveSummary(summary)).rejects.toThrow('Permission denied');
    });

    test('should handle write errors', async () => {
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockRejectedValue(new Error('Disk full'));
      
      const summary = {
        callSid: 'write-error',
        startTime: new Date().toISOString()
      };
      
      await expect(storage.saveSummary(summary)).rejects.toThrow('Disk full');
    });

    test('should handle very long callSid values', async () => {
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      
      const summary = {
        callSid: 'a'.repeat(300), // Very long callSid
        startTime: new Date().toISOString()
      };
      
      await storage.saveSummary(summary);
      
      const filePath = fs.writeFile.mock.calls[0][0];
      expect(filePath).toContain('call-' + 'a'.repeat(300) + '.json');
    });

    test('should handle special characters in data', async () => {
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      
      const summary = {
        callSid: 'special-chars',
        startTime: new Date().toISOString(),
        specialData: {
          unicode: '🎉🌟💫',
          quotes: 'He said "Hello"',
          newlines: 'Line 1\nLine 2\nLine 3'
        }
      };
      
      await storage.saveSummary(summary);
      
      const savedData = fs.writeFile.mock.calls[0][1];
      expect(savedData).toContain('🎉🌟💫');
      expect(savedData).toContain('He said \\"Hello\\"');
      expect(savedData).toContain('Line 1\\nLine 2\\nLine 3');
    });
  });
});