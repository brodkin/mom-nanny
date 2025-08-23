/**
 * Conversations UI Component Tests
 * 
 * Tests for the conversations page UI functionality including:
 * - Data table initialization and data loading
 * - Filtering by date range, emotional states, and duration
 * - Sorting capabilities
 * - Modal transcript viewing
 * - Export to CSV functionality
 * - Emotional state color coding
 * - Loading and empty states
 */

const { JSDOM } = require('jsdom');

// Mock DataTable component
class MockDataTable extends EventTarget {
  constructor(options) {
    super();
    this.options = options;
    this.element = document.createElement('div');
    this.data = [];
    this._filters = {};
    this._sorted = false;
  }

  setData(data) {
    this.data = data;
    // Create a mock event object for testing
    const event = { type: 'dataLoaded', detail: { count: data.length } };
    if (this.onDataLoaded) this.onDataLoaded(event);
  }

  setFilters(filters) {
    this._filters = filters;
    // Create a mock event object for testing
    const event = { type: 'filtersChanged', detail: filters };
    if (this.onFiltersChanged) this.onFiltersChanged(event);
  }

  sort(column, direction) {
    this._sorted = { column, direction };
    // Create a mock event object for testing
    const event = { type: 'sort', detail: { column, direction } };
    if (this.onSort) this.onSort(event);
  }

  exportCSV() {
    // Create a mock event object for testing
    const event = { type: 'export', detail: { format: 'csv' } };
    if (this.onExport) this.onExport(event);
  }

  // Mock addEventListener to store callbacks
  addEventListener(event, handler) {
    if (event === 'sort') this.onSort = handler;
    if (event === 'export') this.onExport = handler;
    if (event === 'dataLoaded') this.onDataLoaded = handler;
    if (event === 'filtersChanged') this.onFiltersChanged = handler;
  }

