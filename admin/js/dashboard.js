/**
 * Dashboard JavaScript - Mental Health Monitoring Interface
 * 
 * Provides real-time data visualization and monitoring for dementia patient care.
 * Focuses on emotional state tracking, critical alerts, and care provider insights.
 */

class Dashboard {
  constructor() {
    this.chart = null;
    this.refreshInterval = null;
    this.currentTimeRange = '7';
    this.lastUpdateTime = null;
    
    this.init();
  }
  
  init() {
    console.log('Dashboard initializing...');
    this.setupEventListeners();
    this.loadDashboardData();
    this.setupAutoRefresh();
  }
  
  setupEventListeners() {
    // Time range selector
    const timeRangeSelect = document.getElementById('timeRange');
    if (timeRangeSelect) {
      timeRangeSelect.addEventListener('change', (e) => {
        this.currentTimeRange = e.target.value;
        this.loadDashboardData();
      });
    }
    
    // Manual refresh on click
    const refreshElements = document.querySelectorAll('[data-action="refresh"]');
    refreshElements.forEach(el => {
      el.addEventListener('click', () => this.loadDashboardData());
    });
  }
  
  setupAutoRefresh() {
    // Refresh every 5 minutes
    this.refreshInterval = setInterval(() => {
      this.loadDashboardData();
    }, 5 * 60 * 1000);
  }
  
