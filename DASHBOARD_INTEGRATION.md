# Dashboard Integration Guide

This guide explains how to integrate the new real-time dashboard data service and API endpoints into the Mom & Nanny AI companion system.

## Files Created

### 1. `services/dashboard-data-service.js`
- **Purpose**: Service that queries SQLite database and aggregates conversation data for dashboard
- **Features**:
  - Real-time conversation metrics from `conversations`, `messages`, `summaries`, `analytics` tables
  - Mental state analysis using existing ConversationAnalyzer patterns
  - Care indicators (medication, pain, hospital requests) extracted from conversation data
  - Performance metrics and service health indicators
  - Memory service statistics integration
  - Optimized database queries with proper indexing

### 2. `routes/api/admin-dashboard-real.js`
- **Purpose**: REST API endpoints that serve real database data (replaces mock data)
- **Endpoints**:
  - `GET /api/admin/dashboard/overview` - Main dashboard statistics
  - `GET /api/admin/dashboard/mental-state` - Mental state indicators over time
  - `GET /api/admin/dashboard/care-indicators` - Care-related metrics
  - `GET /api/admin/dashboard/conversation-trends` - Call patterns and trends
  - `GET /api/admin/dashboard/real-time` - Real-time monitoring data
- **Features**:
  - Chart.js compatible data formatting
  - Configurable time ranges via query parameters
  - Comprehensive error handling with development details
  - Alert generation based on thresholds

## Integration Steps

### Step 1: Add the new dashboard routes to app.js

Add this line to your existing route imports in `app.js` (around line 27):

```javascript
const adminDashboardRealRouter = require('./routes/api/admin-dashboard-real');
```

Add this line to your route mounting section (around line 38):

```javascript
app.use('/api/admin/dashboard', adminDashboardRealRouter);
```

### Step 2: Update frontend dashboard to use real endpoints

Replace mock dashboard endpoints with real ones:

```javascript
// Before (mock data)
fetch('/api/admin/dashboard')

// After (real data)
fetch('/api/admin/dashboard/overview')
```

### Step 3: Handle new data structure in frontend

The new endpoints return more structured data. Update your frontend components:

```javascript
// Mental State Chart
fetch('/api/admin/dashboard/mental-state?days=7')
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // data.data.chartData is ready for Chart.js
      updateMentalStateChart(data.data.chartData);
      
      // Display alerts
      displayAlerts(data.data.alerts);
      
      // Show insights
      updateInsights(data.data.summary.keyInsights);
    }
  });

// Care Indicators
fetch('/api/admin/dashboard/care-indicators?days=30')
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      updateCareIndicators(data.data.summary);
      updateRiskAssessment(data.data.riskAssessment);
      displayRecommendations(data.data.recommendations);
    }
  });
```

## API Response Formats

### Overview Endpoint
```json
{
  "success": true,
  "data": {
    "system": { "status": "operational", "uptime": 86400 },
    "conversations": { 
      "total": 150, 
      "today": 5, 
      "thisWeek": 25,
      "averageDuration": 480,
      "successRate": 98.5
    },
    "performance": {
      "averageResponseTime": 1200,
      "transcriptionAccuracy": 96.5,
      "errorRate": 1.2
    },
    "services": {
      "database": { "status": "healthy" },
      "gpt": { "status": "healthy" }
    },
    "memories": {
      "totalMemories": 42,
      "byCategory": { "family": 15, "health": 8, "preferences": 19 }
    }
  }
}
```

### Mental State Endpoint
```json
{
  "success": true,
  "data": {
    "chartData": {
      "labels": ["Jan 1", "Jan 2", "Jan 3"],
      "datasets": [
        {
          "label": "Anxiety Level",
          "data": [0.3, 0.4, 0.2],
          "borderColor": "rgb(255, 99, 132)"
        }
      ]
    },
    "summary": {
      "overallStatus": "stable",
      "avgAnxietyLevel": 0.31,
      "keyInsights": ["Mental state appears stable and calm"]
    },
    "alerts": []
  }
}
```

### Care Indicators Endpoint
```json
{
  "success": true,
  "data": {
    "summary": {
      "medicationConcerns": { "count": 3, "trend": "stable" },
      "painComplaints": { "count": 1, "trend": "decreasing" },
      "hospitalRequests": { "count": 0, "trend": "stable" }
    },
    "riskAssessment": {
      "level": "low",
      "score": 0.2,
      "factors": []
    },
    "recommendations": [
      "Continue current care plan - indicators appear stable"
    ]
  }
}
```

## Database Requirements

The dashboard service requires the existing database schema with these tables:
- `conversations` - Call metadata and duration
- `messages` - Individual conversation messages
- `summaries` - Generated conversation summaries
- `analytics` - Sentiment scores and patterns
- `memories` - Stored user information

The service automatically creates optimized indexes for dashboard queries.

## Configuration

### Environment Variables
No additional environment variables required. The service uses the existing database configuration.

### Query Parameters
- `days` - Number of days to analyze (varies by endpoint)
- Endpoints automatically cap maximum days to prevent performance issues

## Performance Considerations

### Database Optimization
- Service creates indexes for common dashboard queries
- Queries are optimized for SQLite performance
- Large date ranges are automatically limited

### Caching Recommendations
For production deployment, consider adding caching:

```javascript
// Example: Cache overview data for 5 minutes
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 });

router.get('/overview', async (req, res) => {
  const cacheKey = 'dashboard-overview';
  let overview = cache.get(cacheKey);
  
  if (!overview) {
    overview = await dashboardService.getOverviewStats();
    cache.set(cacheKey, overview);
  }
  
  res.json({ success: true, data: overview });
});
```

## Error Handling

The API endpoints include comprehensive error handling:
- Database connection issues
- Invalid query parameters
- Service initialization failures
- Development vs production error details

## Real-time Updates

For real-time dashboard updates, use the `/real-time` endpoint with polling:

```javascript
// Poll every 30 seconds for live data
setInterval(async () => {
  try {
    const response = await fetch('/api/admin/dashboard/real-time');
    const data = await response.json();
    if (data.success) {
      updateRealTimeDashboard(data.data);
    }
  } catch (error) {
    console.error('Failed to fetch real-time data:', error);
  }
}, 30000);
```

## Testing

Test the new endpoints:

```bash
# Test overview
curl http://localhost:3000/api/admin/dashboard/overview

# Test mental state with custom timeframe
curl "http://localhost:3000/api/admin/dashboard/mental-state?days=14"

# Test care indicators
curl "http://localhost:3000/api/admin/dashboard/care-indicators?days=30"

# Test conversation trends
curl "http://localhost:3000/api/admin/dashboard/conversation-trends?days=7"

# Test real-time data
curl http://localhost:3000/api/admin/dashboard/real-time
```

## Migration from Mock Data

To migrate from existing mock endpoints:

1. Update frontend API calls to use new endpoints
2. Adapt frontend code to handle new data structures
3. Test with real conversation data
4. Remove or deprecate old mock endpoints
5. Update any documentation or API references

The new endpoints provide much richer data than the mock endpoints, allowing for more sophisticated dashboard visualizations and insights.