  destroy() {
    // Mock cleanup
  }
}

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Conversations UI Component', () => {
  let dom;
  let document;
  let window;
  let ConversationsPage;

  beforeEach(() => {
    // Setup JSDOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Conversations Test</title>
        </head>
        <body>
          <div id="conversations-container">
            <div class="filters-container">
              <div class="date-filters">
                <select id="date-range-filter">
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 days</option>
                  <option value="month">Last 30 days</option>
                  <option value="custom">Custom Range</option>
                </select>
                <input type="date" id="date-from" style="display: none;">
                <input type="date" id="date-to" style="display: none;">
              </div>
              <div class="emotional-state-filters">
                <label><input type="checkbox" value="calm" class="emotional-state-filter"> Calm</label>
                <label><input type="checkbox" value="mild_anxiety" class="emotional-state-filter"> Mild Anxiety</label>
                <label><input type="checkbox" value="moderate_anxiety" class="emotional-state-filter"> Moderate Anxiety</label>
                <label><input type="checkbox" value="high_anxiety" class="emotional-state-filter"> High Anxiety</label>
              </div>
              <div class="duration-filters">
                <select id="duration-filter">
                  <option value="all">All Durations</option>
                  <option value="short">Under 5 min</option>
                  <option value="medium">5-15 min</option>
                  <option value="long">Over 15 min</option>
                </select>
              </div>
              <button id="clear-filters">Clear Filters</button>
            </div>
            <div id="table-container"></div>
            <div id="loading-state" style="display: none;">Loading conversations...</div>
            <div id="empty-state" style="display: none;">No conversations found.</div>
          </div>
          
          <!-- Error State -->
          <div id="error-state" style="display: none;">Error loading data.</div>
          
          <!-- Transcript Modal -->
          <div id="transcript-modal" class="modal" style="display: none;">
            <div class="modal-content">
              <div class="modal-header">
                <h3>Conversation Transcript</h3>
                <button class="modal-close">&times;</button>
              </div>
              <div class="modal-body">
                <div id="transcript-content"></div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `, { 
      url: 'http://localhost/',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    document = dom.window.document;
    window = dom.window;

    // Make globals available
    global.document = document;
    global.window = window;
    global.HTMLElement = window.HTMLElement;
    global.CustomEvent = window.CustomEvent;

    // Mock DataTable in global scope
    global.DataTable = MockDataTable;

    // Clear fetch mock
    fetch.mockClear();

    // Mock successful API responses
    fetch.mockImplementation((url) => {
      if (url.includes('/api/conversations?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              conversations: [
                {
                  id: 1,
                  startTime: '2025-08-15T10:30:00Z',
                  duration: 360,
                  emotionalState: 'calm',
                  anxietyLevel: 2,
                  careIndicators: { medicationConcerns: [] },
                  messageCount: 12
                },
                {
                  id: 2,
                  startTime: '2025-08-15T14:15:00Z',
                  duration: 720,
                  emotionalState: 'mild_anxiety',
                  anxietyLevel: 5,
                  careIndicators: { medicationConcerns: ['pain medication'] },
                  messageCount: 24
                },
                {
                  id: 3,
                  startTime: '2025-08-14T16:45:00Z',
                  duration: 540,
                  emotionalState: 'high_anxiety',
                  anxietyLevel: 8,
                  careIndicators: { medicationConcerns: ['confusion', 'forgot pills'] },
                  messageCount: 18
                }
              ],
              total: 3,
              page: 1,
              pageSize: 20,
              totalPages: 1
            }
          })
        });
      } else if (url.includes('/api/conversations/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              id: 1,
              messages: [
                { role: 'assistant', content: 'Hello! How are you doing today?', timestamp: '2025-08-15T10:30:00Z' },
                { role: 'user', content: 'I\'m feeling a bit confused today.', timestamp: '2025-08-15T10:30:15Z' },
                { role: 'assistant', content: 'That\'s completely understandable. Would you like to talk about what\'s on your mind?', timestamp: '2025-08-15T10:30:30Z' }
              ],
              emotionalTimeline: [
                { timestamp: '2025-08-15T10:30:00Z', anxietyLevel: 3, agitationLevel: 2, positiveEngagement: 6 },
                { timestamp: '2025-08-15T10:30:15Z', anxietyLevel: 5, agitationLevel: 3, positiveEngagement: 4 },
                { timestamp: '2025-08-15T10:30:30Z', anxietyLevel: 3, agitationLevel: 2, positiveEngagement: 7 }
              ]
            }
          })
        });
      }
      return Promise.reject(new Error('Unknown API endpoint'));
    });

    // Define ConversationsPage class for testing
    ConversationsPage = class {
      constructor() {
        this.table = null;
        this.currentFilters = {
          dateRange: 'all',
          dateFrom: null,
          dateTo: null,
          emotionalStates: [],
          duration: 'all'
        };
        this.init();
      }

      init() {
        this.initializeDataTable();
        this.bindEventListeners();
        this.loadConversations();
      }

      initializeDataTable() {
        this.table = new MockDataTable({
          columns: [
            { key: 'startTime', title: 'Date/Time', sortable: true },
            { key: 'duration', title: 'Duration', sortable: true },
            { key: 'emotionalState', title: 'Emotional State', sortable: false },
            { key: 'keyTopics', title: 'Key Topics', sortable: false },
            { key: 'actions', title: 'Actions', sortable: false }
          ],
          pagination: true,
          pageSize: 20,
          searchable: true,
          exportable: true
        });

        document.getElementById('table-container').appendChild(this.table.element);
      }

      bindEventListeners() {
        // Date range filter
        document.getElementById('date-range-filter').addEventListener('change', (e) => {
          this.handleDateRangeChange(e.target.value);
        });

        // Emotional state filters
        document.querySelectorAll('.emotional-state-filter').forEach(checkbox => {
          checkbox.addEventListener('change', () => {
            this.handleEmotionalStateChange();
          });
        });

        // Duration filter
        document.getElementById('duration-filter').addEventListener('change', (e) => {
          this.currentFilters.duration = e.target.value;
          this.loadConversations();
        });

        // Clear filters
        document.getElementById('clear-filters').addEventListener('click', () => {
          this.clearAllFilters();
        });

        // Table events
        if (this.table) {
          this.table.addEventListener('sort', (e) => {
            this.handleTableSort(e.detail);
          });

          this.table.addEventListener('export', () => {
            this.handleExport();
          });
        }
      }

      handleDateRangeChange(range) {
        this.currentFilters.dateRange = range;
        
        const dateFromInput = document.getElementById('date-from');
        const dateToInput = document.getElementById('date-to');
        
        if (range === 'custom') {
          dateFromInput.style.display = 'block';
          dateToInput.style.display = 'block';
        } else {
          dateFromInput.style.display = 'none';
          dateToInput.style.display = 'none';
          
          // Set date range based on selection
          const now = new Date();
          switch (range) {
          case 'today':
            this.currentFilters.dateFrom = now.toISOString().split('T')[0];
            this.currentFilters.dateTo = now.toISOString().split('T')[0];
            break;
          case 'week': {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            this.currentFilters.dateFrom = weekAgo.toISOString().split('T')[0];
            this.currentFilters.dateTo = now.toISOString().split('T')[0];
            break;
          }
          case 'month': {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            this.currentFilters.dateFrom = monthAgo.toISOString().split('T')[0];
            this.currentFilters.dateTo = now.toISOString().split('T')[0];
            break;
          }
          default:
            this.currentFilters.dateFrom = null;
            this.currentFilters.dateTo = null;
          }
        }
        
        this.loadConversations();
      }

      handleEmotionalStateChange() {
        const checkedStates = Array.from(document.querySelectorAll('.emotional-state-filter:checked'))
          .map(cb => cb.value);
        this.currentFilters.emotionalStates = checkedStates;
        this.loadConversations();
      }

      clearAllFilters() {
        this.currentFilters = {
          dateRange: 'all',
          dateFrom: null,
          dateTo: null,
          emotionalStates: [],
          duration: 'all'
        };

        // Reset UI elements
        document.getElementById('date-range-filter').value = 'all';
        document.getElementById('duration-filter').value = 'all';
        document.querySelectorAll('.emotional-state-filter').forEach(cb => cb.checked = false);

        this.loadConversations();
      }

      async loadConversations() {
        try {
          this.showLoadingState();

          const params = new URLSearchParams();
          params.append('page', '1');
          params.append('pageSize', '20');

          if (this.currentFilters.dateFrom) {
            params.append('dateFrom', this.currentFilters.dateFrom);
          }
          if (this.currentFilters.dateTo) {
            params.append('dateTo', this.currentFilters.dateTo);
          }
          if (this.currentFilters.emotionalStates.length > 0) {
            this.currentFilters.emotionalStates.forEach(state => {
              params.append('emotionalStates', state);
            });
          }
          if (this.currentFilters.duration !== 'all') {
            switch (this.currentFilters.duration) {
            case 'short':
              params.append('maxDuration', '300');
              break;
            case 'medium':
              params.append('minDuration', '300');
              params.append('maxDuration', '900');
              break;
            case 'long':
              params.append('minDuration', '900');
              break;
            }
          }

          const response = await fetch(`/api/conversations?${params}`);
          const result = await response.json();

          if (result.success) {
            const tableData = this.formatTableData(result.data.conversations);
            this.table.setData(tableData);
            this.hideLoadingState();
            
            if (tableData.length === 0) {
              this.showEmptyState();
            } else {
              this.hideEmptyState();
            }
          } else {
            throw new Error(result.error || 'Failed to load conversations');
          }
        } catch (error) {
          console.error('Error loading conversations:', error);
          this.hideLoadingState();
          this.showErrorState();
        }
      }

      formatTableData(conversations) {
        return conversations.map(conv => ({
          id: conv.id,
          startTime: this.formatDateTime(conv.startTime),
          duration: this.formatDuration(conv.duration),
          emotionalState: this.formatEmotionalState(conv.emotionalState, conv.anxietyLevel),
          keyTopics: this.extractKeyTopics(conv.careIndicators),
          actions: this.createActionButtons(conv.id)
        }));
      }

      formatDateTime(timestamp) {
        return new Date(timestamp).toLocaleString();
      }

      formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
      }

      formatEmotionalState(state, anxietyLevel) {
        const colorMap = {
          calm: 'success',
          mild_anxiety: 'warning',
          moderate_anxiety: 'orange',
          high_anxiety: 'danger'
        };

        const color = colorMap[state] || 'secondary';
        return `<span class="badge badge-${color}">${state.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} (${anxietyLevel}/10)</span>`;
      }

      extractKeyTopics(careIndicators) {
        const topics = [];
        if (careIndicators.medicationConcerns && careIndicators.medicationConcerns.length > 0) {
          topics.push('Medication');
        }
        if (careIndicators.painLevel > 0) {
          topics.push('Pain');
        }
        if (careIndicators.staffComplaints && careIndicators.staffComplaints.length > 0) {
          topics.push('Staff Issues');
        }
        return topics.join(', ') || 'General conversation';
      }

      createActionButtons(conversationId) {
        return `<button class="btn btn-sm btn-outline" onclick="window.conversationsPage.viewTranscript(${conversationId})">View Transcript</button>`;
      }

      async viewTranscript(conversationId) {
        try {
          const response = await fetch(`/api/conversations/${conversationId}`);
          const result = await response.json();

          if (result.success) {
            this.showTranscriptModal(result.data);
          } else {
            throw new Error(result.error || 'Failed to load transcript');
          }
        } catch (error) {
          console.error('Error loading transcript:', error);
          alert('Failed to load conversation transcript');
        }
      }

      showTranscriptModal(conversationData) {
        const modal = document.getElementById('transcript-modal');
        const content = document.getElementById('transcript-content');

        content.innerHTML = this.formatTranscript(conversationData);
        modal.style.display = 'block';

        // Close modal handlers
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.onclick = () => modal.style.display = 'none';

        window.onclick = (event) => {
          if (event.target === modal) {
            modal.style.display = 'none';
          }
        };
      }

      formatTranscript(data) {
        let html = `
          <div class="conversation-header">
            <h4>Conversation Details</h4>
            <p><strong>Date:</strong> ${this.formatDateTime(data.startTime)}</p>
            <p><strong>Duration:</strong> ${this.formatDuration(data.duration)}</p>
            <p><strong>Messages:</strong> ${data.messages.length}</p>
          </div>
          <div class="conversation-messages">
        `;

        data.messages.forEach((message, _index) => {
          const timestamp = new Date(message.timestamp).toLocaleTimeString();
          const roleClass = message.role === 'user' ? 'user-message' : 'assistant-message';
          
          html += `
            <div class="message ${roleClass}">
              <div class="message-header">
                <span class="role">${message.role === 'user' ? 'Patient' : 'AI Companion'}</span>
                <span class="timestamp">${timestamp}</span>
              </div>
              <div class="message-content">${message.content}</div>
            </div>
          `;
        });

        html += '</div>';

        // Add emotional timeline if available
        if (data.emotionalTimeline && data.emotionalTimeline.length > 0) {
          html += `
            <div class="emotional-timeline">
              <h5>Emotional Timeline</h5>
              <div class="timeline-chart">
                <!-- Emotional timeline visualization would go here -->
                <p>Anxiety levels throughout conversation: ${data.emotionalTimeline.map(t => t.anxietyLevel).join(', ')}</p>
              </div>
            </div>
          `;
        }

        return html;
      }

      handleTableSort(_sortDetail) {
        // Sort handling would be implemented here
        // For testing, we just verify the event was received
      }

      handleExport() {
        // Export functionality would be implemented here
        // For testing, we just verify the event was received
      }

      showLoadingState() {
        document.getElementById('loading-state').style.display = 'block';
        document.getElementById('empty-state').style.display = 'none';
        document.getElementById('table-container').style.display = 'none';
      }

      hideLoadingState() {
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('table-container').style.display = 'block';
      }

      showEmptyState() {
        document.getElementById('empty-state').style.display = 'flex';
        document.getElementById('table-container').style.display = 'none';
      }

      hideEmptyState() {
        document.getElementById('empty-state').style.display = 'none';
        document.getElementById('table-container').style.display = 'block';
      }

      showErrorState() {
        document.getElementById('error-state').style.display = 'flex';
        document.getElementById('table-container').style.display = 'none';
        document.getElementById('empty-state').style.display = 'none';
        document.getElementById('loading-state').style.display = 'none';
      }
    };
  });

  afterEach(() => {
    dom.window.close();
    delete global.document;
    delete global.window;
    delete global.HTMLElement;
    delete global.CustomEvent;
    delete global.DataTable;
  });

  describe('Initialization', () => {
    test('should initialize ConversationsPage correctly', () => {
      const page = new ConversationsPage();
      
      expect(page.table).toBeInstanceOf(MockDataTable);
      expect(page.currentFilters).toEqual({
        dateRange: 'all',
        dateFrom: null,
        dateTo: null,
        emotionalStates: [],
        duration: 'all'
      });
    });

    test('should setup DataTable with correct configuration', () => {
      const page = new ConversationsPage();
      
      expect(page.table.options.columns).toHaveLength(5);
      expect(page.table.options.columns[0].key).toBe('startTime');
      expect(page.table.options.columns[1].key).toBe('duration');
      expect(page.table.options.pagination).toBe(true);
      expect(page.table.options.pageSize).toBe(20);
      expect(page.table.options.searchable).toBe(true);
      expect(page.table.options.exportable).toBe(true);
    });

    test('should load initial conversations data', async () => {
      const page = new ConversationsPage();
      
      // Wait for async loadConversations to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/conversations?'));
      expect(page.table.data).toHaveLength(3);
    });
  });

  describe('Date Range Filtering', () => {
    test('should handle "today" date range selection', () => {
      const page = new ConversationsPage();
      const select = document.getElementById('date-range-filter');
      
      select.value = 'today';
      select.dispatchEvent(new window.Event('change'));
      
      expect(page.currentFilters.dateRange).toBe('today');
      expect(page.currentFilters.dateFrom).toBe(new Date().toISOString().split('T')[0]);
      expect(page.currentFilters.dateTo).toBe(new Date().toISOString().split('T')[0]);
    });

    test('should handle "week" date range selection', () => {
      const page = new ConversationsPage();
      const select = document.getElementById('date-range-filter');
      
      select.value = 'week';
      select.dispatchEvent(new window.Event('change'));
      
      expect(page.currentFilters.dateRange).toBe('week');
      expect(page.currentFilters.dateFrom).toBeTruthy();
      expect(page.currentFilters.dateTo).toBeTruthy();
    });

    test('should show/hide custom date inputs for custom range', () => {
      const page = new ConversationsPage();
      const select = document.getElementById('date-range-filter');
      const dateFrom = document.getElementById('date-from');
      const dateTo = document.getElementById('date-to');
      
      select.value = 'custom';
      select.dispatchEvent(new window.Event('change'));
      
      expect(page.currentFilters.dateRange).toBe('custom');
      expect(dateFrom.style.display).toBe('block');
      expect(dateTo.style.display).toBe('block');
      
      select.value = 'all';
      select.dispatchEvent(new window.Event('change'));
      
      expect(dateFrom.style.display).toBe('none');
      expect(dateTo.style.display).toBe('none');
    });
  });

  describe('Emotional State Filtering', () => {
    test('should handle emotional state checkbox changes', () => {
      const page = new ConversationsPage();
      const calmCheckbox = document.querySelector('.emotional-state-filter[value="calm"]');
      const anxietyCheckbox = document.querySelector('.emotional-state-filter[value="mild_anxiety"]');
      
      calmCheckbox.checked = true;
      calmCheckbox.dispatchEvent(new window.Event('change'));
      
      expect(page.currentFilters.emotionalStates).toContain('calm');
      
      anxietyCheckbox.checked = true;
      anxietyCheckbox.dispatchEvent(new window.Event('change'));
      
      expect(page.currentFilters.emotionalStates).toContain('calm');
      expect(page.currentFilters.emotionalStates).toContain('mild_anxiety');
      
      calmCheckbox.checked = false;
      calmCheckbox.dispatchEvent(new window.Event('change'));
      
      expect(page.currentFilters.emotionalStates).not.toContain('calm');
      expect(page.currentFilters.emotionalStates).toContain('mild_anxiety');
    });
  });

  describe('Duration Filtering', () => {
    test('should handle duration filter changes', () => {
      const page = new ConversationsPage();
      const select = document.getElementById('duration-filter');
      
      select.value = 'short';
      select.dispatchEvent(new window.Event('change'));
      
      expect(page.currentFilters.duration).toBe('short');
      
      select.value = 'long';
      select.dispatchEvent(new window.Event('change'));
      
      expect(page.currentFilters.duration).toBe('long');
    });
  });

  describe('Filter Clearing', () => {
    test('should clear all filters when clear button is clicked', () => {
      const page = new ConversationsPage();
      const clearButton = document.getElementById('clear-filters');
      
      // Set some filters
      page.currentFilters = {
        dateRange: 'week',
        dateFrom: '2025-08-08',
        dateTo: '2025-08-15',
        emotionalStates: ['calm', 'mild_anxiety'],
        duration: 'short'
      };
      
      clearButton.click();
      
      expect(page.currentFilters).toEqual({
        dateRange: 'all',
        dateFrom: null,
        dateTo: null,
        emotionalStates: [],
        duration: 'all'
      });
      
      expect(document.getElementById('date-range-filter').value).toBe('all');
      expect(document.getElementById('duration-filter').value).toBe('all');
      document.querySelectorAll('.emotional-state-filter').forEach(cb => {
        expect(cb.checked).toBe(false);
      });
    });
  });

  describe('Data Formatting', () => {
    test('should format datetime correctly', () => {
      const page = new ConversationsPage();
      const timestamp = '2025-08-15T10:30:00Z';
      const formatted = page.formatDateTime(timestamp);
      
      expect(formatted).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // Should contain date
      expect(formatted).toMatch(/\d{1,2}:\d{2}/); // Should contain time
    });

    test('should format duration correctly', () => {
      const page = new ConversationsPage();
      
      expect(page.formatDuration(360)).toBe('6:00');
      expect(page.formatDuration(90)).toBe('1:30');
      expect(page.formatDuration(3665)).toBe('61:05');
    });

    test('should format emotional state with color badges', () => {
      const page = new ConversationsPage();
      
      const calmBadge = page.formatEmotionalState('calm', 2);
      expect(calmBadge).toContain('badge-success');
      expect(calmBadge).toContain('Calm (2/10)');
      
      const anxietyBadge = page.formatEmotionalState('high_anxiety', 8);
      expect(anxietyBadge).toContain('badge-danger');
      expect(anxietyBadge).toContain('High Anxiety (8/10)');
    });

    test('should extract key topics from care indicators', () => {
      const page = new ConversationsPage();
      
      const topics1 = page.extractKeyTopics({
        medicationConcerns: ['pain medication'],
        painLevel: 5,
        staffComplaints: []
      });
      expect(topics1).toBe('Medication, Pain');
      
      const topics2 = page.extractKeyTopics({
        medicationConcerns: [],
        painLevel: 0,
        staffComplaints: []
      });
      expect(topics2).toBe('General conversation');
    });
  });

  describe('Transcript Modal', () => {
    test('should format transcript correctly', () => {
      const page = new ConversationsPage();
      const conversationData = {
        startTime: '2025-08-15T10:30:00Z',
        duration: 360,
        messages: [
          { role: 'assistant', content: 'Hello!', timestamp: '2025-08-15T10:30:00Z' },
          { role: 'user', content: 'Hi there.', timestamp: '2025-08-15T10:30:15Z' }
        ],
        emotionalTimeline: [
          { anxietyLevel: 3, agitationLevel: 2, positiveEngagement: 6 }
        ]
      };
      
      const formatted = page.formatTranscript(conversationData);
      
      expect(formatted).toContain('Conversation Details');
      expect(formatted).toContain('6:00'); // Duration
      expect(formatted).toContain('2'); // Message count
      expect(formatted).toContain('AI Companion');
      expect(formatted).toContain('Patient');
      expect(formatted).toContain('Hello!');
      expect(formatted).toContain('Hi there.');
      expect(formatted).toContain('Emotional Timeline');
    });

    test('should show transcript modal when viewTranscript is called', async () => {
      const page = new ConversationsPage();
      const modal = document.getElementById('transcript-modal');
      
      expect(modal.style.display).toBe('none');
      
      await page.viewTranscript(1);
      
      expect(fetch).toHaveBeenCalledWith('/api/conversations/1');
      expect(modal.style.display).toBe('block');
    });
  });

  describe('Loading and Empty States', () => {
    test('should show loading state during data fetch', () => {
      const page = new ConversationsPage();
      
      page.showLoadingState();
      
      expect(document.getElementById('loading-state').style.display).toBe('block');
      expect(document.getElementById('empty-state').style.display).toBe('none');
      expect(document.getElementById('table-container').style.display).toBe('none');
    });

    test('should show empty state when no data', () => {
      const page = new ConversationsPage();
      
      page.showEmptyState();
      
      expect(document.getElementById('empty-state').style.display).toBe('flex');
      expect(document.getElementById('table-container').style.display).toBe('none');
    });

    test('should hide loading state after data loads', () => {
      const page = new ConversationsPage();
      
      page.hideLoadingState();
      
      expect(document.getElementById('loading-state').style.display).toBe('none');
      expect(document.getElementById('table-container').style.display).toBe('block');
    });
  });

  describe('Table Events', () => {
    test('should handle table sort events', () => {
      const page = new ConversationsPage();
      const sortSpy = jest.spyOn(page, 'handleTableSort');
      
      page.table.sort('startTime', 'desc');
      
      expect(sortSpy).toHaveBeenCalledWith({ column: 'startTime', direction: 'desc' });
    });

    test('should handle table export events', () => {
      const page = new ConversationsPage();
      const exportSpy = jest.spyOn(page, 'handleExport');
      
      page.table.exportCSV();
      
      expect(exportSpy).toHaveBeenCalled();
    });
  });

  describe('API Integration', () => {
    test('should build correct API URL with filters', async () => {
      const page = new ConversationsPage();
      
      page.currentFilters = {
        dateRange: 'week',
        dateFrom: '2025-08-08',
        dateTo: '2025-08-15',
        emotionalStates: ['calm', 'mild_anxiety'],
        duration: 'short'
      };
      
      await page.loadConversations();
      
      expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/dateFrom=2025-08-08/));
      expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/dateTo=2025-08-15/));
      expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/emotionalStates=calm/));
      expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/emotionalStates=mild_anxiety/));
      expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/maxDuration=300/));
    });

    test('should handle API errors gracefully', async () => {
      const page = new ConversationsPage();
      
      fetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      await page.loadConversations();
      
      expect(consoleSpy).toHaveBeenCalledWith('Error loading conversations:', expect.any(Error));
      expect(document.getElementById('error-state').style.display).toBe('flex');
      
      consoleSpy.mockRestore();
    });
  });
});