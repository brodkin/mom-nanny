# GPT-Based Emotional Analysis Implementation Tasks

## Overview
Implement GPT-powered emotional analysis at call completion, storing numeric metrics in properly normalized database tables for future time-series visualization.

## Phase 1: Database Schema for Time-Series Storage

### 1.1 Create Migration 5: Emotional Metrics Tables
**New Table**: `emotional_metrics`

```sql
CREATE TABLE IF NOT EXISTS emotional_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  anxiety_level REAL,
  anxiety_peak REAL,
  confusion_level REAL,
  confusion_peak REAL,
  agitation_level REAL,
  agitation_peak REAL,
  overall_mood REAL,
  anxiety_trend TEXT,
  confusion_trend TEXT,
  agitation_trend TEXT,
  mood_trend TEXT,
  analysis_method TEXT DEFAULT 'gpt_v1',
  analysis_confidence REAL,
  raw_analysis TEXT, -- Store full GPT JSON response for future reference
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Indexes for efficient time-series queries
CREATE INDEX idx_emotional_metrics_conversation ON emotional_metrics(conversation_id);
CREATE INDEX idx_emotional_metrics_created ON emotional_metrics(created_at);
CREATE INDEX idx_emotional_metrics_anxiety ON emotional_metrics(anxiety_level);
CREATE INDEX idx_emotional_metrics_confusion ON emotional_metrics(confusion_level);
CREATE INDEX idx_emotional_metrics_agitation ON emotional_metrics(agitation_level);
CREATE INDEX idx_emotional_metrics_mood ON emotional_metrics(overall_mood);
```

## Phase 2: GPT Analysis Integration

### 2.1 Add Emotional Analysis Method to GPT Service
**Location**: `services/gpt-service.js`

**New Method**: `analyzeEmotionalState(conversationTranscript)`

**System Prompt**:
```
You are an expert geriatric psychiatrist analyzing a dementia care conversation.
Evaluate the entire conversation holistically, considering context and emotional progression.

Provide numerical scores (0-100 for levels, -100 to +100 for mood):
- Early anxiety that resolves should score lower than persistent anxiety
- Consider dementia context (repetition may not indicate anxiety)
- Weight recent emotional state more heavily than early conversation

Return ONLY valid JSON with these exact numeric fields (no nulls).
```

**Required JSON Output**:
```json
{
  "anxietyLevel": 25.5,
  "anxietyPeak": 65.0,
  "anxietyTrend": "decreasing",
  "confusionLevel": 40.0,
  "confusionPeak": 75.0,
  "confusionTrend": "stable",
  "agitationLevel": 15.0,
  "agitationPeak": 30.0,
  "agitationTrend": "stable",
  "overallMood": 20.5,
  "moodTrend": "improving",
  "analysisConfidence": 0.85,
  "keyObservations": [
    "High anxiety about medication resolved after reassurance",
    "Mild confusion about time of day",
    "Positive engagement when discussing family"
  ]
}
```

## Phase 3: Integration Points

### 3.1 Call Flow Integration
**Location**: `app.js` WebSocket close handler (around line 330)

**Implementation**:
1. After conversation analyzer generates summary
2. Check if call duration > 30 seconds
3. Prepare conversation transcript from `conversationAnalyzer.interactions`
4. Call `gptService.analyzeEmotionalState(transcript)`
5. Store results in new `emotional_metrics` table
6. Keep existing keyword-based analysis for backward compatibility

### 3.2 Storage Service Updates
**Location**: `services/sqlite-storage-service.js`

**New Method**: `saveEmotionalMetrics(conversationId, gptAnalysis)`

**Implementation**:
- Insert row into `emotional_metrics` table
- Store all numeric values as REAL type
- Store full JSON response in `raw_analysis` column
- Link to conversation via `conversation_id`

## Phase 4: Backward Compatibility

### 4.1 Dual Storage Strategy
- Continue storing keyword-based `anxietyLevel` in summaries table
- Add new GPT metrics in `emotional_metrics` table
- Allow gradual migration of dashboard features

