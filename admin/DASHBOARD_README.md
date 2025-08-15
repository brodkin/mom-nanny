# Compassionate Care Dashboard

## Overview

The Compassionate Care Dashboard provides real-time insights into the mental state, engagement patterns, and care indicators for the Mom & Nanny AI companion system. It's designed specifically for caregivers and administrators to monitor the emotional well-being of elderly users with dementia and anxiety.

## Features

### 🧠 Mental State Monitoring
- **Real-time indicators**: Anxiety, confusion, and agitation levels
- **Trend visualization**: 7-day mental state patterns
- **Status assessment**: Overall emotional well-being status
- **Alert system**: Notifications for concerning patterns

### 📊 Conversation Analytics
- **Daily call patterns**: Call volume and duration trends
- **Hourly distribution**: Peak calling hours identification
- **Feature usage**: AI function utilization breakdown
- **Engagement metrics**: User interaction patterns

### 🏥 Care Indicators
- **Health mentions**: Medication, pain, and hospital requests
- **Trend analysis**: 30-day care indicator patterns
- **Risk assessment**: Automated care risk evaluation
- **Staff interactions**: Communication with care staff

### 🚨 Alert & Recommendations System
- **Active alerts**: Items requiring immediate attention
- **Positive insights**: Encouraging patterns and engagement
- **Care recommendations**: Suggested actions for caregivers
- **Mental state alerts**: Concerning emotional patterns

## Access

### Dashboard URLs
- **Main Admin Interface**: `/admin/`
- **Compassionate Care Dashboard**: `/admin/dashboard`

### API Endpoints
- **Overview Data**: `/api/admin/dashboard/overview`
- **Mental State**: `/api/admin/dashboard/mental-state?days=7`
- **Care Indicators**: `/api/admin/dashboard/care-indicators?days=30`
- **Conversation Trends**: `/api/admin/dashboard/conversation-trends?days=30`
- **Real-time Data**: `/api/admin/dashboard/real-time`

## Technical Details

### Auto-refresh
- **Interval**: 30 seconds
- **Manual refresh**: Ctrl+R (dashboard pages)
- **Real-time status**: Live monitoring indicator

### Data Sources
- **SQLite Database**: Conversation summaries, messages, analytics
- **Memory Service**: User memory and context data
- **Conversation Analyzer**: Mental state and care pattern analysis

### Fallback Behavior
- **Offline mode**: Mock data when API unavailable
- **Error handling**: Graceful degradation with user feedback
- **Loading states**: Skeleton animations during data fetch

## Charts & Visualizations

### Chart.js Integration
- **Mental State Trends**: Line chart with anxiety, confusion, agitation
- **Daily Call Patterns**: Dual-axis line chart (volume + duration)
- **Hourly Distribution**: Bar chart of peak calling hours
- **Function Usage**: Doughnut chart of AI feature utilization
- **Care Indicators**: Line chart of health-related mentions

### Responsive Design
- **Mobile-friendly**: Responsive grid layouts
- **Touch-friendly**: Mobile navigation and interactions
- **Accessibility**: ARIA labels and keyboard navigation

## Color Scheme

### Mental State Indicators
- **Calm**: Green (🟢) - Stable emotional state
- **Elevated**: Yellow (🟡) - Mild concern levels
- **Concerning**: Red (🔴) - Requires attention

### Care Risk Levels
- **Low Risk**: Green indicators
- **Medium Risk**: Yellow indicators  
- **High Risk**: Red indicators with priority alerts

## Data Privacy

### Compliance
- **No PHI/PII**: Only conversation summaries stored
- **Local Storage**: SQLite database, no external transmission
- **Anonymized Metrics**: Aggregate patterns without personal details

### Security
- **Environment Variables**: API keys and sensitive config
- **Error Logging**: Development details hidden in production
- **Database Isolation**: Local file-based storage only

## Usage Guidelines

### For Caregivers
1. **Monitor mental state** trends to identify concerning patterns
2. **Review care indicators** for health-related mentions
3. **Check alerts** for items requiring immediate attention
4. **Celebrate positive insights** showing good engagement

### For Administrators
1. **System overview** for operational health monitoring
2. **Conversation analytics** for usage pattern analysis
3. **Performance metrics** for system optimization
4. **Trend analysis** for long-term care planning

## Keyboard Shortcuts

- **Ctrl+R**: Manual dashboard refresh
- **Ctrl+B**: Toggle sidebar (admin interface)
- **Ctrl+Shift+T**: Toggle dark/light theme
- **Ctrl+K**: Global search (admin interface)

## Troubleshooting

### Common Issues

1. **Charts not loading**
   - Check browser console for errors
   - Verify Chart.js CDN availability
   - Ensure API endpoints are accessible

2. **Data not updating**
   - Check auto-refresh status indicator
   - Verify database connectivity
   - Manual refresh with Ctrl+R

3. **API errors**
   - Dashboard falls back to mock data
   - Check server logs for database issues
   - Verify environment variables are set

### Browser Support
- **Modern browsers**: Chrome 90+, Firefox 88+, Safari 14+
- **Features required**: ES6+, Fetch API, CSS Grid
- **Chart.js**: Version 4.4.0+ from CDN

## Development

### Files Structure
```
admin/
├── dashboard.html          # Main dashboard page
├── js/
│   ├── admin.js           # Base admin functionality
│   └── dashboard-real.js  # Dashboard data integration
├── css/
│   └── admin.css         # Styling (imports all CSS modules)
└── DASHBOARD_README.md   # This documentation
```

### API Integration
- **Real-time updates**: 30-second polling
- **Error handling**: Graceful fallback to mock data
- **Loading states**: Skeleton animations and loading indicators
- **Responsive**: Auto-adjusts to different screen sizes

## Support

For technical issues or questions about the Compassionate Care Dashboard:

1. Check server logs for API errors
2. Verify database initialization completed
3. Test API endpoints directly in browser
4. Review browser console for JavaScript errors

The dashboard is designed to prioritize emotional well-being monitoring while maintaining the dignity and privacy of elderly users with dementia and anxiety.