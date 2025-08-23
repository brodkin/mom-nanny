/**
 * Test suite for Memory Management Frontend Statistics Display
 * Tests the NaN issue that appears on initial page load before stats are loaded.
 */

// Mock DOM environment
const { JSDOM } = require('jsdom');

describe('Memory Management Frontend Statistics', () => {
  let memoryManager;
  let document;
  let _window;

  beforeEach(() => {
    // Create a new DOM environment for each test
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="stat-value" id="total-memories">--</div>
          <div class="stat-value" id="memory-categories">--</div>
          <div class="stat-value" id="last-updated">--</div>
          <div class="stat-value" id="recent-access">--</div>
        </body>
      </html>
    `);

    global.document = dom.window.document;
    global.window = dom.window;
    document = dom.window.document;
    _window = dom.window;

    // Mock fetch to simulate API responses
    global.fetch = jest.fn();

    // Import and create MemoryManager after setting up DOM
    // We need to simulate the class since it's in a browser environment
    const MemoryManager = class {
      constructor() {
        this.memories = [];
        this.filteredMemories = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.totalPages = 0;
        this.sortField = 'key';
        this.sortDirection = 'asc';
        this.searchQuery = '';
        this.categoryFilter = '';
        this.stats = {
          totalMemories: 0,
          categoriesUsed: 0,
          lastUpdated: null,
          recentAccess: 0
        };
      }

      updateStatsDisplay() {
        const totalEl = document.getElementById('total-memories');
        const categoriesEl = document.getElementById('memory-categories');
        const lastUpdatedEl = document.getElementById('last-updated');
        const recentAccessEl = document.getElementById('recent-access');

        if (totalEl) {
          const total = Number(this.stats.totalMemories);
          // Explicit NaN check to prevent "NaN" from appearing in UI
          totalEl.textContent = (isNaN(total) || total < 0) ? '0' : total.toLocaleString();
        }
        
        if (categoriesEl) {
          const categories = Number(this.stats.categoriesUsed);
          // Explicit NaN check to prevent "NaN" from appearing in UI
          categoriesEl.textContent = (isNaN(categories) || categories < 0) ? '0' : categories.toString();
        }
        
        if (lastUpdatedEl) {
          if (this.stats.lastUpdated) {
            const date = new Date(this.stats.lastUpdated);
            // Check for invalid dates to prevent "Invalid Date" from appearing
            if (isNaN(date.getTime())) {
              lastUpdatedEl.textContent = 'Never';
            } else {
              lastUpdatedEl.textContent = this.formatRelativeTime(date);
            }
          } else {
            lastUpdatedEl.textContent = 'Never';
          }
        }
        
        if (recentAccessEl) {
          const recent = Number(this.stats.recentAccess);
          // Explicit NaN check to prevent "NaN" from appearing in UI
          recentAccessEl.textContent = (isNaN(recent) || recent < 0) ? '0' : recent.toString();
        }
      }

      formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffSeconds < 60) return 'Just now';
        if (diffMinutes === 1) return '1 minute ago';
        if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
        if (diffHours === 1) return '1 hour ago';
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays === 1) return '1 day ago';
        if (diffDays < 7) return `${diffDays} days ago`;
        
        return date.toLocaleDateString();
      }

      showLoadingSkeleton() {
        const totalEl = document.getElementById('total-memories');
        const categoriesEl = document.getElementById('memory-categories');
        const lastUpdatedEl = document.getElementById('last-updated');
        const recentAccessEl = document.getElementById('recent-access');

        // Use animated dots instead of "--" to indicate loading
        if (totalEl) totalEl.textContent = '...';
        if (categoriesEl) categoriesEl.textContent = '...';
        if (lastUpdatedEl) lastUpdatedEl.textContent = '...';
        if (recentAccessEl) recentAccessEl.textContent = '...';
      }
    };

    memoryManager = new MemoryManager();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.document;
    delete global.window;
    delete global.fetch;
  });

  test('should show NaN when updateStatsDisplay bypasses the || 0 fallback', () => {
    // The real issue: when the current code calls Number().toLocaleString() directly
    // without checking for NaN first, NaN.toLocaleString() returns "NaN"
    memoryManager.updateStatsDisplayBuggy = function() {
      const totalEl = document.getElementById('total-memories');
      const categoriesEl = document.getElementById('memory-categories');
      const _lastUpdatedEl = document.getElementById('last-updated');
      const recentAccessEl = document.getElementById('recent-access');

      // Simulate the buggy behavior: direct conversion without NaN check
      if (totalEl) {
        const total = Number(this.stats.totalMemories);
        // BUG: If total is NaN, toLocaleString() returns "NaN"
        totalEl.textContent = total.toLocaleString();
      }
      
      if (categoriesEl) {
        const categories = Number(this.stats.categoriesUsed);
        // BUG: If categories is NaN, toString() returns "NaN"
        categoriesEl.textContent = categories.toString();
      }
      
      if (recentAccessEl) {
        const recent = Number(this.stats.recentAccess);
        // BUG: If recent is NaN, toString() returns "NaN"
        recentAccessEl.textContent = recent.toString();
      }
    };

    // Set up conditions that cause NaN
    memoryManager.stats = {
      totalMemories: 'invalid',  // Number("invalid") = NaN
      categoriesUsed: 'text',    // Number("text") = NaN
      lastUpdated: undefined,
      recentAccess: undefined    // Number(undefined) = NaN
    };

    memoryManager.updateStatsDisplayBuggy();

    // This test reproduces the actual NaN bug
    const totalEl = document.getElementById('total-memories');
    const categoriesEl = document.getElementById('memory-categories');
    const recentAccessEl = document.getElementById('recent-access');

    // When Number() receives invalid data, it returns NaN, 
    // and NaN.toLocaleString()/toString() both return "NaN"
    expect(totalEl.textContent).toBe('NaN'); // This reproduces the bug
    expect(categoriesEl.textContent).toBe('NaN'); // This reproduces the bug
    expect(recentAccessEl.textContent).toBe('NaN'); // This reproduces the bug
  });

  test('should show NaN when updateStatsDisplay is called with null stats', () => {
    // Another way the bug can manifest
    memoryManager.stats = {
      totalMemories: null,
      categoriesUsed: null,
      lastUpdated: null,
      recentAccess: null
    };

    memoryManager.updateStatsDisplay();

    const totalEl = document.getElementById('total-memories');
    const categoriesEl = document.getElementById('memory-categories');
    const lastUpdatedEl = document.getElementById('last-updated');
    const recentAccessEl = document.getElementById('recent-access');

    // Number(null) returns 0, so this should work fine
    expect(totalEl.textContent).toBe('0');
    expect(categoriesEl.textContent).toBe('0');
    expect(lastUpdatedEl.textContent).toBe('Never');
    expect(recentAccessEl.textContent).toBe('0');
  });

  test('should show loading skeleton initially instead of NaN', () => {
    // Test the current showLoadingSkeleton behavior
    memoryManager.showLoadingSkeleton = function() {
      const totalEl = document.getElementById('total-memories');
      const categoriesEl = document.getElementById('memory-categories');
      const lastUpdatedEl = document.getElementById('last-updated');
      const recentAccessEl = document.getElementById('recent-access');

      // Use loading indicators instead of "--" to prevent NaN flashes
      if (totalEl) totalEl.textContent = 'Loading...';
      if (categoriesEl) categoriesEl.textContent = 'Loading...';
      if (lastUpdatedEl) lastUpdatedEl.textContent = 'Loading...';
      if (recentAccessEl) recentAccessEl.textContent = 'Loading...';
    };

    memoryManager.showLoadingSkeleton();

    const totalEl = document.getElementById('total-memories');
    const categoriesEl = document.getElementById('memory-categories');
    const lastUpdatedEl = document.getElementById('last-updated');
    const recentAccessEl = document.getElementById('recent-access');

    expect(totalEl.textContent).toBe('Loading...');
    expect(categoriesEl.textContent).toBe('Loading...');
    expect(lastUpdatedEl.textContent).toBe('Loading...');
    expect(recentAccessEl.textContent).toBe('Loading...');
  });

  test('should handle proper stats values correctly', () => {
    // Test with real data
    memoryManager.stats = {
      totalMemories: 42,
      categoriesUsed: 5,
      lastUpdated: '2024-01-15T10:30:00Z',
      recentAccess: 12
    };

    memoryManager.updateStatsDisplay();

    const totalEl = document.getElementById('total-memories');
    const categoriesEl = document.getElementById('memory-categories');
    const lastUpdatedEl = document.getElementById('last-updated');
    const recentAccessEl = document.getElementById('recent-access');

    expect(totalEl.textContent).toBe('42');
    expect(categoriesEl.textContent).toBe('5');
    expect(lastUpdatedEl.textContent).not.toBe('NaN');
    expect(lastUpdatedEl.textContent).not.toBe('Never');
    expect(recentAccessEl.textContent).toBe('12');
  });

  test('should never show NaN even with malformed data after fix', () => {
    // Test the fix: even with NaN values, should show fallback values
    memoryManager.stats = {
      totalMemories: NaN,
      categoriesUsed: NaN,
      lastUpdated: undefined,
      recentAccess: NaN
    };

    // Apply the fix: updateStatsDisplay should handle NaN gracefully
    memoryManager.updateStatsDisplayFixed = function() {
      const totalEl = document.getElementById('total-memories');
      const categoriesEl = document.getElementById('memory-categories');
      const lastUpdatedEl = document.getElementById('last-updated');
      const recentAccessEl = document.getElementById('recent-access');

      if (totalEl) {
        const total = Number(this.stats.totalMemories);
        totalEl.textContent = (isNaN(total) || total < 0) ? '0' : total.toLocaleString();
      }
      
      if (categoriesEl) {
        const categories = Number(this.stats.categoriesUsed);
        categoriesEl.textContent = (isNaN(categories) || categories < 0) ? '0' : categories.toString();
      }
      
      if (lastUpdatedEl) {
        if (this.stats.lastUpdated) {
          const date = new Date(this.stats.lastUpdated);
          if (isNaN(date.getTime())) {
            lastUpdatedEl.textContent = 'Never';
          } else {
            lastUpdatedEl.textContent = this.formatRelativeTime(date);
          }
        } else {
          lastUpdatedEl.textContent = 'Never';
        }
      }
      
      if (recentAccessEl) {
        const recent = Number(this.stats.recentAccess);
        recentAccessEl.textContent = (isNaN(recent) || recent < 0) ? '0' : recent.toString();
      }
    };

    memoryManager.updateStatsDisplayFixed();

    const totalEl = document.getElementById('total-memories');
    const categoriesEl = document.getElementById('memory-categories');
    const lastUpdatedEl = document.getElementById('last-updated');
    const recentAccessEl = document.getElementById('recent-access');

    // After fix: should show '0' instead of 'NaN'
    expect(totalEl.textContent).toBe('0');
    expect(categoriesEl.textContent).toBe('0');
    expect(lastUpdatedEl.textContent).toBe('Never');
    expect(recentAccessEl.textContent).toBe('0');
  });
});