### 4.2 Fallback Handling
- If GPT analysis fails, continue with keyword analysis only
- Log failures for monitoring
- Set `analysis_method` to 'keyword_v1' as fallback

## Phase 5: Implementation Steps

### Task Checklist

- [ ] **1. Create Database Migration**
  - [ ] Add `applyMigration5EmotionalMetrics()` method to database-manager.js
  - [ ] Create emotional_metrics table with proper REAL types
  - [ ] Add all necessary indexes
  - [ ] Test migration on fresh database

- [ ] **2. Implement GPT Analysis**
  - [ ] Add `analyzeEmotionalState` method to gpt-service.js
  - [ ] Use function calling format for structured output
  - [ ] Validate JSON response structure
  - [ ] Default to 0 for any missing numeric values

- [ ] **3. Integrate with App Flow**
  - [ ] Add emotional analysis call in WebSocket close handler
  - [ ] Pass conversation transcript to GPT service
  - [ ] Handle response asynchronously
  - [ ] Log any errors without blocking call completion

- [ ] **4. Update Storage Service**
  - [ ] Add `saveEmotionalMetrics` method
  - [ ] Ensure all numeric fields stored as REAL
  - [ ] Handle database errors gracefully
  - [ ] Add transaction support for data integrity

- [ ] **5. Testing**
  - [ ] Test with various conversation lengths
  - [ ] Verify numeric data types in database
  - [ ] Test GPT failure scenarios
  - [ ] Validate data can be queried and sorted
  - [ ] Test with high-anxiety conversations
  - [ ] Test with calm conversations

## Phase 6: Future API Preparation

### 6.1 Data Retrieval Methods (For Future Use)
**Location**: `services/sqlite-storage-service.js`

Methods to add for future charting:
- `getEmotionalMetricsByDateRange(startDate, endDate, metricType)`
- `getAverageMetricsByPeriod(period, metricType)`
- `getMetricTrends(conversationIds)`

## Phase 7: Documentation Update (After Implementation)

### Add to CLAUDE.md:
```markdown
## Emotional Analysis System (GPT-Based)

### When Anxiety/Emotional Data is Captured
- **End of Call**: Single GPT analysis of entire conversation
- **Holistic Scoring**: Considers full context, not just keywords
- **Stored Separately**: In `emotional_metrics` table for time-series queries

### Scoring Methodology
- **GPT Analysis**: Full conversation context evaluated by GPT-4
- **Scale**: 0-100 for anxiety/confusion/agitation, -100 to +100 for mood
- **Storage**: All metrics stored as REAL type for proper database operations
- **Peak Tracking**: Captures both average and peak values

### Database Storage
- Table: `emotional_metrics`
- All numeric fields: REAL type (sortable, filterable)
- Indexed for time-series queries
- Raw GPT response preserved for future reprocessing

### API Data Access (For Future Charts)
- Metrics queryable by date range
- Supports aggregation (daily, weekly, monthly)
- Efficient indexes for performance
```

## Success Metrics
- [ ] All numeric data stored as REAL type
- [ ] GPT analysis completes within 5 seconds
- [ ] Zero data loss on GPT failures (fallback works)
- [ ] Database queries support sorting/filtering
- [ ] Ready for future time-series visualization

## Code Example for Integration

```javascript
// In app.js WebSocket close handler
if (conversationDuration > 30) {
  try {
    const emotionalAnalysis = await gptService.analyzeEmotionalState(
      conversationAnalyzer.interactions
    );
    await storageService.saveEmotionalMetrics(
      conversationId, 
      emotionalAnalysis
    );
  } catch (error) {
    console.error('GPT emotional analysis failed:', error);
    // Continue with existing flow
  }
}
```

## Notes
- This implementation focuses solely on data capture and storage
- Visualization/charting will be implemented in a future phase
- All numeric data must be REAL type for proper SQL operations
- GPT analysis is additional to (not replacement for) keyword analysis initially