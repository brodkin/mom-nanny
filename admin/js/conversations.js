/**
 * Conversations Page JavaScript
 * 
 * Manages the conversations data table with filtering, sorting, and transcript viewing
 * for mental health tracking of elderly dementia patients.
 * 
 * Features:
 * - Real-time data loading from /api/conversations
 * - Date range filtering (Today, Last 7 days, Last 30 days, Custom)
 * - Emotional state filtering with color-coded badges
 * - Duration filtering (short, medium, long conversations)
 * - Global search across all conversation data
 * - Sortable data table with pagination
 * - Transcript modal with emotional timeline
 * - Export to CSV functionality
 * - Loading, empty, and error states
 */

import { DataTable } from './components/table.js';

class ConversationsPage {
  constructor() {
    this.table = null;
    this.currentFilters = {
      dateRange: 'all',
      dateFrom: null,
      dateTo: null,
      emotionalStates: [],
      duration: 'all',
      search: ''
    };
    
    this.emotionalStateColors = {
      calm: { class: 'calm', color: '#10b981', label: 'Calm', icon: 'calm.svg' },
      mild_anxiety: { class: 'mild', color: '#f59e0b', label: 'Mild Anxiety', icon: 'mild.svg' },
      moderate_anxiety: { class: 'moderate', color: '#ea580c', label: 'Moderate Anxiety', icon: 'moderate.svg' },
      high_anxiety: { class: 'high', color: '#ef4444', label: 'High Anxiety', icon: 'high.svg' },
      unknown: { class: 'unknown', color: '#6b7280', label: 'Too Short', icon: 'brief.svg' }
    };

    // Bind methods to preserve context
    this.handleDateRangeChange = this.handleDateRangeChange.bind(this);
    this.handleEmotionalStateChange = this.handleEmotionalStateChange.bind(this);
    this.handleDurationChange = this.handleDurationChange.bind(this);
    this.handleGlobalSearch = this.handleGlobalSearch.bind(this);
    this.clearAllFilters = this.clearAllFilters.bind(this);
    this.refreshData = this.refreshData.bind(this);
    this.viewTranscript = this.viewTranscript.bind(this);

    this.init();
  }

  /**
   * Initialize the conversations page
   */
  async init() {
    try {
      this.initializeDataTable();
      this.bindEventListeners();
      this.checkUrlParameters();
      await this.loadTimezoneInfo();
      await this.loadStats();
      await this.loadConversations();
    } catch (error) {
      console.error('Error initializing conversations page:', error);
      this.showErrorState();
    }
  }
  
  /**
   * Load and display timezone information
   */
  async loadTimezoneInfo() {
    try {
      const response = await fetch('/api/admin/dashboard/overview');
      const result = await response.json();
      
      // Timezone data is at the root level of the response
      if (result.success && result.timezone) {
        const timezoneDisplay = document.getElementById('timezone-display');
        if (timezoneDisplay) {
          const tz = result.timezone;
          timezoneDisplay.textContent = `${tz.abbreviation} (${tz.configured})`;
          
          // Update tooltip with current time
          const indicator = document.getElementById('timezone-indicator');
          if (indicator) {
            indicator.setAttribute('data-tooltip', `Current time: ${tz.currentTime}`);
          }
        }
      }
    } catch (error) {
      console.error('Error loading timezone info:', error);
      // Fail silently - timezone display is not critical
    }
  }