  async loadDashboardData() {
    console.log('Loading dashboard data...');
    try {
      const response = await fetch('/api/emotional-metrics/dashboard');
      const data = await response.json();
      
      console.log('Dashboard data received:', data);
      
      if (data.success) {
        this.updateOverviewCards(data.data.overview);
        this.updateRecentConversations(data.data.recentConversations);
        this.updateCriticalAlerts(data.data.alerts);
        this.updateCareIndicators(data.data);
        await this.updateChart();
        this.updateLastRefreshTime();
      } else {
        console.error('Failed to load dashboard data:', data.error);
        this.showError('Failed to load dashboard data');
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.showError('Network error loading dashboard data');
    }
  }
  
  updateOverviewCards(overview) {
    console.log('Updating overview cards with:', overview);
    // Update stats cards with styled /10 suffix to match conversations page
    const avgAnxietyElement = document.getElementById('avgAnxiety');
    const avgComfortElement = document.getElementById('avgComfort');
    
    if (avgAnxietyElement) {
      avgAnxietyElement.innerHTML = `${overview.avgAnxiety}<span style="opacity: 0.4;">/10</span>`;
    }
    if (avgComfortElement) {
      avgComfortElement.innerHTML = `${overview.avgComfort}<span style="opacity: 0.4;">/10</span>`;
    }
    this.updateElement('callsToday', overview.callsToday);
    this.updateElement('alertCount', overview.alertCount);
    
    // Format and update last call time
    if (overview.lastCallTime) {
      const lastCall = new Date(overview.lastCallTime);
      const timeStr = this.formatTimeAgo(lastCall);
      this.updateElement('lastCallTime', timeStr);
    } else {
      this.updateElement('lastCallTime', 'No calls today');
    }
    
    // Update alert count styling based on severity
    const alertElement = document.getElementById('alertCount');
    if (alertElement) {
      alertElement.className = overview.alertCount > 0 ? 'stat-value alert' : 'stat-value';
    }
  }
  
  updateRecentConversations(conversations) {
    const container = document.getElementById('recentConversations');
    if (!container) return;
    
    if (!conversations || conversations.length === 0) {
      container.innerHTML = `
        <div class="no-data-state">
          <p>No recent conversations found</p>
        </div>
      `;
      return;
    }
    
    const conversationsHtml = conversations.map(conv => `
      <div class="conversation-item">
        <div class="emotional-state ${conv.emotionalState}">
          ${this.getEmotionalStateIcon(conv.emotionalState)}
        </div>
        <div class="conversation-details">
          <div class="conversation-title">
            ${conv.callTitle || 'General Conversation'}
            ${conv.hasCareIndicators ? ' ⚠️' : ''}
          </div>
          <div class="conversation-summary">
            ${this.formatDateTime(conv.startTime)} • ${conv.duration}
          </div>
        </div>
      </div>
    `).join('');
    
    container.innerHTML = conversationsHtml;
  }
  
  updateCriticalAlerts(alerts) {
    const container = document.getElementById('critical-alerts');
    if (!container) return;
    
    if (!alerts || alerts.length === 0) {
      container.style.display = 'none';
      return;
    }
    
    container.style.display = 'block';
    
    const alertsHtml = alerts.map(alert => `
      <div class="critical-alert ${alert.type}">
        <div class="alert-icon">
          ${this.getAlertIcon(alert.type)}
        </div>
        <div class="alert-content">
          <h4>${alert.title}</h4>
          <p>${alert.message}</p>
          <div class="alert-action">${alert.action}</div>
        </div>
      </div>
    `).join('');
    
    container.innerHTML = alertsHtml;
  }
  
  updateCareIndicators(data) {
    const container = document.getElementById('careIndicators');
    if (!container) return;
    
    // Calculate care indicators from the data
    const indicators = [
      {
        icon: '💊',
        label: 'Medication Mentions',
        count: data.overview?.medicationMentions || 0,
        timeframe: 'Last 7 days'
      },
      {
        icon: '😣',
        label: 'Pain Reports',
        count: data.overview?.painReports || 0,
        timeframe: 'Last 7 days'
      },
      {
        icon: '👥',
        label: 'Staff Concerns',
        count: data.overview?.staffConcerns || 0,
        timeframe: 'Last 7 days'
      },
      {
        icon: '📞',
        label: 'High Anxiety Calls',
        count: data.overview?.highAnxietyCount || 0,
        timeframe: 'This week'
      }
    ];
    
    const indicatorsHtml = indicators.map(indicator => `
      <div class="care-indicator">
        <div class="indicator-icon">${indicator.icon}</div>
        <div class="indicator-details">
          <div class="indicator-count">${indicator.count}</div>
          <div class="indicator-label">${indicator.label}</div>
          <div class="indicator-timeframe">${indicator.timeframe}</div>
        </div>
      </div>
    `).join('');
    
    container.innerHTML = indicatorsHtml;
  }
  
  async updateChart() {
    try {
      const response = await fetch(`/api/emotional-metrics/trends?days=${this.currentTimeRange}`);
      const data = await response.json();
      
      if (data.success && data.data.trends) {
        this.renderChart(data.data.trends);
        this.hideChartLoading();
      } else {
        console.error('Failed to load trend data:', data.error);
        this.showChartError();
      }
    } catch (error) {
      console.error('Error loading trend data:', error);
      this.showChartError();
    }
  }
  
  renderChart(trends) {
    const ctx = document.getElementById('emotionalTrendsChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
    }
    
    // Prepare data
    const labels = trends.map(t => this.formatChartDate(t.date));
    const anxietyData = trends.map(t => t.avg_anxiety);
    const agitationData = trends.map(t => t.avg_agitation);
    const confusionData = trends.map(t => t.avg_confusion);
    const comfortData = trends.map(t => t.avg_comfort);
    
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Anxiety Level',
            data: anxietyData,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            tension: 0.3,
            fill: false
          },
          {
            label: 'Agitation Level',
            data: agitationData,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            tension: 0.3,
            fill: false
          },
          {
            label: 'Confusion Level',
            data: confusionData,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            tension: 0.3,
            fill: false
          },
          {
            label: 'Comfort Level',
            data: comfortData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.3,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 20
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              title: (tooltipItems) => {
                const index = tooltipItems[0].dataIndex;
                return this.formatTooltipDate(trends[index].date);
              },
              afterBody: (tooltipItems) => {
                const index = tooltipItems[0].dataIndex;
                const trend = trends[index];
                return `Conversations: ${trend.conversation_count || 0}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 10,
            title: {
              display: true,
              text: 'Level (0-10 scale)'
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          },
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    });
  }
  
  // Helper methods
  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }
  
  updateLastRefreshTime() {
    this.lastUpdateTime = new Date();
    const element = document.getElementById('lastUpdated');
    if (element) {
      element.textContent = `Updated: ${this.formatTime(this.lastUpdateTime)}`;
    }
  }
  
  hideChartLoading() {
    const loading = document.getElementById('chartLoading');
    if (loading) {
      loading.style.display = 'none';
    }
  }
  
  showChartError() {
    const loading = document.getElementById('chartLoading');
    if (loading) {
      loading.innerHTML = `
        <div class="error-icon">⚠️</div>
        <span>Failed to load chart data</span>
      `;
    }
  }
  
  showError(message) {
    // You could implement a toast notification system here
    console.error('Dashboard Error:', message);
  }
  
  getEmotionalStateIcon(emotionalState) {
    const icons = {
      'comfortable': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM229.4 385.9C249.8 413.9 282.8 432 320 432C357.2 432 390.2 413.9 410.6 385.9C418.4 375.2 433.4 372.8 444.1 380.6C454.8 388.4 457.2 403.4 449.4 414.1C420.3 454 373.2 480 320 480C266.8 480 219.7 454 190.6 414.1C182.8 403.4 185.2 388.4 195.9 380.6C206.6 372.8 221.6 375.2 229.4 385.9zM208 272C208 254.3 222.3 240 240 240C257.7 240 272 254.3 272 272C272 289.7 257.7 304 240 304C222.3 304 208 289.7 208 272zM400 240C417.7 240 432 254.3 432 272C432 289.7 417.7 304 400 304C382.3 304 368 289.7 368 272C368 254.3 382.3 240 400 240z"/></svg>',
      'neutral': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM320 368C346.5 368 368 389.5 368 416L368 448C368 474.5 346.5 496 320 496C293.5 496 272 474.5 272 448L272 416C272 389.5 293.5 368 320 368zM208 288C208 270.3 222.3 256 240 256C257.7 256 272 270.3 272 288C272 305.7 257.7 320 240 320C222.3 320 208 305.7 208 288zM400 256C417.7 256 432 270.3 432 288C432 305.7 417.7 320 400 320C382.3 320 368 305.7 368 288C368 270.3 382.3 256 400 256zM256 196C251.8 196 247.6 196.3 243.5 196.8C223.2 199.5 204.6 208.7 189.7 222.6C181.6 230.1 169 229.7 161.4 221.6C153.8 213.5 154.3 200.9 162.4 193.3C183 174 209.2 160.9 238.3 157.1C244.1 156.3 250 155.9 256 155.9C267 155.9 276 164.9 276 175.9C276 186.9 267 195.9 256 195.9zM396.5 196.8C392.4 196.3 388.2 196 384 196C373 196 364 187 364 176C364 165 373 156 384 156C390 156 395.9 156.4 401.7 157.2C430.8 161 457 174.2 477.6 193.4C485.7 200.9 486.1 213.6 478.6 221.7C471.1 229.8 458.4 230.2 450.3 222.7C435.4 208.8 416.8 199.6 396.5 196.9z"/></svg>',
      'distressed': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM189.8 276.3C183.6 271.1 182.2 262 186.7 255.2C191.2 248.4 200 246 207.3 249.7L286.9 289.7C292.3 292.4 295.7 297.9 295.7 304C295.7 310.1 292.3 315.6 286.9 318.3L207.3 358.3C200 361.9 191.2 359.6 186.7 352.8C182.2 346 183.6 336.9 189.8 331.7L223 304L189.8 276.3zM453.4 255.2C457.9 262 456.5 271.1 450.3 276.3L417 304L450.2 331.7C456.4 336.9 457.8 346 453.3 352.8C448.8 359.6 440 362 432.7 358.3L353.1 318.3C347.7 315.6 344.3 310.1 344.3 304C344.3 297.9 347.7 292.4 353.1 289.7L432.7 249.7C440 246.1 448.8 248.4 453.3 255.2zM292.5 408.4L320 430.4L347.5 408.4C354.3 403 363.8 402.5 371.1 407.4L411 434L425.7 429.1C436.2 425.6 447.5 431.3 451 441.7C454.5 452.1 448.8 463.5 438.4 467L414.4 475C408.5 477 402.1 476.1 397 472.7L361.2 448.8L332.6 471.7C325.3 477.5 314.9 477.5 307.6 471.7L279 448.8L243.2 472.7C238.1 476.1 231.6 477 225.8 475L201.8 467C191.3 463.5 185.7 452.2 189.2 441.7C192.7 431.2 204 425.6 214.5 429.1L229.2 434L269.1 407.4C276.3 402.6 285.9 403 292.7 408.4z"/></svg>'
    };
    
    return icons[emotionalState] || icons.neutral;
  }

  getAlertIcon(type) {
    const icons = {
      'error': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                 <circle cx="12" cy="12" r="10"/>
                 <line x1="15" y1="9" x2="9" y2="15"/>
                 <line x1="9" y1="9" x2="15" y2="15"/>
               </svg>`,
      'warning': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                   <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                   <line x1="12" y1="9" x2="12" y2="13"/>
                   <line x1="12" y1="17" x2="12.01" y2="17"/>
                 </svg>`,
      'info': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>`
    };
    
    return icons[type] || icons.info;
  }
  
  formatDateTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const _yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // Calculate days difference
    const daysDiff = Math.floor((today.getTime() - dateOnly.getTime()) / (24 * 60 * 60 * 1000));
    
    // Format time as "9:22 AM"
    const timeStr = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
    
    // Determine prefix based on date
    if (daysDiff === 0) {
      return `Today ${timeStr}`;
    } else if (daysDiff === 1) {
      return `Yesterday ${timeStr}`;
    } else if (daysDiff <= 7) {
      // Show day of week for this week (Monday, Tuesday, etc.)
      const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
      return `${dayName} ${timeStr}`;
    } else {
      // More than 7 days ago - use original format (Aug 22, 7:43 PM)
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(date);
    }
  }
  
  formatTime(date) {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  }
  
  formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes}m ago`;
    } else {
      return 'Just now';
    }
  }
  
  formatChartDate(dateStr) {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  }
  
  formatTooltipDate(dateStr) {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  }
  
  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    if (this.chart) {
      this.chart.destroy();
    }
  }
}

// Initialize dashboard when DOM is ready
console.log('Dashboard script loaded, document ready state:', document.readyState);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded, initializing dashboard');
    window.dashboard = new Dashboard();
  });
} else {
  console.log('Document already ready, initializing dashboard immediately');
  window.dashboard = new Dashboard();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.dashboard) {
    window.dashboard.destroy();
  }
});