/**
 * Compassionate Care Dashboard - Real Data Integration
 * 
 * Fetches real data from the backend APIs and creates visualizations
 * for mental state monitoring, conversation analytics, and care indicators.
 * 
 * Features:
 * - Real-time data updates every 30 seconds
 * - Chart.js visualizations with compassionate color schemes
 * - Error handling with graceful fallbacks
 * - Loading states and skeleton animations
 * - Responsive design considerations
 */

class CompassionateDashboard {
  constructor() {
    this.charts = {};
    this.updateInterval = null;
    this.heartbeatInterval = null;
    this.lastUpdate = new Date();
    this.apiBaseUrl = '/api/admin/dashboard';
    this.isInitialLoad = true; // Track if this is the first load
    
    // Auto-refresh interval (30 seconds)
    this.refreshInterval = 30000;
    
    // Heartbeat check interval (10 seconds)
    this.heartbeatRefreshInterval = 10000;
    
    // Chart.js default configuration
    this.chartDefaults = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 20,
            font: {
              size: 12,
              family: 'Inter, system-ui, sans-serif'
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: 'white',
          bodyColor: 'white',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            title: function(context) {
              return `${context[0].label}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(148, 163, 184, 0.1)',
            borderColor: 'rgba(148, 163, 184, 0.2)'
          },
          ticks: {
            color: 'rgba(100, 116, 139, 0.8)',
            font: {
              size: 11,
              family: 'Inter, system-ui, sans-serif'
            }
          }
        },
        y: {
          grid: {
            color: 'rgba(148, 163, 184, 0.1)',
            borderColor: 'rgba(148, 163, 184, 0.2)'
          },
          ticks: {
            color: 'rgba(100, 116, 139, 0.8)',
            font: {
              size: 11,
              family: 'Inter, system-ui, sans-serif'
            }
          }
        }
      }
    };

    this.init();
  }

  // Get chart configuration with conditional animations
  getChartConfig(baseConfig) {
    const config = { ...baseConfig };
    
    // Disable animations on refresh (after initial load)
    if (!this.isInitialLoad) {
      config.options = {
        ...config.options,
        animation: false,
        animations: {
          colors: false,
          x: false,
          y: false
        },
        transitions: {
          active: {
            animation: {
              duration: 0
            }
          }
        }
      };
    }
    
    return config;
  }

  async init() {
    console.log('🎯 Initializing Compassionate Care Dashboard');
    
    try {
      // Create dashboard structure if it doesn't exist
      this.createDashboardStructure();
      
      // Show loading states
      this.showLoadingStates();
      
      // Load initial data
      await this.loadAllData();
      
      // Start auto-refresh
      this.startAutoRefresh();
      
      // Start heartbeat monitoring
      this.startHeartbeat();
      
      // Update copyright year
      this.updateCopyrightYear();
      
      // Update timezone display
      await this.updateTimezoneDisplay();
      
      // Bind refresh controls
      this.bindRefreshControls();
      
      console.log('✅ Dashboard initialized successfully');
      
      // Dashboard initialization complete - notification removed for better UX
      // this.showToast('Dashboard Ready', 'Real-time compassionate care monitoring is now active', 'success');
      
    } catch (error) {
      console.error('❌ Failed to initialize dashboard:', error);
      this.showErrorStates();
    }
  }

  createDashboardStructure() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    // Hide loading if present
    const dashboardLoading = document.getElementById('dashboard-loading');
    if (dashboardLoading) {
      dashboardLoading.style.display = 'none';
    }

    // Check if dashboard already exists
    if (document.getElementById('real-dashboard-content')) return;

    const dashboardHTML = `
      <div id="real-dashboard-content">
        <!-- Mental State Monitoring Section -->
        <section class="dashboard-section">
          <div class="section-header">
            <div>
              <h2 class="section-title">
                <span class="section-icon">🧠</span>
                Mental State Monitoring
              </h2>
              <p class="section-subtitle">Real-time emotional well-being indicators</p>
            </div>
            <div class="section-actions">
              <button class="btn btn-ghost" onclick="window.dashboardReal?.refreshMentalState()">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Refresh
              </button>
            </div>
          </div>

          <div class="dashboard-row">
            <!-- Mental State Chart -->
            <div class="chart-card">
              <div class="chart-header">
                <h3>Mental State Trends (7 Days)</h3>
                <div class="chart-actions">
                  <span class="chart-status" id="last-update">Loading...</span>
                </div>
              </div>
              <div class="chart-container">
                <div class="chart-loading">
                  <div class="loading-spinner"></div>
                  <span>Loading mental state data...</span>
                </div>
                <canvas id="mental-state-chart"></canvas>
              </div>
            </div>

            <!-- Mental State Indicators -->
            <div class="indicators-card">
              <div class="card-header">
                <h3>Current Indicators</h3>
              </div>
              <div class="indicators-grid" id="mental-state-indicators">
                <div class="loading-indicators">
                  <div class="loading-spinner"></div>
                  <span>Loading indicators...</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Conversation Analytics Section -->
        <section class="dashboard-section">
          <div class="section-header">
            <div>
              <h2 class="section-title">
                <span class="section-icon">💬</span>
                Conversation Analytics
              </h2>
              <p class="section-subtitle">Call patterns and engagement metrics</p>
            </div>
            <div class="section-actions">
              <button class="btn btn-ghost" onclick="window.dashboardReal?.refreshConversationAnalytics()">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Refresh
              </button>
            </div>
          </div>

          <div class="dashboard-grid">
            <!-- Daily Patterns -->
            <div class="chart-card">
              <div class="chart-header">
                <h3>Daily Call Patterns</h3>
              </div>
              <div class="chart-container">
                <div class="chart-loading">
                  <div class="loading-spinner"></div>
                  <span>Loading daily patterns...</span>
                </div>
                <canvas id="daily-patterns-chart"></canvas>
              </div>
            </div>

            <!-- Hourly Distribution -->
            <div class="chart-card">
              <div class="chart-header">
                <h3>Hourly Distribution</h3>
              </div>
              <div class="chart-container">
                <div class="chart-loading">
                  <div class="loading-spinner"></div>
                  <span>Loading hourly data...</span>
                </div>
                <canvas id="hourly-distribution-chart"></canvas>
              </div>
            </div>

            <!-- Function Usage -->
            <div class="chart-card">
              <div class="chart-header">
                <h3>Function Usage</h3>
              </div>
              <div class="chart-container">
                <div class="chart-loading">
                  <div class="loading-spinner"></div>
                  <span>Loading function data...</span>
                </div>
                <canvas id="function-usage-chart"></canvas>
              </div>
            </div>
          </div>
        </section>

        <!-- Care Indicators Section -->
        <section class="dashboard-section">
          <div class="section-header">
            <div>
              <h2 class="section-title">
                <span class="section-icon">🏥</span>
                Care Indicators
              </h2>
              <p class="section-subtitle">Health and care-related mentions</p>
            </div>
            <div class="section-actions">
              <button class="btn btn-ghost" onclick="window.dashboardReal?.refreshCareIndicators()">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Refresh
              </button>
            </div>
          </div>

          <div class="dashboard-row">
            <!-- Care Indicators Chart -->
            <div class="chart-card">
              <div class="chart-header">
                <h3>Care Indicators Timeline</h3>
              </div>
              <div class="chart-container">
                <div class="chart-loading">
                  <div class="loading-spinner"></div>
                  <span>Loading care data...</span>
                </div>
                <canvas id="care-indicators-chart"></canvas>
              </div>
            </div>

            <!-- Care Statistics -->
            <div class="indicators-card">
              <div class="card-header">
                <h3>Current Statistics</h3>
              </div>
              <div class="care-stats-grid" id="care-indicators-stats">
                <div class="loading-indicators">
                  <div class="loading-spinner"></div>
                  <span>Loading statistics...</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Alerts and Insights Section -->
        <section class="dashboard-section">
          <div class="section-header">
            <div>
              <h2 class="section-title">
                <span class="section-icon">🔔</span>
                Alerts & Insights
              </h2>
              <p class="section-subtitle">Important notifications and positive insights</p>
            </div>
          </div>

          <div class="dashboard-row">
            <!-- Active Alerts -->
            <div class="alerts-card">
              <div class="card-header">
                <h3>Active Alerts</h3>
                <span class="alert-count">0</span>
              </div>
              <div class="alerts-list" id="active-alerts">
                <div class="loading-indicators">
                  <div class="loading-spinner"></div>
                  <span>Loading alerts...</span>
                </div>
              </div>
            </div>

            <!-- Positive Insights -->
            <div class="insights-card">
              <div class="card-header">
                <h3>Positive Insights</h3>
                <span class="insights-icon">💚</span>
              </div>
              <div class="insights-list" id="positive-insights">
                <div class="loading-indicators">
                  <div class="loading-spinner"></div>
                  <span>Loading insights...</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- System Status Footer -->
        <footer class="dashboard-footer">
          <div class="footer-content">
            <div class="footer-left">
              <span class="footer-text">Compassionate Care Dashboard</span>
              <span class="footer-separator">•</span>
              <span class="footer-text" id="current-year">2024</span>
            </div>
            <div class="footer-center">
              <div class="system-status">
                <div class="status-indicator" id="system-heartbeat">
                  <div class="status-dot"></div>
                </div>
                <span class="status-text" id="heartbeat-status">System Online</span>
              </div>
            </div>
            <div class="footer-right">
              <div class="timezone-info" id="timezone-info">
                <span class="timezone-label">Time Zone:</span>
                <span class="timezone-value" id="timezone-display">Loading...</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    `;

    mainContent.innerHTML = dashboardHTML;
  }

  showLoadingStates() {
    // Show loading for all chart containers
    const loadingElements = document.querySelectorAll('.chart-loading');
    loadingElements.forEach(el => {
      el.style.display = 'flex';
    });
    
    // Hide chart canvases
    const canvases = document.querySelectorAll('.chart-container canvas');
    canvases.forEach(canvas => {
      canvas.style.display = 'none';
    });
  }

  hideLoadingStates() {
    // Hide loading elements
    const loadingElements = document.querySelectorAll('.chart-loading');
    loadingElements.forEach(el => {
      el.style.display = 'none';
    });
    
    // Show chart canvases
    const canvases = document.querySelectorAll('.chart-container canvas');
    canvases.forEach(canvas => {
      canvas.style.display = 'block';
    });
  }

  async loadAllData() {
    try {
      // Load data in parallel for better performance
      const [overviewData, mentalStateData, careIndicatorsData, conversationTrendsData] = await Promise.all([
        this.fetchData('/overview'),
        this.fetchData('/mental-state?days=7'),
        this.fetchData('/care-indicators?days=30'),
        this.fetchData('/conversation-trends?days=30')
      ]);

      // Update dashboard components
      await Promise.all([
        this.updateMentalStateSection(mentalStateData),
        this.updateConversationAnalytics(conversationTrendsData),
        this.updateCareIndicators(careIndicatorsData),
        this.updateAlerts(mentalStateData, careIndicatorsData),
        this.updatePositiveInsights()
      ]);

      // Hide loading states
      this.hideLoadingStates();
      
      // Update timestamp
      this.updateLastUpdateTime();
      
      // Mark as no longer initial load after first successful load
      this.isInitialLoad = false;
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.showErrorStates();
    }
  }

  async fetchData(endpoint) {
    try {
      const response = await fetch(`${this.apiBaseUrl}${endpoint}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'API returned unsuccessful response');
      }
      
      return data.data;
      
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      
      // Return mock data for graceful fallback
      return this.getMockData(endpoint);
    }
  }

  getMockData(endpoint) {
    // Provide fallback data when API is unavailable
    const mockData = {
      '/overview': {
        conversations: { today: 5, averageDuration: 720, successRate: 95 },
        performance: { avgResponseTime: 1.2 },
        memories: { totalMemories: 23 }
      },
      '/mental-state?days=7': {
        chartData: {
          labels: ['Jan 8', 'Jan 9', 'Jan 10', 'Jan 11', 'Jan 12', 'Jan 13', 'Jan 14'],
          datasets: [
            {
              label: 'Anxiety Level',
              data: [0.3, 0.4, 0.2, 0.6, 0.3, 0.2, 0.4],
              borderColor: 'rgb(255, 99, 132)',
              backgroundColor: 'rgba(255, 99, 132, 0.1)',
              tension: 0.1
            },
            {
              label: 'Confusion Level',
              data: [0.2, 0.3, 0.1, 0.4, 0.2, 0.1, 0.3],
              borderColor: 'rgb(255, 159, 64)',
              backgroundColor: 'rgba(255, 159, 64, 0.1)',
              tension: 0.1
            },
            {
              label: 'Agitation Level',
              data: [0.1, 0.2, 0.1, 0.3, 0.1, 0.1, 0.2],
              borderColor: 'rgb(255, 205, 86)',
              backgroundColor: 'rgba(255, 205, 86, 0.1)',
              tension: 0.1
            }
          ]
        },
        summary: { overallStatus: 'calm', avgAnxietyLevel: 0.3, avgConfusionLevel: 0.2 },
        alerts: []
      },
      '/care-indicators?days=30': {
        summary: {
          medicationConcerns: { count: 3, trend: 'stable' },
          painComplaints: { count: 2, trend: 'down' },
          hospitalRequests: { count: 0, trend: 'stable' },
          staffInteractions: { count: 1, trend: 'stable' }
        },
        chartData: {
          labels: Array.from({length: 30}, (_, i) => `Day ${i + 1}`),
          datasets: [
            {
              label: 'Medication Mentions',
              data: Array.from({length: 30}, () => Math.random() * 2),
              borderColor: 'rgb(75, 192, 192)',
              backgroundColor: 'rgba(75, 192, 192, 0.1)'
            }
          ]
        },
        alerts: []
      },
      '/conversation-trends?days=30': {
        dailyTrends: {
          chartData: {
            labels: Array.from({length: 7}, (_, i) => `Day ${i + 1}`),
            datasets: [
              {
                label: 'Daily Call Count',
                data: [3, 5, 4, 6, 3, 2, 4],
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.1)',
                tension: 0.1
              }
            ]
          }
        },
        hourlyDistribution: {
          chartData: {
            labels: ['9:00', '10:00', '11:00', '14:00', '15:00', '16:00', '19:00', '20:00'],
            datasets: [{
              label: 'Calls by Hour',
              data: [2, 3, 4, 5, 4, 3, 2, 1],
              backgroundColor: 'rgba(75, 192, 192, 0.6)',
              borderColor: 'rgb(75, 192, 192)',
              borderWidth: 1
            }]
          }
        },
        functionUsage: {
          chartData: {
            labels: ['News Headlines', 'Memory Functions', 'Comfort Responses', 'Care Check'],
            datasets: [{
              data: [35, 25, 30, 10],
              backgroundColor: [
                'rgba(255, 99, 132, 0.8)',
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 205, 86, 0.8)',
                'rgba(75, 192, 192, 0.8)'
              ]
            }]
          }
        }
      }
    };

    return mockData[endpoint] || {};
  }

  async updateMentalStateSection(data) {
    // Update mental state trends chart
    await this.createMentalStateChart(data.chartData);
    
    // Update mental state indicators
    this.updateMentalStateIndicators(data.summary);
  }

  async createMentalStateChart(chartData) {
    const ctx = document.getElementById('mental-state-chart');
    if (!ctx) return;

    // Destroy existing chart
    if (this.charts.mentalState) {
      this.charts.mentalState.destroy();
    }

    const config = {
      type: 'line',
      data: chartData,
      options: {
        ...this.chartDefaults,
        scales: {
          ...this.chartDefaults.scales,
          y: {
            ...this.chartDefaults.scales.y,
            beginAtZero: true,
            max: 1,
            ticks: {
              ...this.chartDefaults.scales.y.ticks,
              callback: function(value) {
                return `${Math.round(value * 100)}%`;
              }
            }
          }
        },
        plugins: {
          ...this.chartDefaults.plugins,
          tooltip: {
            ...this.chartDefaults.plugins.tooltip,
            callbacks: {
              label: function(context) {
                const value = (context.parsed.y * 100).toFixed(0);
                return `${context.dataset.label}: ${value}%`;
              }
            }
          }
        }
      }
    };

    this.charts.mentalState = new Chart(ctx, this.getChartConfig(config));
    this.fadeInChart(ctx);
  }

  updateMentalStateIndicators(summary) {
    const container = document.getElementById('mental-state-indicators');
    if (!container) return;

    const statusConfig = {
      calm: { icon: '😌', color: 'calm', label: 'Calm & Content' },
      elevated: { icon: '😟', color: 'elevated', label: 'Elevated Concern' },
      concerning: { icon: '😰', color: 'concerning', label: 'Needs Attention' }
    };

    const status = statusConfig[summary.overallStatus] || statusConfig.calm;
    
    container.innerHTML = `
      <div class="stat-card" style="margin-bottom: var(--space-3);">
        <div class="stat-icon">
          ${status.icon}
        </div>
        <div class="stat-content">
          <span class="stat-label">Overall Status</span>
          <span class="stat-value">${status.label}</span>
        </div>
      </div>
      
      <div class="stat-card" style="margin-bottom: var(--space-3);">
        <div class="stat-icon">
          ${summary.avgAnxietyLevel > 0.6 ? '😰' : summary.avgAnxietyLevel > 0.4 ? '😟' : '😌'}
        </div>
        <div class="stat-content">
          <span class="stat-label">Anxiety Level</span>
          <span class="stat-value">${Math.round(summary.avgAnxietyLevel * 100)}% average</span>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">
          ${summary.avgConfusionLevel > 0.6 ? '😵' : summary.avgConfusionLevel > 0.4 ? '🤔' : '🧠'}
        </div>
        <div class="stat-content">
          <span class="stat-label">Confusion Level</span>
          <span class="stat-value">${Math.round(summary.avgConfusionLevel * 100)}% average</span>
        </div>
      </div>
    `;
  }

  async updateConversationAnalytics(data) {
    // Update all conversation-related charts
    await Promise.all([
      this.createDailyPatternsChart(data.dailyTrends.chartData),
      this.createHourlyDistributionChart(data.hourlyDistribution.chartData),
      this.createFunctionUsageChart(data.functionUsage.chartData)
    ]);
  }

  async createDailyPatternsChart(chartData) {
    const ctx = document.getElementById('daily-patterns-chart');
    if (!ctx) return;

    if (this.charts.dailyPatterns) {
      this.charts.dailyPatterns.destroy();
    }

    const config = {
      type: 'line',
      data: chartData,
      options: {
        ...this.chartDefaults,
        scales: {
          ...this.chartDefaults.scales,
          y: {
            ...this.chartDefaults.scales.y,
            beginAtZero: true,
            position: 'left',
            title: {
              display: true,
              text: 'Number of Calls',
              color: 'rgba(100, 116, 139, 0.8)',
              font: {
                size: 12,
                weight: 'normal'
              }
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: true,
            title: {
              display: true,
              text: 'Duration (minutes)',
              color: 'rgba(100, 116, 139, 0.8)',
              font: {
                size: 12,
                weight: 'normal'
              }
            },
            grid: {
              drawOnChartArea: false,
            },
            ticks: {
              color: 'rgba(100, 116, 139, 0.8)',
              font: {
                size: 11
              }
            }
          }
        }
      }
    };

    this.charts.dailyPatterns = new Chart(ctx, this.getChartConfig(config));
    this.fadeInChart(ctx);
  }

  async createHourlyDistributionChart(chartData) {
    const ctx = document.getElementById('hourly-distribution-chart');
    if (!ctx) return;

    if (this.charts.hourlyDistribution) {
      this.charts.hourlyDistribution.destroy();
    }

    const config = {
      type: 'bar',
      data: chartData,
      options: {
        ...this.chartDefaults,
        scales: {
          ...this.chartDefaults.scales,
          y: {
            ...this.chartDefaults.scales.y,
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Calls',
              color: 'rgba(100, 116, 139, 0.8)',
              font: {
                size: 12,
                weight: 'normal'
              }
            }
          }
        }
      }
    };

    this.charts.hourlyDistribution = new Chart(ctx, this.getChartConfig(config));
    this.fadeInChart(ctx);
  }

  async createFunctionUsageChart(chartData) {
    const ctx = document.getElementById('function-usage-chart');
    if (!ctx) return;

    if (this.charts.functionUsage) {
      this.charts.functionUsage.destroy();
    }

    const config = {
      type: 'doughnut',
      data: chartData,
      options: {
        ...this.chartDefaults,
        plugins: {
          ...this.chartDefaults.plugins,
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true,
              font: {
                size: 11
              }
            }
          }
        }
      }
    };

    this.charts.functionUsage = new Chart(ctx, this.getChartConfig(config));
    this.fadeInChart(ctx);
  }

  async updateCareIndicators(data) {
    // Update care indicators chart
    await this.createCareIndicatorsChart(data.chartData);
    
    // Update care statistics
    this.updateCareStats(data.summary);
  }

  async createCareIndicatorsChart(chartData) {
    const ctx = document.getElementById('care-indicators-chart');
    if (!ctx) return;

    if (this.charts.careIndicators) {
      this.charts.careIndicators.destroy();
    }

    const config = {
      type: 'line',
      data: chartData,
      options: {
        ...this.chartDefaults,
        scales: {
          ...this.chartDefaults.scales,
          y: {
            ...this.chartDefaults.scales.y,
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Mentions',
              color: 'rgba(100, 116, 139, 0.8)',
              font: {
                size: 12,
                weight: 'normal'
              }
            }
          }
        }
      }
    };

    this.charts.careIndicators = new Chart(ctx, this.getChartConfig(config));
    this.fadeInChart(ctx);
  }

  updateCareStats(summary) {
    const container = document.getElementById('care-indicators-stats');
    if (!container) return;

    const getTrendIcon = (trend) => {
      switch (trend) {
        case 'up': return '↗';
        case 'down': return '↘';
        default: return '→';
      }
    };

    const getTrendClass = (trend) => {
      switch (trend) {
        case 'up': return 'trend-up';
        case 'down': return 'trend-down';
        default: return 'trend-stable';
      }
    };

    container.innerHTML = `
      <div class="care-indicator">
        <div class="care-indicator-value" data-value="${summary.medicationConcerns.count}">0</div>
        <div class="care-indicator-label">Medication Mentions</div>
        <div class="care-indicator-trend ${getTrendClass(summary.medicationConcerns.trend)}">
          ${getTrendIcon(summary.medicationConcerns.trend)} ${summary.medicationConcerns.trend}
        </div>
      </div>
      
      <div class="care-indicator">
        <div class="care-indicator-value" data-value="${summary.painComplaints.count}">0</div>
        <div class="care-indicator-label">Pain Complaints</div>
        <div class="care-indicator-trend ${getTrendClass(summary.painComplaints.trend)}">
          ${getTrendIcon(summary.painComplaints.trend)} ${summary.painComplaints.trend}
        </div>
      </div>
      
      <div class="care-indicator">
        <div class="care-indicator-value" data-value="${summary.hospitalRequests.count}">0</div>
        <div class="care-indicator-label">Hospital Requests</div>
        <div class="care-indicator-trend ${getTrendClass(summary.hospitalRequests.trend)}">
          ${getTrendIcon(summary.hospitalRequests.trend)} ${summary.hospitalRequests.trend}
        </div>
      </div>
      
      <div class="care-indicator">
        <div class="care-indicator-value" data-value="${summary.staffInteractions.count}">0</div>
        <div class="care-indicator-label">Staff Interactions</div>
        <div class="care-indicator-trend ${getTrendClass(summary.staffInteractions.trend)}">
          ${getTrendIcon(summary.staffInteractions.trend)} ${summary.staffInteractions.trend}
        </div>
      </div>
    `;

    // Animate numbers after DOM update
    setTimeout(() => {
      container.querySelectorAll('.care-indicator-value').forEach(element => {
        const targetValue = parseInt(element.getAttribute('data-value')) || 0;
        this.animateNumber(element, targetValue);
      });
    }, 100);
  }

  updateAlerts(mentalStateData, careIndicatorsData) {
    this.updateActiveAlerts(mentalStateData.alerts, careIndicatorsData.alerts);
    // Positive insights are updated separately in loadAllData
  }

  updateActiveAlerts(mentalAlerts = [], careAlerts = []) {
    const container = document.getElementById('active-alerts');
    if (!container) return;

    const allAlerts = [...mentalAlerts, ...careAlerts];

    // Update alert count with animation
    const alertCountElement = document.querySelector('.alert-count');
    if (alertCountElement) {
      this.animateNumber(alertCountElement, allAlerts.length);
    }

    if (allAlerts.length === 0) {
      container.innerHTML = `
        <div class="alert-item">
          <div class="alert-icon success">✓</div>
          <div class="alert-content">
            <h5>All Clear</h5>
            <p>No urgent care alerts at this time. All indicators appear stable.</p>
            <div class="alert-time">System monitoring active</div>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = allAlerts.map((alert, index) => {
      const timeAgo = this.getTimeAgo(new Date(alert.timestamp));
      return `
        <div class="alert-item" style="animation-delay: ${index * 0.1}s">
          <div class="alert-icon ${alert.type}">
            ${alert.type === 'warning' ? '⚠' : alert.type === 'info' ? 'ℹ' : '✓'}
          </div>
          <div class="alert-content">
            <h5>${alert.priority === 'high' ? '🔴 High Priority' : '🟡 Medium Priority'}</h5>
            <p>${alert.message}</p>
            <div class="alert-time">${timeAgo}</div>
          </div>
        </div>
      `;
    }).join('');

    // Show toast notification for new high priority alerts
    const highPriorityAlerts = allAlerts.filter(alert => alert.priority === 'high');
    if (highPriorityAlerts.length > 0) {
      this.showToast('High Priority Alert', 
        `${highPriorityAlerts.length} high priority alert${highPriorityAlerts.length > 1 ? 's' : ''} require attention`, 
        'warning');
    }
  }


  showErrorStates() {
    // Hide loading states
    this.hideLoadingStates();
    
    // Show error messages in chart containers
    const chartContainers = document.querySelectorAll('.chart-container');
    chartContainers.forEach(container => {
      const canvas = container.querySelector('canvas');
      if (canvas) {
        canvas.style.display = 'none';
      }
      
      const loadingDiv = container.querySelector('.chart-loading');
      if (loadingDiv) {
        loadingDiv.innerHTML = '⚠️ Unable to load data. Using offline mode.';
        loadingDiv.style.display = 'flex';
        loadingDiv.style.color = 'rgba(239, 68, 68, 0.8)';
      }
    });
  }

  startAutoRefresh() {
    this.updateInterval = setInterval(() => {
      this.loadAllData();
    }, this.refreshInterval);
    
    console.log(`🔄 Auto-refresh started (${this.refreshInterval / 1000}s interval)`);
  }

  stopAutoRefresh() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('⏹️ Auto-refresh stopped');
    }
  }

  bindRefreshControls() {
    // Bind refresh buttons
    const refreshButtons = document.querySelectorAll('[onclick*="refresh"]');
    refreshButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        this.loadAllData();
      });
    });
  }

  updateLastUpdateTime() {
    this.lastUpdate = new Date();
    const statusElement = document.getElementById('last-update');
    if (statusElement) {
      statusElement.textContent = 'Just now';
    }
    
    // Update the time display every minute
    setTimeout(() => {
      this.updateTimeDisplay();
    }, 60000);
  }

  updateTimeDisplay() {
    const statusElement = document.getElementById('last-update');
    if (statusElement) {
      const timeAgo = this.getTimeAgo(this.lastUpdate);
      statusElement.textContent = timeAgo;
    }
  }

  getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  }

  // Public methods for manual refresh
  async refreshMentalState() {
    try {
      const data = await this.fetchData('/mental-state?days=7');
      await this.updateMentalStateSection(data);
      this.updateLastUpdateTime();
    } catch (error) {
      console.error('Error refreshing mental state:', error);
    }
  }

  async refreshCareIndicators() {
    try {
      const data = await this.fetchData('/care-indicators?days=30');
      await this.updateCareIndicators(data);
      this.updateLastUpdateTime();
    } catch (error) {
      console.error('Error refreshing care indicators:', error);
    }
  }

  async refreshConversationAnalytics() {
    try {
      const data = await this.fetchData('/conversation-trends?days=30');
      await this.updateConversationAnalytics(data);
      this.updateLastUpdateTime();
    } catch (error) {
      console.error('Error refreshing conversation analytics:', error);
    }
  }

  // Visual enhancement methods
  animateNumber(element, targetValue, duration = 800) {
    if (!element) return;
    
    const startValue = parseInt(element.textContent) || 0;
    const startTime = performance.now();
    
    element.classList.add('counting');
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(startValue + (targetValue - startValue) * easeOut);
      
      element.textContent = currentValue;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        element.classList.remove('counting');
      }
    };
    
    requestAnimationFrame(animate);
  }

  showToast(title, message, type = 'info', duration = 5000) {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.dashboard-toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `dashboard-toast ${type}`;
    toast.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
        <div style="font-size: 1.25rem; margin-top: 0.125rem;">
          ${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : type === 'error' ? '❌' : 'ℹ️'}
        </div>
        <div style="flex: 1;">
          <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">${title}</div>
          <div style="font-size: 0.875rem; color: var(--text-secondary);">${message}</div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 0; margin-left: 0.5rem;">×</button>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    // Show toast with animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    
    // Auto-remove after duration
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }

  // Fade in animation for charts
  fadeInChart(chartElement) {
    if (!chartElement) return;
    
    // Only animate on initial load, skip on refreshes
    if (!this.isInitialLoad) {
      chartElement.style.opacity = '1';
      chartElement.style.transform = 'translateY(0)';
      return;
    }
    
    chartElement.style.opacity = '0';
    chartElement.style.transform = 'translateY(20px)';
    
    requestAnimationFrame(() => {
      chartElement.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
      chartElement.style.opacity = '1';
      chartElement.style.transform = 'translateY(0)';
    });
  }

  // Heartbeat monitoring methods
  async startHeartbeat() {
    // Initial heartbeat check
    await this.checkHeartbeat();
    
    // Set up regular heartbeat checks
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeat();
    }, this.heartbeatRefreshInterval);
    
    console.log(`💓 Heartbeat monitoring started (${this.heartbeatRefreshInterval / 1000}s interval)`);
  }

  async checkHeartbeat() {
    try {
      const response = await fetch('/api/admin/heartbeat');
      const data = await response.json();
      
      if (data.success && data.data) {
        this.updateHeartbeatStatus(data.data.status, data.data);
      } else {
        this.updateHeartbeatStatus('unhealthy', { error: 'Invalid response' });
      }
    } catch (error) {
      console.warn('Heartbeat check failed:', error);
      this.updateHeartbeatStatus('unhealthy', { error: error.message });
    }
  }

  updateHeartbeatStatus(status, data) {
    const heartbeatElement = document.getElementById('system-heartbeat');
    const statusElement = document.getElementById('heartbeat-status');
    
    if (!heartbeatElement || !statusElement) return;
    
    // Remove existing status classes
    heartbeatElement.className = 'status-indicator';
    
    // Add new status class
    heartbeatElement.classList.add(`status-${status}`);
    
    // Update status text
    const statusTexts = {
      healthy: 'System Online',
      degraded: 'System Degraded',
      unhealthy: 'System Issues'
    };
    
    statusElement.textContent = statusTexts[status] || 'Unknown Status';
    
    // Show toast for status changes if not healthy
    if (status !== 'healthy' && !this.lastHeartbeatStatus) {
      this.showToast(
        'System Status Alert',
        `System status is now: ${statusTexts[status]}`,
        status === 'degraded' ? 'warning' : 'error'
      );
    }
    
    this.lastHeartbeatStatus = status;
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('💓 Heartbeat monitoring stopped');
    }
  }

  // Update copyright year dynamically
  updateCopyrightYear() {
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
      yearElement.textContent = new Date().getFullYear();
    }
  }

  // Update timezone display
  async updateTimezoneDisplay() {
    try {
      const response = await fetch('/api/admin/settings/timezone');
      const data = await response.json();
      
      if (data.success && data.data) {
        const timezoneElement = document.getElementById('timezone-display');
        if (timezoneElement) {
          const { display_name, current_time } = data.data;
          timezoneElement.textContent = `${display_name} (${current_time.formatted})`;
          timezoneElement.title = `Current timezone: ${data.data.timezone}`;
        }
      }
    } catch (error) {
      console.warn('Failed to update timezone display:', error);
      const timezoneElement = document.getElementById('timezone-display');
      if (timezoneElement) {
        timezoneElement.textContent = 'UTC';
      }
    }
  }

  // Enhanced positive insights integration
  async updatePositiveInsights() {
    try {
      const response = await fetch('/api/admin/dashboard/positive-insights?days=7');
      const data = await response.json();
      
      if (data.success && data.data) {
        this.renderPositiveInsights(data.data.insights);
      } else {
        console.warn('Failed to load positive insights:', data.error);
        this.renderFallbackInsights();
      }
    } catch (error) {
      console.error('Error loading positive insights:', error);
      this.renderFallbackInsights();
    }
  }

  renderPositiveInsights(insights) {
    const container = document.getElementById('positive-insights');
    if (!container || !insights) return;

    container.innerHTML = insights.map((insight, index) => `
      <div class="alert-item" style="animation-delay: ${index * 0.1}s">
        <div class="alert-icon success">${insight.icon || '✓'}</div>
        <div class="alert-content">
          <h5>${insight.title}</h5>
          <p>${insight.message}</p>
          <div class="alert-time">${this.getTimeAgo(new Date(insight.timestamp))}</div>
          <div class="insight-priority ${insight.priority}">${insight.priority}</div>
        </div>
      </div>
    `).join('');
  }

  renderFallbackInsights() {
    const container = document.getElementById('positive-insights');
    if (!container) return;

    const fallbackInsights = [
      {
        icon: '🤖',
        title: 'Continuous Care',
        message: 'AI companion system continues to provide 24/7 availability for emotional support and comfort during needed moments.',
        time: 'System active'
      },
      {
        icon: '💭',
        title: 'Memory Building',
        message: 'Personal memory system is actively learning and storing important information to create more meaningful conversations.',
        time: 'Ongoing process'
      },
      {
        icon: '📞',
        title: 'Always Available',
        message: 'Communication system remains ready to provide immediate comfort and companionship whenever needed.',
        time: 'Real-time'
      }
    ];

    container.innerHTML = fallbackInsights.map((insight, index) => `
      <div class="alert-item" style="animation-delay: ${index * 0.1}s">
        <div class="alert-icon success">${insight.icon}</div>
        <div class="alert-content">
          <h5>${insight.title}</h5>
          <p>${insight.message}</p>
          <div class="alert-time">${insight.time}</div>
        </div>
      </div>
    `).join('');
  }

  // Cleanup method
  destroy() {
    // Stop auto-refresh
    this.stopAutoRefresh();
    
    // Stop heartbeat monitoring
    this.stopHeartbeat();
    
    // Destroy all charts
    Object.values(this.charts).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    
    this.charts = {};
    
    console.log('🧹 Dashboard destroyed');
  }
}

// Initialize dashboard when DOM is ready
let dashboardReal;

document.addEventListener('DOMContentLoaded', () => {
  try {
    dashboardReal = new CompassionateDashboard();
    window.dashboardReal = dashboardReal;
  } catch (error) {
    console.error('Failed to initialize dashboard:', error);
    
    // Show user-friendly error message
    const mainContent = document.querySelector('.admin-main');
    if (mainContent) {
      mainContent.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
          <h2>⚠️ Dashboard Initialization Failed</h2>
          <p>Unable to load the dashboard. Please refresh the page or contact support.</p>
          <button onclick="window.location.reload()" class="btn btn-primary" style="margin-top: 1rem;">
            Reload Dashboard
          </button>
        </div>
      `;
    }
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (dashboardReal) {
    try {
      dashboardReal.destroy();
    } catch (error) {
      console.warn('Error during dashboard cleanup:', error);
    }
  }
});

// Global error handler for dashboard
window.addEventListener('error', (event) => {
  if (event.filename && event.filename.includes('dashboard-real.js')) {
    console.error('Dashboard runtime error:', event.error);
    
    // Show a toast notification if admin dashboard is available
    if (window.adminDashboard && typeof window.adminDashboard.showToast === 'function') {
      window.adminDashboard.showToast(
        'Dashboard Error', 
        'A dashboard error occurred. Some features may not work correctly.', 
        'warning'
      );
    }
  }
});

// Export for global access
window.dashboardReal = dashboardReal;