  /**
   * Load and display statistics cards
   */
  async loadStats() {
    try {
      // Fetch overview data for conversations today
      const overviewResponse = await fetch('/api/admin/dashboard/overview');
      const overviewResult = await overviewResponse.json();
      
      // Fetch analytics data for average anxiety
      const analyticsResponse = await fetch('/api/conversations/analytics?dateFrom=' + 
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      const analyticsResult = await analyticsResponse.json();
      
      if (overviewResult.success) {
        // Update Conversations Today
        const conversationsToday = document.getElementById('conversations-today');
        if (conversationsToday) {
          conversationsToday.textContent = overviewResult.data.conversations.today || '0';
        }
        
        // Calculate engagement time today from conversations data
        // We'll need to fetch today's conversations to sum their durations
        // Use local date to match the server's date comparison
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;
        const todayConversationsResponse = await fetch(`/api/conversations?dateFrom=${today}&dateTo=${today}`);
        const todayConversationsResult = await todayConversationsResponse.json();
        
        if (todayConversationsResult.success) {
          // Calculate total engagement time
          let totalDuration = 0;
          if (todayConversationsResult.data && todayConversationsResult.data.conversations) {
            todayConversationsResult.data.conversations.forEach(conv => {
              if (conv.duration) {
                totalDuration += conv.duration;
              }
            });
          }
          
          // Format duration as human-readable
          const engagementTime = document.getElementById('engagement-time');
          if (engagementTime) {
            engagementTime.textContent = this.formatDuration(totalDuration);
          }
        }
      }
      
      if (analyticsResult.success) {
        // Update Average Anxiety Level
        const averageAnxiety = document.getElementById('average-anxiety');
        if (averageAnxiety && analyticsResult.data) {
          const anxietyLevel = analyticsResult.data.emotionalTrends?.averageAnxiety || 0;
          // Display as X/10 format (data is already in 0-10 scale from emotional_metrics)
          // Round to nearest whole number
          const anxietyRounded = Math.round(anxietyLevel);
          // Create HTML with styled /10 suffix - same size but less prominent
          averageAnxiety.innerHTML = `${anxietyRounded}<span style="opacity: 0.4;">/10</span>`;
        }
      }
      
    } catch (error) {
      console.error('Error loading stats:', error);
      // Set defaults on error
      document.getElementById('conversations-today').textContent = '--';
      document.getElementById('average-anxiety').textContent = '--';
      document.getElementById('engagement-time').textContent = '--';
    }
  }
  
  /**
   * Format duration in seconds to human-readable format
   * @param {number} seconds - Duration in seconds
   * @returns {string} Formatted duration (e.g., "2h 15m", "45m", "30s")
   */
  formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0m';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs > 0 ? secs + 's' : ''}`.trim();
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Initialize the DataTable component
   */
  initializeDataTable() {
    const tableContainer = document.getElementById('table-container');
    if (!tableContainer) {
      throw new Error('Table container not found');
    }

    this.table = new DataTable({
      columns: [
        { 
          key: 'startTime', 
          title: 'Date/Time', 
          sortable: true,
          formatter: (value, row) => {
            // Use server-provided formatted data if available
            if (row.startTimeFormatted) {
              const formatted = this.formatDateTime(value, row.startTimeFormatted);
              // Add timezone abbreviation if available
              if (row.timezoneAbbr) {
                return `${formatted} ${row.timezoneAbbr}`;
              }
              return formatted;
            }
            // Fallback to browser timezone
            return this.formatDateTime(value);
          }
        },
        { 
          key: 'duration', 
          title: 'Duration', 
          sortable: true,
          formatter: (value) => this.formatDuration(value)
        },
        { 
          key: 'emotionalState', 
          title: 'Emotional State', 
          sortable: false,
          formatter: (value) => value // Already formatted in formatTableData
        },
        { 
          key: 'keyTopics', 
          title: 'Key Topics', 
          sortable: false 
        },
        { 
          key: 'actions', 
          title: 'Actions', 
          sortable: false,
          formatter: (value, row) => this.createActionButtons(row.id)
        }
      ],
      pagination: true,
      pageSize: 10,
      searchable: false, // We handle global search separately
      exportable: true,
      className: 'conversations-table'
    });

    // Handle table events
    this.table.addEventListener('export', () => {
      this.handleExport();
    });

    this.table.addEventListener('sort', (e) => {
      this.handleTableSort(e.detail);
    });

    tableContainer.appendChild(this.table.element);
  }

  /**
   * Bind event listeners for filters and controls
   */
  bindEventListeners() {
    // Date range filter
    const dateRangeFilter = document.getElementById('date-range-filter');
    if (dateRangeFilter) {
      dateRangeFilter.addEventListener('change', this.handleDateRangeChange);
    }

    // Custom date inputs
    const dateFromInput = document.getElementById('date-from');
    const dateToInput = document.getElementById('date-to');
    if (dateFromInput && dateToInput) {
      dateFromInput.addEventListener('change', () => {
        this.currentFilters.dateFrom = dateFromInput.value;
        this.loadConversations();
      });
      
      dateToInput.addEventListener('change', () => {
        this.currentFilters.dateTo = dateToInput.value;
        this.loadConversations();
      });
    }

    // Emotional state filters
    const emotionalStateFilters = document.querySelectorAll('.emotional-state-filter');
    emotionalStateFilters.forEach(filter => {
      filter.addEventListener('change', this.handleEmotionalStateChange);
    });

    // Duration filter
    const durationFilter = document.getElementById('duration-filter');
    if (durationFilter) {
      durationFilter.addEventListener('change', this.handleDurationChange);
    }

    // Global search
    const globalSearch = document.getElementById('global-search');
    if (globalSearch) {
      globalSearch.addEventListener('input', this.handleGlobalSearch);
    }

    // Control buttons
    const clearFiltersBtn = document.getElementById('clear-all-filters');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', this.clearAllFilters);
    }

    const refreshBtn = document.getElementById('refresh-data');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', this.refreshData);
    }

    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', this.clearAllFilters);
    }

    const retryLoadBtn = document.getElementById('retry-load-btn');
    if (retryLoadBtn) {
      retryLoadBtn.addEventListener('click', this.refreshData);
    }

    // Modal close handlers
    this.bindModalEventListeners();

    // Make viewTranscript globally available for action buttons
    window.conversationsPage = this;
  }

  /**
   * Bind modal event listeners
   */
  bindModalEventListeners() {
    const modal = document.getElementById('transcript-modal');
    const closeBtn = modal?.querySelector('.modal-close');
    const overlay = modal?.querySelector('.modal-overlay');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideTranscriptModal());
    }

    if (overlay) {
      overlay.addEventListener('click', () => this.hideTranscriptModal());
    }

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && modal.style.display !== 'none') {
        this.hideTranscriptModal();
      }
    });
  }

  /**
   * Handle date range filter changes
   */
  handleDateRangeChange(event) {
    const range = event.target.value;
    this.currentFilters.dateRange = range;
    
    const customInputs = document.getElementById('custom-date-inputs');
    
    if (range === 'custom') {
      if (customInputs) customInputs.style.display = 'flex';
      // Don't load conversations yet - wait for user to select dates
      return;
    } else {
      if (customInputs) customInputs.style.display = 'none';
      
      // Calculate date range
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      switch (range) {
        case 'today':
          this.currentFilters.dateFrom = today;
          this.currentFilters.dateTo = today;
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          this.currentFilters.dateFrom = weekAgo.toISOString().split('T')[0];
          this.currentFilters.dateTo = today;
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          this.currentFilters.dateFrom = monthAgo.toISOString().split('T')[0];
          this.currentFilters.dateTo = today;
          break;
        default: // 'all'
          this.currentFilters.dateFrom = null;
          this.currentFilters.dateTo = null;
      }
    }
    
    this.loadConversations();
  }

  /**
   * Handle emotional state filter changes
   */
  handleEmotionalStateChange() {
    const checkedStates = Array.from(document.querySelectorAll('.emotional-state-filter:checked'))
      .map(cb => cb.value);
    this.currentFilters.emotionalStates = checkedStates;
    this.loadConversations();
  }

  /**
   * Handle duration filter changes
   */
  handleDurationChange(event) {
    this.currentFilters.duration = event.target.value;
    this.loadConversations();
  }

  /**
   * Handle global search input
   */
  handleGlobalSearch(event) {
    this.currentFilters.search = event.target.value.trim();
    // Debounce search to avoid too many API calls
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.loadConversations();
    }, 300);
  }

  /**
   * Clear all filters and reload data
   */
  clearAllFilters() {
    this.currentFilters = {
      dateRange: 'all',
      dateFrom: null,
      dateTo: null,
      emotionalStates: [],
      duration: 'all',
      search: ''
    };

    // Reset UI elements
    const dateRangeFilter = document.getElementById('date-range-filter');
    if (dateRangeFilter) dateRangeFilter.value = 'all';

    const durationFilter = document.getElementById('duration-filter');
    if (durationFilter) durationFilter.value = 'all';

    const globalSearch = document.getElementById('global-search');
    if (globalSearch) globalSearch.value = '';

    const customInputs = document.getElementById('custom-date-inputs');
    if (customInputs) customInputs.style.display = 'none';

    // Clear emotional state checkboxes
    document.querySelectorAll('.emotional-state-filter').forEach(cb => {
      cb.checked = false;
    });

    this.loadConversations();
  }

  /**
   * Refresh data (same as load conversations)
   */
  refreshData() {
    this.loadStats();
    this.loadConversations();
  }

  /**
   * Load conversations from the API with current filters
   */
  async loadConversations() {
    try {
      this.showLoadingState();

      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('pageSize', '50'); // Load more data for client-side filtering

      // Date filters
      if (this.currentFilters.dateFrom) {
        params.append('dateFrom', this.currentFilters.dateFrom);
      }
      if (this.currentFilters.dateTo) {
        params.append('dateTo', this.currentFilters.dateTo);
      }

      // Emotional state filters
      if (this.currentFilters.emotionalStates.length > 0) {
        this.currentFilters.emotionalStates.forEach(state => {
          params.append('emotionalStates', state);
        });
      }

      // Duration filters
      if (this.currentFilters.duration !== 'all') {
        switch (this.currentFilters.duration) {
          case 'short':
            params.append('maxDuration', '300'); // Under 5 minutes
            break;
          case 'medium':
            params.append('minDuration', '300');
            params.append('maxDuration', '900'); // 5-15 minutes
            break;
          case 'long':
            params.append('minDuration', '900'); // Over 15 minutes
            break;
        }
      }

      // Search filter - send to server-side
      if (this.currentFilters.search) {
        params.append('search', this.currentFilters.search);
      }

      const response = await fetch(`/api/conversations?${params}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to load conversations');
      }

      let conversations = result.data.conversations || [];

      // Server-side filtering is now handled by API, no client-side filtering needed
      const tableData = this.formatTableData(conversations);
      this.table.setData(tableData);
      
      this.hideLoadingState();
      
      if (tableData.length === 0) {
        this.showEmptyState();
      } else {
        this.hideEmptyState();
      }

    } catch (error) {
      console.error('Error loading conversations:', error);
      this.hideLoadingState();
      this.showErrorState();
    }
  }


  /**
   * Format conversations data for the table
   */
  formatTableData(conversations) {
    return conversations.map(conv => ({
      id: conv.id,
      startTime: conv.startTime,
      startTimeFormatted: conv.startTimeFormatted, // Add formatted timezone data
      duration: conv.duration,
      emotionalState: this.formatEmotionalState(conv.emotionalState, conv.anxietyLevel, conv.confusionLevel, conv.agitationLevel),
      emotionalStateRaw: conv.emotionalState,
      anxietyLevel: conv.anxietyLevel,
      confusionLevel: conv.confusionLevel,
      agitationLevel: conv.agitationLevel,
      keyTopics: this.extractKeyTopics(conv.careIndicators),
      messageSnippet: conv.messageSnippet || '',
      actions: '', // Will be formatted by column formatter
      timezone: conv.timezone, // Add timezone info
      timezoneAbbr: conv.timezoneAbbr, // Add timezone abbreviation
      // Keep original data for actions
      originalData: conv
    }));
  }

  /**
   * Format date and time for display
   */
  formatDateTime(timestamp, formattedData = null) {
    if (!timestamp) return 'Unknown';
    
    // If we have pre-formatted timezone data from the server, use it
    if (formattedData && formattedData.full) {
      return formattedData.full;
    }
    
    // Fallback to browser's local timezone (for backward compatibility)
    const date = new Date(timestamp);
    const options = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return date.toLocaleDateString('en-US', options);
  }

  /**
   * Format duration in seconds to friendly format
   */
  formatDuration(seconds) {
    // Handle null and undefined
    if (seconds === null || seconds === undefined) {
      return 'No duration';
    }
    
    // Handle exactly 0
    if (seconds === 0) {
      return '0 seconds';
    }
    
    // Handle negative values
    if (seconds < 0) {
      return 'No duration';
    }
    
    // Handle fractional seconds less than 1
    if (seconds < 1) {
      return '< 1 second';
    }
    
    // Round to whole seconds for display
    const totalSeconds = Math.round(seconds);
    
    if (totalSeconds < 60) {
      return `${totalSeconds} seconds`;
    }
    
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    
    if (minutes < 60) {
      return `${minutes} minutes`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
      return `${hours} hours`;
    }
    
    return `${hours} hours ${remainingMinutes} minutes`;
  }

  /**
   * Format emotional state with enhanced colored badge including emojis
   */
  formatEmotionalState(state, anxietyLevel, confusionLevel, agitationLevel) {
    const stateInfo = this.emotionalStateColors[state] || this.emotionalStateColors.unknown;
    
    // Check if this is truly an unknown state (no metrics available)
    const isUnknownState = state === 'unknown' || anxietyLevel === null || anxietyLevel === undefined;
    
    // Round all levels to whole numbers
    const anxiety = Math.round(Math.max(0, Math.min(10, anxietyLevel || 0)));
    const confusion = Math.round(Math.max(0, Math.min(10, confusionLevel || 0)));
    const agitation = Math.round(Math.max(0, Math.min(10, agitationLevel || 0)));
    
    // Build tooltip with all metrics if available
    let tooltipText;
    if (isUnknownState) {
      tooltipText = 'Conversation too brief for emotional analysis (under 30 seconds)';
    } else {
      tooltipText = `Anxiety: ${anxiety}/10`;
      if (confusionLevel !== undefined && confusionLevel !== null) {
        tooltipText += `\nConfusion: ${confusion}/10`;
      }
      if (agitationLevel !== undefined && agitationLevel !== null) {
        tooltipText += `\nAgitation: ${agitation}/10`;
      }
    }
    
    const iconHtml = stateInfo.icon 
      ? `<img src="/admin/assets/icons/emotional-states/${stateInfo.icon}" 
              class="emotional-icon" 
              alt="${stateInfo.label}" 
              width="24" 
              height="24">`
      : '<span class="emotional-icon">❓</span>';
    
    const anxietyDisplay = isUnknownState ? '<30s' : `${anxiety}/10`;
    
    return `
      <span class="emotional-badge ${stateInfo.class}" 
            title="${tooltipText}">
        ${iconHtml}
        <span class="label">${stateInfo.label}</span>
        <span class="anxiety-level">${anxietyDisplay}</span>
      </span>
    `;
  }

  /**
   * Extract key topics from care indicators
   */
  extractKeyTopics(careIndicators) {
    if (!careIndicators) return 'General conversation';
    
    const topics = [];
    
    if (careIndicators.medicationConcerns && careIndicators.medicationConcerns.length > 0) {
      topics.push('Medication');
    }
    
    if (careIndicators.painLevel && careIndicators.painLevel > 0) {
      topics.push('Pain');
    }
    
    if (careIndicators.staffComplaints && careIndicators.staffComplaints.length > 0) {
      topics.push('Staff Issues');
    }
    
    if (careIndicators.keyTopics && careIndicators.keyTopics.length > 0) {
      topics.push(...careIndicators.keyTopics);
    }
    
    return topics.length > 0 ? topics.join(', ') : 'General conversation';
  }

  /**
   * Create action buttons for each table row
   */
  createActionButtons(conversationId) {
    return `
      <div class="action-buttons">
        <button class="btn btn-sm btn-outline" 
                onclick="window.conversationsPage.viewTranscript(${conversationId})"
                title="View full conversation transcript">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          View Transcript
        </button>
      </div>
    `;
  }

  /**
   * View conversation transcript in modal
   */
  async viewTranscript(conversationId) {
    try {
      this.showTranscriptModal('Loading transcript...');
      
      const response = await fetch(`/api/conversations/${conversationId}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to load transcript');
      }

      this.displayTranscript(result.data);
      
    } catch (error) {
      console.error('Error loading transcript:', error);
      this.showTranscriptModal(`
        <div class="error-message">
          <h4>Failed to load transcript</h4>
          <p>There was an error loading the conversation transcript. Please try again later.</p>
        </div>
      `);
    }
  }

  /**
   * Display transcript in modal
   */
  displayTranscript(conversationData) {
    const content = this.formatTranscript(conversationData);
    this.showTranscriptModal(content);
  }

  /**
   * Format transcript content for display
   */
  formatTranscript(data) {
    let html = `
      <div class="transcript-container">
        <div class="conversation-header">
          <div class="conversation-meta">
            <div class="meta-item">
              <label>Date & Time:</label>
              <span>${this.formatDateTime(data.startTime, data.startTimeFormatted)}${data.timezoneAbbr ? ` ${data.timezoneAbbr}` : ''}</span>
            </div>
            <div class="meta-item">
              <label>Duration:</label>
              <span>${this.formatDuration(data.duration)}</span>
            </div>
            <div class="meta-item">
              <label>Messages:</label>
              <span>${data.messages ? data.messages.length : 0}</span>
            </div>
            ${data.callSid ? `
              <div class="meta-item">
                <label>Call ID:</label>
                <span class="call-id">${data.callSid}</span>
              </div>
            ` : ''}
          </div>
        </div>
        
        <div class="conversation-content">
          <h4>Conversation Messages</h4>
          <div class="messages-container">
    `;

    // Add messages
    if (data.messages && data.messages.length > 0) {
      data.messages.forEach((message, index) => {
        // Use server-provided formatted timestamp if available
        let timestamp;
        if (message.timestampFormatted && message.timestampFormatted.time) {
          timestamp = message.timestampFormatted.time;
          // Add timezone abbreviation if available
          if (data.timezoneAbbr) {
            timestamp += ` ${data.timezoneAbbr}`;
          }
        } else {
          // Fallback to browser timezone
          timestamp = new Date(message.timestamp).toLocaleTimeString();
        }
        
        const roleClass = message.role === 'user' ? 'user-message' : 'assistant-message';
        const roleLabel = message.role === 'user' ? 'Patient' : 'AI Companion';
        
        html += `
          <div class="message ${roleClass}">
            <div class="message-header">
              <span class="role-badge ${message.role}">${roleLabel}</span>
              <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-content">${this.escapeHtml(message.content)}</div>
          </div>
        `;
      });
    } else {
      html += '<div class="no-messages">No messages available for this conversation.</div>';
    }

    html += '</div></div>'; // Close messages-container and conversation-content

    // Add emotional timeline if available
    if (data.emotionalTimeline && data.emotionalTimeline.length > 0) {
      html += this.formatEmotionalTimeline(data.emotionalTimeline);
    }

    // Add care indicators if available
    if (data.careIndicators) {
      html += this.formatCareIndicators(data.careIndicators);
    }

    html += '</div>'; // Close transcript-container

    return html;
  }

  /**
   * Format emotional timeline section
   * FIXED: Ensures only emotional metrics are displayed, never message content
   */
  formatEmotionalTimeline(timeline) {
    let html = `
      <div class="emotional-timeline">
        <h4>Emotional Timeline</h4>
        <div class="timeline-container">
          <div class="timeline-legend">
            <div class="legend-item anxiety">
              <span class="legend-color" style="background-color: #ef4444"></span>
              <span>Anxiety</span>
            </div>
            <div class="legend-item agitation">
              <span class="legend-color" style="background-color: #f59e0b"></span>
              <span>Agitation</span>
            </div>
            <div class="legend-item engagement">
              <span class="legend-color" style="background-color: #10b981"></span>
              <span>Positive Engagement</span>
            </div>
          </div>
          <div class="timeline-chart">
    `;

    // Create simple timeline visualization
    // FIXED: Explicitly filter out any non-metric properties to prevent 
    // message content from being displayed even if erroneously included in data
    timeline.forEach((point, index) => {
      const timestamp = new Date(point.timestamp).toLocaleTimeString();
      
      // FIXED: Only extract and use emotional metrics, ignore any other properties
      const anxietyLevel = Math.max(0, Math.min(10, Number(point.anxietyLevel) || 0));
      const agitationLevel = Math.max(0, Math.min(10, Number(point.agitationLevel) || 0));
      const positiveEngagement = Math.max(0, Math.min(10, Number(point.positiveEngagement) || 0));
      
      html += `
        <div class="timeline-point">
          <div class="point-time">${timestamp}</div>
          <div class="point-metrics">
            <div class="metric anxiety" title="Anxiety: ${anxietyLevel}/10">
              <div class="metric-bar" style="width: ${(anxietyLevel / 10) * 100}%"></div>
              <span class="metric-value">${anxietyLevel}</span>
            </div>
            <div class="metric agitation" title="Agitation: ${agitationLevel}/10">
              <div class="metric-bar" style="width: ${(agitationLevel / 10) * 100}%"></div>
              <span class="metric-value">${agitationLevel}</span>
            </div>
            <div class="metric engagement" title="Positive Engagement: ${positiveEngagement}/10">
              <div class="metric-bar" style="width: ${(positiveEngagement / 10) * 100}%"></div>
              <span class="metric-value">${positiveEngagement}</span>
            </div>
          </div>
        </div>
      `;
    });

    html += `
          </div>
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Format care indicators section
   */
  formatCareIndicators(careIndicators) {
    let html = `
      <div class="care-indicators">
        <h4>Care Indicators</h4>
        <div class="indicators-grid">
    `;

    // Medication concerns
    if (careIndicators.medicationConcerns && careIndicators.medicationConcerns.length > 0) {
      html += `
        <div class="indicator-item medication">
          <div class="indicator-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <circle cx="15.5" cy="8.5" r="1.5"></circle>
              <circle cx="8.5" cy="15.5" r="1.5"></circle>
              <circle cx="15.5" cy="15.5" r="1.5"></circle>
            </svg>
            <h5>Medication Concerns</h5>
          </div>
          <ul>
            ${careIndicators.medicationConcerns.map(concern => 
              `<li>${this.escapeHtml(concern)}</li>`
            ).join('')}
          </ul>
        </div>
      `;
    }

    // Pain level
    if (careIndicators.painLevel && careIndicators.painLevel > 0) {
      html += `
        <div class="indicator-item pain">
          <div class="indicator-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
            </svg>
            <h5>Pain Level</h5>
          </div>
          <div class="pain-level">
            <div class="pain-scale">
              <div class="pain-bar" style="width: ${(careIndicators.painLevel / 10) * 100}%"></div>
            </div>
            <span class="pain-value">${careIndicators.painLevel}/10</span>
          </div>
        </div>
      `;
    }

    // Staff complaints
    if (careIndicators.staffComplaints && careIndicators.staffComplaints.length > 0) {
      html += `
        <div class="indicator-item staff">
          <div class="indicator-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <h5>Staff Issues</h5>
          </div>
          <ul>
            ${careIndicators.staffComplaints.map(complaint => 
              `<li>${this.escapeHtml(complaint)}</li>`
            ).join('')}
          </ul>
        </div>
      `;
    }

    // Key topics
    if (careIndicators.keyTopics && careIndicators.keyTopics.length > 0) {
      html += `
        <div class="indicator-item topics">
          <div class="indicator-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            <h5>Key Topics</h5>
          </div>
          <div class="topic-tags">
            ${careIndicators.keyTopics.map(topic => 
              `<span class="topic-tag">${this.escapeHtml(topic)}</span>`
            ).join('')}
          </div>
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Show transcript modal with content
   */
  showTranscriptModal(content) {
    const modal = document.getElementById('transcript-modal');
    const contentContainer = document.getElementById('transcript-content');
    
    if (modal && contentContainer) {
      contentContainer.innerHTML = content;
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      
      // Focus modal for accessibility
      modal.focus();
    }
  }

  /**
   * Hide transcript modal
   */
  hideTranscriptModal() {
    const modal = document.getElementById('transcript-modal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  /**
   * Handle table sort events
   */
  handleTableSort(sortDetail) {
    // The DataTable component handles sorting automatically
    // We could add server-side sorting here if needed
    console.log('Table sorted by:', sortDetail.column, sortDetail.direction);
  }

  /**
   * Handle CSV export
   */
  handleExport() {
    // The DataTable component handles the basic CSV export
    // This could be extended to include additional data or formatting
    console.log('Exporting conversation data to CSV');
  }

  /**
   * Show loading state
   */
  showLoadingState() {
    document.getElementById('loading-state').style.display = 'flex';
    document.getElementById('table-container').style.display = 'none';
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('error-state').style.display = 'none';
  }

  /**
   * Hide loading state
   */
  hideLoadingState() {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('table-container').style.display = 'block';
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    document.getElementById('empty-state').style.display = 'flex';
    document.getElementById('table-container').style.display = 'none';
    document.getElementById('error-state').style.display = 'none';
  }

  /**
   * Hide empty state
   */
  hideEmptyState() {
    document.getElementById('empty-state').style.display = 'none';
  }

  /**
   * Show error state
   */
  showErrorState() {
    document.getElementById('error-state').style.display = 'flex';
    document.getElementById('table-container').style.display = 'none';
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('loading-state').style.display = 'none';
  }

  /**
   * Check URL parameters for initial filter settings
   */
  checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('search');
    
    if (searchQuery) {
      // Set the search filter
      this.currentFilters.search = decodeURIComponent(searchQuery);
      
      // Update the local search input
      const localSearchInput = document.getElementById('global-search');
      if (localSearchInput) {
        localSearchInput.value = this.currentFilters.search;
      }
    }
  }

  /**
   * Perform global search (called by global search module)
   */
  performGlobalSearch(query) {
    // Update local search input to reflect global search
    const localSearchInput = document.getElementById('global-search');
    if (localSearchInput) {
      localSearchInput.value = query;
    }
    
    // Update current filters and trigger search
    this.currentFilters.search = query;
    this.loadConversations();
    
    // Update URL to reflect search
    this.updateUrlWithSearch(query);
  }

  /**
   * Update URL with search parameter
   */
  updateUrlWithSearch(query) {
    const url = new URL(window.location);
    if (query) {
      url.searchParams.set('search', encodeURIComponent(query));
    } else {
      url.searchParams.delete('search');
    }
    window.history.replaceState({}, '', url);
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the conversations page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.conversationsPage = new ConversationsPage();
});