# Emotional Metrics Database (Migration 5)

This worktree contains the implementation of Migration 5, which adds comprehensive emotional state tracking to the compassionate AI companion system.

## Overview

The emotional metrics database enables systematic tracking of user emotional states during conversations, providing valuable insights for:

- **Mental state monitoring** over time
- **Care plan optimization** based on emotional patterns
- **Early intervention** for emotional distress
- **Family member awareness** of emotional trends
- **Quality of care assessment** and improvement

## Database Schema

### emotional_metrics Table

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | INTEGER | Primary key | AUTO_INCREMENT |
| `conversation_id` | INTEGER | Foreign key to conversations | NOT NULL |
| `anxiety_level` | INTEGER | Anxiety level | 0-10 scale |
| `agitation_level` | INTEGER | Agitation level | 0-10 scale |
| `confusion_level` | INTEGER | Confusion level | 0-10 scale |
| `comfort_level` | INTEGER | Comfort level | 0-10 scale |
| `mentions_pain` | BOOLEAN | Pain mentioned flag | DEFAULT FALSE |
| `mentions_medication` | BOOLEAN | Medication mentioned flag | DEFAULT FALSE |
| `mentions_staff_complaint` | BOOLEAN | Staff complaint flag | DEFAULT FALSE |
| `mentions_family` | BOOLEAN | Family mentioned flag | DEFAULT FALSE |
| `interruption_count` | INTEGER | Number of interruptions | DEFAULT 0 |
| `repetition_count` | INTEGER | Number of repetitions | DEFAULT 0 |
| `topic_changes` | INTEGER | Number of topic changes | DEFAULT 0 |
| `overall_sentiment` | TEXT | Overall sentiment | 'positive', 'neutral', 'negative' |
| `sentiment_score` | REAL | Sentiment score | -1.0 to 1.0 |
| `call_duration_seconds` | INTEGER | Call duration | |
| `time_of_day` | TEXT | Time period | 'morning', 'afternoon', 'evening', 'night' |
| `day_of_week` | TEXT | Day of week | 'monday' through 'sunday' |
| `emergency_indicators` | TEXT | Emergency keywords | JSON array |
| `memory_triggers` | TEXT | Memory-related topics | JSON array |
| `created_at` | DATETIME | Creation timestamp | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | DATETIME | Update timestamp | DEFAULT CURRENT_TIMESTAMP |

### Performance Indexes

- `idx_emotional_metrics_conversation_id` - Foreign key lookups
- `idx_emotional_metrics_created_at` - Temporal queries
- `idx_emotional_metrics_anxiety_level` - High anxiety filtering
- `idx_emotional_metrics_overall_sentiment` - Sentiment analysis
- `idx_emotional_metrics_time_patterns` - Time-based pattern analysis
- `idx_emotional_metrics_trends` - Composite index for trend analysis

## API Usage

### saveEmotionalMetrics Method

```javascript
const DatabaseManager = require('./services/database-manager.js');

const db = DatabaseManager.getInstance();
await db.waitForInitialization();

// Save comprehensive emotional metrics
const result = await db.saveEmotionalMetrics(conversationId, {
  // Emotional indicators (0-10 scale)
  anxietyLevel: 7,
  agitationLevel: 4,
  confusionLevel: 6,
  comfortLevel: 3,
  
  // Care indicators (boolean)
  mentionsPain: true,
  mentionsMedication: false,
  mentionsStaffComplaint: false,
  mentionsFamily: true,
  
  // Conversation quality
  interruptionCount: 2,
  repetitionCount: 5,
  topicChanges: 3,
  
  // Sentiment analysis
  overallSentiment: 'negative',
  sentimentScore: -0.4,
  
  // Temporal information
  callDurationSeconds: 1200,
  timeOfDay: 'evening',
  dayOfWeek: 'tuesday',
  
  // Complex data as arrays
  emergencyIndicators: ['chest pain', 'dizzy'],
  memoryTriggers: ['deceased spouse', 'medication confusion']
});
```

### Input Validation

The `saveEmotionalMetrics` method includes comprehensive validation:

- **Range validation**: Emotional levels must be 0-10, sentiment scores -1.0 to 1.0
- **Enum validation**: Sentiment must be 'positive', 'neutral', or 'negative'
- **Day validation**: Day of week must be valid day name (case-insensitive)
- **Type validation**: Booleans converted to integers for SQLite compatibility
- **JSON validation**: Arrays automatically serialized to JSON strings

## Query Examples

### High Anxiety Detection
```sql
SELECT conversation_id, anxiety_level, created_at 
FROM emotional_metrics 
WHERE anxiety_level >= 8 
ORDER BY created_at DESC;
```

### Sentiment Trends
```sql
SELECT 
  DATE(created_at) as date,
  AVG(sentiment_score) as avg_sentiment,
  COUNT(*) as call_count
FROM emotional_metrics 
WHERE created_at >= date('now', '-30 days')
GROUP BY DATE(created_at)
ORDER BY date;
```

### Emergency Indicators
```sql
SELECT conversation_id, emergency_indicators, created_at
FROM emotional_metrics 
WHERE emergency_indicators IS NOT NULL
  AND emergency_indicators != '[]'
ORDER BY created_at DESC;
```

### Time Pattern Analysis
```sql
SELECT 
  time_of_day,
  day_of_week,
  AVG(anxiety_level) as avg_anxiety,
  AVG(comfort_level) as avg_comfort,
  COUNT(*) as call_count
FROM emotional_metrics 
GROUP BY time_of_day, day_of_week
ORDER BY avg_anxiety DESC;
```

## Integration Points

### ConversationAnalyzer Service
The existing `ConversationAnalyzer` service can be extended to automatically detect and save emotional metrics:

```javascript
// In conversation-analyzer.js
async saveAnalysis(conversationId, analysis) {
  // ... existing code ...
  
  // Extract emotional metrics from analysis
  const emotionalMetrics = {
    anxietyLevel: this.detectAnxietyLevel(analysis),
    agitationLevel: this.detectAgitationLevel(analysis),
    confusionLevel: this.detectConfusionLevel(analysis),
    // ... more metrics
  };
  
  // Save to emotional metrics table
  await this.dbManager.saveEmotionalMetrics(conversationId, emotionalMetrics);
}
```

### Admin Dashboard
The admin dashboard can display emotional metrics:

- **Real-time alerts** for high anxiety/distress levels
- **Trend charts** showing emotional patterns over time
- **Care recommendations** based on emotional indicators
- **Family notifications** for significant emotional changes

## Testing

Run the comprehensive test suite:

```bash
node test-emotional-metrics.js
```

The test validates:
- ✅ Migration 5 execution and schema creation
- ✅ saveEmotionalMetrics method functionality
- ✅ Input validation and error handling
- ✅ JSON array storage and retrieval
- ✅ Query performance with indexes
- ✅ Data integrity and constraints

## Benefits for Dementia Care

1. **Objective Measurement**: Quantify emotional states that might otherwise be subjective
2. **Pattern Recognition**: Identify triggers and patterns in emotional responses
3. **Care Optimization**: Adjust conversation approaches based on emotional feedback
4. **Early Warning**: Detect declining emotional states for intervention
5. **Family Engagement**: Provide concrete data about emotional well-being
6. **Quality Metrics**: Measure conversation effectiveness and user comfort

## Migration Status

- **Current Version**: 5
- **Backward Compatible**: Yes
- **Performance Impact**: Minimal (optimized indexes included)
- **Data Integrity**: Full ACID compliance with foreign key constraints
- **Rollback Strategy**: Migration can be rolled back if needed

## Future Enhancements

- **Machine Learning Integration**: Train models on emotional patterns
- **Real-time Alerts**: Immediate notifications for high distress levels
- **Personalized Responses**: Adapt conversation style based on emotional state
- **Longitudinal Analysis**: Track emotional health trends over months/years
- **Care Team Integration**: Share insights with healthcare providers