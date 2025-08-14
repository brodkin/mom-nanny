# Conversation Summary Feature - Implementation Status

## Current Implementation Status

### ✅ Completed Work (SQLite Storage Implementation)
The conversation summary system has been successfully implemented using SQLite storage with the following components:

#### Analytics Services (Completed)
- ✅ `services/conversation-analyzer.js` (954 lines) - Core analysis engine
- ✅ `utils/sentiment-analyzer.js` (250 lines) - Emotion detection
- ✅ `utils/pattern-matcher.js` (302 lines) - Clinical pattern detection  
- ✅ `utils/keyword-extractor.js` (338 lines) - Topic extraction

#### Storage Services (Completed)
- ✅ `services/sqlite-storage-service.js` - SQLite database storage
- ✅ `services/database-manager.js` - Database connection management
- ✅ `services/summary-generator.js` (328 lines) - Summary generation

#### Test Suite (Completed)
- ✅ Comprehensive test coverage across all services
- ✅ SQLite-specific tests for all storage operations
- ✅ Comprehensive mock data generators

#### Integration (Completed)
- ✅ Modified `app.js` to track conversations
- ✅ Modified `gpt-service.js` to track responses
- ✅ Automatic summary generation on call end
- ✅ SQLite as the sole storage mechanism

### Why SQLite
The system uses SQLite exclusively because:
- **No server needed** - Just a file (meets "no DB server" requirement)
- **Fast queries** - Optimized for data retrieval
- **ACID transactions** - Prevents data corruption
- **Concurrent access** - Built-in safety
- **Rich SQL queries** - Enables advanced analytics

## SQLite Implementation Plan

### Phase 1: Database Setup

#### 1.1 Install Dependencies
```bash
npm install better-sqlite3
npm install --save-dev @types/better-sqlite3  # If using TypeScript
```

#### 1.2 Database Schema
```sql
-- Main conversation records
CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    call_sid TEXT UNIQUE NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    duration_seconds REAL,
    day_of_week TEXT,
    time_of_day TEXT,
    total_interactions INTEGER DEFAULT 0,
    user_utterances INTEGER DEFAULT 0,
    assistant_responses INTEGER DEFAULT 0,
    interruption_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Individual utterances/interactions
CREATE TABLE utterances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'user', 'assistant', 'interruption', 'function_call'
    content TEXT,
    timestamp DATETIME NOT NULL,
    sequence_number INTEGER NOT NULL,
    latency_ms INTEGER,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Sentiment analysis per utterance
CREATE TABLE sentiment_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    utterance_id INTEGER NOT NULL,
    overall_sentiment REAL,
    anxiety_level REAL,
    agitation_level REAL,
    confusion_level REAL,
    coherence_score REAL,
    FOREIGN KEY (utterance_id) REFERENCES utterances(id) ON DELETE CASCADE
);

-- Clinical and behavioral patterns
CREATE TABLE patterns_detected (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    pattern_type TEXT NOT NULL,
    pattern_value TEXT,
    confidence REAL,
    timestamp DATETIME,
    details JSON,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Keywords and topics
CREATE TABLE keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    utterance_id INTEGER,
    keyword TEXT NOT NULL,
    category TEXT,
    sentiment REAL,
    frequency INTEGER DEFAULT 1,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Caregiver insights
CREATE TABLE caregiver_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    insight_type TEXT NOT NULL,
    priority TEXT,
    content TEXT NOT NULL,
    metadata JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Complete summaries as JSON
CREATE TABLE conversation_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER UNIQUE NOT NULL,
    summary_json JSON NOT NULL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Aggregation tables
CREATE TABLE daily_aggregates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE UNIQUE NOT NULL,
    total_calls INTEGER DEFAULT 0,
    total_duration_seconds REAL DEFAULT 0,
    average_anxiety_level REAL,
    average_confusion_level REAL,
    dominant_topics JSON,
    metadata JSON
);

CREATE TABLE weekly_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    total_calls INTEGER DEFAULT 0,
    insights JSON,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Phase 2: Implementation Files

#### 2.1 New Files to Create

1. **services/sqlite-storage-service.js**
   - SQLite-based storage implementation
   - Rich query methods for analytics
   - The only storage mechanism in the system

2. **services/database-manager.js**
   - SQLite connection management
   - Database initialization
   - Migration runner
   - Query utilities

3. **migrations/001-initial-schema.js**
   - Creates all tables and indexes
   - Sets up triggers for aggregates
   - No migration needed (no existing data)

4. **utils/query-builder.js**
   - Complex query helpers
   - Date range queries
   - Pattern matching utilities

#### 2.2 Files to Modify

1. **app.js**
   - Uses `SqliteStorageService` directly
   - Database initialization on WebSocket connection

2. **package.json**
   - Add better-sqlite3 dependency
   - Add migration scripts

### Phase 3: API Interface

#### 3.1 Core Storage Methods
```javascript
class SQLiteStorageService {
  // Primary storage methods
  async saveSummary(summary) { }
  async loadSummary(callSid) { }
  async listSummariesForDate(date) { }
  async generateWeeklyReport(startDate) { }
}
```

#### 3.2 Enhanced Query Methods
```javascript
class SQLiteStorageService {
  // New query capabilities
  async queryByEmotions(filters) {
    // Find calls by anxiety/confusion levels
    // filters: { anxietyMin: 0.5, confusionMax: 0.3, dateRange: {} }
  }
  
  async queryByTopics(topics, dateRange) {
    // Search conversations containing specific topics
  }
  
  async queryByPatterns(patternTypes, dateRange) {
    // Find conversations with clinical patterns
    // patternTypes: ['repetition', 'sundowning', 'medication_concern']
  }
  
  async getConversationTimeline(callSid) {
    // Get full conversation with all utterances in order
  }
  
  async getCaregiverDashboard(dateRange) {
    // Aggregate insights for caregiver overview
    // Returns: top concerns, behavior trends, recommendations
  }
  
  async searchConversations(searchQuery) {
    // Full-text search across all conversations
  }
  
  async getPatientProfile(dateRange) {
    // Build comprehensive patient profile from conversations
  }
}
```

### Phase 4: Testing Strategy

#### 4.1 Test Coverage Requirements
- Unit tests for all database operations
- Integration tests with ConversationAnalyzer
- Migration validation tests
- Performance benchmarks
- Concurrent access testing

#### 4.2 Test Files to Create
```javascript
// test/sqlite-storage-service.test.js
describe('SQLiteStorageService', () => {
  // Basic CRUD
  test('saves and retrieves conversation summary')
  test('handles concurrent writes safely')
  test('maintains referential integrity')
  
  // Queries
  test('queries by date range')
  test('queries by emotions with filters')
  test('finds patterns across conversations')
  
  // Aggregations
  test('generates daily aggregates')
  test('creates weekly reports')
  
  // No migration tests needed (no existing data)
});
```

### Phase 5: Direct Implementation (No Migration Needed)

SQLite is now the exclusive storage implementation:

1. **COMPLETED** refactoring:
   - Removed `services/storage-service.js` (JSON storage)
   - Removed `test/storage-service.test.js` (JSON storage tests)
   - Updated `app.js` to use SQLite directly
   - Updated all tests to work with SQLite only

2. **SQLite implementation**:
   - Database with comprehensive schema
   - No dual-mode storage support
   - SQLite-only approach for all storage needs

### Phase 6: Performance Optimizations

#### 6.1 Indexes
```sql
-- Query performance indexes
CREATE INDEX idx_conversations_dates ON conversations(start_time, end_time);
CREATE INDEX idx_utterances_conversation ON utterances(conversation_id, sequence_number);
CREATE INDEX idx_sentiment_levels ON sentiment_analysis(anxiety_level, confusion_level);
CREATE INDEX idx_patterns_type ON patterns_detected(pattern_type, conversation_id);
CREATE INDEX idx_keywords_category ON keywords(category, keyword);
CREATE INDEX idx_insights_priority ON caregiver_insights(priority, conversation_id);
```

#### 6.2 Query Optimization
- Use prepared statements
- Implement query result caching
- Batch inserts for bulk operations
- Connection pooling if needed

### Phase 7: Expected Benefits

#### 7.1 Performance Improvements
- **Current (JSON)**: Load all files, parse, filter = 2-5 seconds
- **SQLite**: Indexed query = 5-50 milliseconds
- **Improvement**: 40-100x faster

#### 7.2 New Capabilities
- Real-time analytics dashboard
- Cross-conversation pattern detection
- Trend analysis over time
- Advanced caregiver insights
- Machine learning readiness

### Phase 8: Implementation Timeline

#### Week 1: Setup
- Install dependencies
- Create database schema
- Implement DatabaseManager
- Set up migrations framework

#### Week 2: Core Implementation
- Implement SQLiteStorageService (replace JSON version)
- Delete old storage-service.js
- Add new query methods
- Update SummaryGenerator for SQLite

#### Week 3: Testing
- Write comprehensive tests
- Performance benchmarks
- Load testing
- Integration testing

#### Week 4: Deployment
- Deploy SQLite implementation
- Monitor performance
- Validate data persistence

## Current Working Directory
All work should continue in: `./trees/CONV-SUMMARY-review`

## Files to Keep (Analytics Services)
- ✅ services/conversation-analyzer.js
- ✅ utils/sentiment-analyzer.js
- ✅ utils/pattern-matcher.js
- ✅ utils/keyword-extractor.js
- ✅ Integration points in app.js and gpt-service.js
- ✅ Test files for analytics services

## Files to Replace/Delete
- ❌ services/storage-service.js → Replace with sqlite-storage-service.js
- ❌ services/summary-generator.js → Update to use SQLite queries

## Next Steps for SQLite Implementation
1. Delete old JSON storage implementation
2. Implement SQLite storage service
3. Update summary generator
4. Create database schema
5. Test with real calls

## Risk Mitigation
- **Data Loss**: N/A - no existing data to lose
- **Performance**: Proper indexing and benchmarking
- **Testing**: Comprehensive test coverage before deployment

## Success Criteria
- [ ] SQLite storage working for all calls
- [ ] Query performance < 100ms for typical operations
- [ ] No disruption to call processing
- [ ] Enhanced query capabilities operational
- [ ] Caregiver dashboard functional
- [ ] All analytics services integrated with SQLite

## Notes
- SQLite is serverless - just a file, no external dependencies
- Better-sqlite3 is synchronous, perfect for Node.js
- Schema is normalized but includes JSON columns for flexibility
- Direct implementation - no migration from JSON needed

---

## Original JSON Implementation Details (For Reference)

## Parallel Work Streams

### Stream 1: Core Analytics Services (WORK-001) - 100% Parallel Safe
**No file conflicts - All NEW files**

#### 1.1 ConversationAnalyzer Service (`services/conversation-analyzer.js`)
```javascript
// Template implementation
class ConversationAnalyzer {
  constructor(callSid, startTime) {
    this.callSid = callSid;
    this.startTime = startTime;
    this.endTime = null;
    
    // Conversation tracking
    this.interactions = [];
    this.userUtterances = [];
    this.assistantResponses = [];
    this.topics = new Map();
    this.repetitions = new Map();
    
    // Mental state tracking
    this.moodProgression = [];
    this.anxietyEvents = [];
    this.confusionIndicators = 0;
    this.agitationMarkers = [];
    
    // Care indicators
    this.medicationMentions = [];
    this.painComplaints = [];
    this.hospitalRequests = 0;
    this.staffComplaints = [];
    
    // Behavioral patterns
    this.responseLatencies = [];
    this.interruptionCount = 0;
    this.coherenceScores = [];
    
    // Support effectiveness
    this.successfulRedirections = [];
    this.failedRedirections = [];
    this.engagementMetrics = [];
  }
  
  // Core methods to implement:
  trackUserUtterance(text, timestamp) {}
  trackAssistantResponse(text, timestamp) {}
  trackInterruption(timestamp) {}
  trackFunctionCall(functionName, args, timestamp) {}
  detectRepetition(text) {}
  analyzeSentiment(text) {}
  detectAnxietyMarkers(text) {}
  detectConfusion(text) {}
  calculateCoherence(text, context) {}
  identifyTopics(text) {}
  generateSummary() {}
  generateCaregiverInsights() {}
}
```

**Key Implementation Details:**
- Track all conversation events with timestamps
- Detect repetitions using Levenshtein distance (threshold: 0.8 similarity)
- Anxiety markers: "worried", "scared", "help", "wrong", "hurt", "hospital"
- Confusion markers: contradictions, non-sequiturs, time disorientation
- Topic extraction: Named entities, repeated nouns, conversation themes

#### 1.2 Sentiment Analyzer (`utils/sentiment-analyzer.js`)
```javascript
class SentimentAnalyzer {
  constructor() {
    // Emotion lexicons
    this.anxietyWords = ['worried', 'scared', 'afraid', 'nervous', 'anxious', 'panic'];
    this.agitationWords = ['angry', 'mad', 'upset', 'frustrated', 'annoyed'];
    this.confusionWords = ['confused', 'lost', 'forget', "don't know", "can't remember"];
    this.positiveWords = ['happy', 'good', 'nice', 'wonderful', 'love', 'laugh'];
    
    // Scoring weights
    this.weights = {
      anxiety: 1.5,      // Higher weight for clinical relevance
      agitation: 1.3,
      confusion: 1.2,
      positive: 1.0
    };
  }
  
  analyzeSentiment(text) {
    // Return object with scores for each emotion category
    return {
      anxiety: this.calculateAnxietyScore(text),
      agitation: this.calculateAgitationScore(text),
      confusion: this.calculateConfusionScore(text),
      positivity: this.calculatePositivityScore(text),
      overall: this.calculateOverallMood(text)
    };
  }
  
  detectEmotionalShift(previousMood, currentMood) {}
  calculateTrend(moodArray) {}
}
```

#### 1.3 Pattern Matcher (`utils/pattern-matcher.js`)
```javascript
class PatternMatcher {
  constructor() {
    this.patterns = {
      medicationConcern: /(?:medicine|medication|pills?|dose|prescription)/i,
      painComplaint: /(?:hurt|pain|ache|sore|burning|stabbing)/i,
      hospitalRequest: /(?:hospital|emergency|ambulance|doctor|ER)/i,
      staffComplaint: /(?:mean|rude|ignore|won't help|bad|stealing)/i,
      delusional: /(?:someone in my room|they're watching|stealing|conspiracy)/i,
      sundowning: /(?:go home|where am I|need to leave|get me out)/i,
      repetition: /(?:already told|asked before|said that)/i
    };
  }
  
  detectPatterns(text) {
    const detected = [];
    for (const [pattern, regex] of Object.entries(this.patterns)) {
      if (regex.test(text)) {
        detected.push({
          type: pattern,
          match: text.match(regex)[0],
          timestamp: Date.now()
        });
      }
    }
    return detected;
  }
  
  calculateRepetitionScore(utterances) {}
  detectSundowningRisk(time, behaviors) {}
  assessUTIIndicators(confusionLevel, timePattern) {}
}
```

#### 1.4 Keyword Extractor (`utils/keyword-extractor.js`)
```javascript
class KeywordExtractor {
  constructor() {
    this.stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an']);
    this.topicCategories = {
      family: ['ryan', 'son', 'daughter', 'family', 'grandchildren'],
      health: ['doctor', 'medicine', 'pain', 'sick', 'hospital'],
      facility: ['room', 'staff', 'nurse', 'food', 'bed'],
      memories: ['hawaii', 'dog', 'house', 'used to', 'remember'],
      emotions: ['sad', 'happy', 'lonely', 'scared', 'worried']
    };
  }
  
  extractKeywords(text) {
    // Remove stop words and extract meaningful terms
    const words = text.toLowerCase().split(/\s+/);
    return words.filter(word => 
      !this.stopWords.has(word) && word.length > 2
    );
  }
  
  categorizeTopics(keywords) {}
  findDominantThemes(conversations) {}
  identifyTriggerWords(negativeEvents) {}
  identifyCalmingTopics(positiveEvents) {}
}
```

### Stream 2: Storage & File Management (WORK-002) - 100% Parallel Safe
**No file conflicts - All NEW files**

#### 2.1 Storage Service (`services/storage-service.js`)
```javascript
const fs = require('fs').promises;
const path = require('path');

class StorageService {
  constructor() {
    this.baseDir = 'conversation-summaries';
  }
  
  async saveSummary(summary) {
    const date = new Date(summary.startTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const monthName = date.toLocaleString('en-US', { month: 'long' });
    const day = String(date.getDate()).padStart(2, '0');
    const time = date.toTimeString().slice(0, 5).replace(':', '-');
    
    // Directory structure: conversation-summaries/2024/01-January/
    const dirPath = path.join(
      this.baseDir,
      String(year),
      `${month}-${monthName}`
    );
    
    // Ensure directory exists
    await this.ensureDirectory(dirPath);
    
    // File name: 2024-01-15_14-30_call-abc123.json
    const fileName = `${year}-${month}-${day}_${time}_call-${summary.callSid}.json`;
    const filePath = path.join(dirPath, fileName);
    
    // Write with pretty formatting
    await fs.writeFile(
      filePath,
      JSON.stringify(summary, null, 2),
      'utf8'
    );
    
    // Also update daily aggregate
    await this.updateDailyAggregate(summary, year, month, day);
    
    return filePath;
  }
  
  async ensureDirectory(dirPath) {}
  async updateDailyAggregate(summary, year, month, day) {}
  async loadSummary(filePath) {}
  async listSummariesForDate(date) {}
  async generateWeeklyReport(startDate) {}
}
```

#### 2.2 Summary Generator (`services/summary-generator.js`)
```javascript
class SummaryGenerator {
  generateSummary(analyzer) {
    const duration = (analyzer.endTime - analyzer.startTime) / 1000; // seconds
    
    return {
      // Call Metadata
      callMetadata: {
        callSid: analyzer.callSid,
        startTime: analyzer.startTime,
        endTime: analyzer.endTime,
        duration: duration,
        dayOfWeek: new Date(analyzer.startTime).toLocaleDateString('en-US', { weekday: 'long' }),
        timeOfDay: this.getTimeOfDay(analyzer.startTime)
      },
      
      // Conversation Metrics
      conversationMetrics: {
        totalInteractions: analyzer.interactions.length,
        userUtterances: analyzer.userUtterances.length,
        assistantResponses: analyzer.assistantResponses.length,
        repetitionCount: analyzer.repetitions.size,
        topicsDiscussed: Array.from(analyzer.topics.keys()),
        successfulRedirections: analyzer.successfulRedirections.length,
        interruptionCount: analyzer.interruptionCount,
        averageResponseLatency: this.calculateAverage(analyzer.responseLatencies)
      },
      
      // Mental State Indicators
      mentalStateIndicators: {
        moodProgression: analyzer.moodProgression,
        anxietyLevel: this.calculateAnxietyLevel(analyzer.anxietyEvents),
        confusionIndicators: analyzer.confusionIndicators,
        agitationLevel: this.calculateAgitationLevel(analyzer.agitationMarkers),
        positiveEngagement: this.assessPositiveEngagement(analyzer.engagementMetrics),
        overallMoodTrend: this.calculateMoodTrend(analyzer.moodProgression)
      },
      
      // Care Indicators
      careIndicators: {
        medicationConcerns: analyzer.medicationMentions,
        painComplaints: analyzer.painComplaints,
        hospitalRequests: analyzer.hospitalRequests,
        staffComplaints: analyzer.staffComplaints,
        sleepPatterns: this.analyzeSleepPatterns(analyzer.startTime, analyzer.interactions)
      },
      
      // Behavioral Patterns
      behavioralPatterns: {
        responseLatency: this.calculateAverage(analyzer.responseLatencies),
        coherenceLevel: this.calculateAverage(analyzer.coherenceScores),
        memoryIndicators: this.assessMemoryFunction(analyzer),
        sundowningRisk: this.assessSundowningRisk(analyzer.startTime, analyzer.agitationMarkers)
      },
      
      // Clinical Observations
      clinicalObservations: {
        hypochondriaEvents: this.countHypochondriaEvents(analyzer),
        delusionalStatements: analyzer.delusionalStatements || [],
        hallucinationIndicators: analyzer.hallucinationIndicators || [],
        paranoiaLevel: this.assessParanoiaLevel(analyzer.staffComplaints)
      },
      
      // Support Effectiveness
      supportEffectiveness: {
        comfortingSuccess: analyzer.successfulRedirections,
        triggerTopics: this.identifyTriggers(analyzer),
        calmingStrategies: this.identifyCalmingStrategies(analyzer),
        engagementQuality: this.assessEngagementQuality(analyzer)
      },
      
      // Caregiver Insights
      caregiverInsights: this.generateCaregiverInsights(analyzer)
    };
  }
  
  generateCaregiverInsights(analyzer) {
    const insights = {
      recommendedConversationStarters: [],
      topicsToAvoid: [],
      optimalCallTimes: [],
      currentConcerns: [],
      positiveStrategies: [],
      communicationTips: []
    };
    
    // Analyze successful topics
    const successfulTopics = analyzer.topics.entries()
      .filter(([topic, data]) => data.sentiment > 0.5)
      .map(([topic]) => topic);
    
    insights.recommendedConversationStarters = successfulTopics.slice(0, 3).map(topic => 
      `Ask about ${topic} - she responded positively to this topic`
    );
    
    // Identify triggers to avoid
    const triggers = analyzer.topics.entries()
      .filter(([topic, data]) => data.sentiment < -0.3)
      .map(([topic]) => topic);
    
    insights.topicsToAvoid = triggers.map(topic => 
      `Avoid discussing ${topic} - increased anxiety/agitation`
    );
    
    // Time-based recommendations
    if (analyzer.startTime) {
      const hour = new Date(analyzer.startTime).getHours();
      if (hour >= 16 && analyzer.agitationMarkers.length > 2) {
        insights.currentConcerns.push('Possible sundowning - consider earlier call times');
        insights.optimalCallTimes.push('Morning or early afternoon calls recommended');
      }
    }
    
    // Communication strategies that worked
    if (analyzer.successfulRedirections.length > 0) {
      insights.positiveStrategies = analyzer.successfulRedirections.slice(0, 3).map(r => 
        `"${r.strategy}" successfully redirected from ${r.fromTopic} to ${r.toTopic}`
      );
    }
    
    // Specific tips based on patterns
    if (analyzer.repetitions.size > 5) {
      insights.communicationTips.push('High repetition today - remain patient and redirect gently');
    }
    
    if (analyzer.confusionIndicators > 3) {
      insights.communicationTips.push('Showing confusion - use simple, clear language and avoid complex topics');
    }
    
    if (analyzer.medicationMentions.length > 0) {
      insights.currentConcerns.push('Mentioned medication concerns - verify with facility staff');
    }
    
    return insights;
  }
  
  // Helper methods
  getTimeOfDay(timestamp) {}
  calculateAverage(array) {}
  calculateAnxietyLevel(events) {}
  calculateAgitationLevel(markers) {}
  assessPositiveEngagement(metrics) {}
  calculateMoodTrend(progression) {}
  analyzeSleepPatterns(startTime, interactions) {}
  assessMemoryFunction(analyzer) {}
  assessSundowningRisk(startTime, agitationMarkers) {}
  countHypochondriaEvents(analyzer) {}
  assessParanoiaLevel(complaints) {}
  identifyTriggers(analyzer) {}
  identifyCalmingStrategies(analyzer) {}
  assessEngagementQuality(analyzer) {}
}
```

### Stream 3: Test Development (WORK-003) - 100% Parallel Safe
**No file conflicts - All NEW files**

#### 3.1 ConversationAnalyzer Tests (`test/conversation-analyzer.test.js`)
```javascript
const ConversationAnalyzer = require('../services/conversation-analyzer');

describe('ConversationAnalyzer', () => {
  let analyzer;
  
  beforeEach(() => {
    analyzer = new ConversationAnalyzer('test-call-123', Date.now());
  });
  
  test('should track user utterances', () => {
    analyzer.trackUserUtterance('I need my medicine', Date.now());
    expect(analyzer.userUtterances).toHaveLength(1);
    expect(analyzer.medicationMentions).toHaveLength(1);
  });
  
  test('should detect repetitions', () => {
    analyzer.trackUserUtterance('Where is Ryan?', Date.now());
    analyzer.trackUserUtterance('Where is Ryan?', Date.now() + 60000);
    expect(analyzer.repetitions.size).toBe(1);
  });
  
  test('should track anxiety markers', () => {
    analyzer.trackUserUtterance("I'm scared and worried", Date.now());
    expect(analyzer.anxietyEvents).toHaveLength(1);
  });
  
  test('should generate caregiver insights', () => {
    // Add test data
    analyzer.topics.set('dogs', { sentiment: 0.8, count: 3 });
    analyzer.topics.set('pain', { sentiment: -0.6, count: 2 });
    analyzer.successfulRedirections.push({
      strategy: 'Asked about her dog',
      fromTopic: 'pain',
      toTopic: 'dogs'
    });
    
    const insights = analyzer.generateCaregiverInsights();
    expect(insights.recommendedConversationStarters).toContain(expect.stringContaining('dogs'));
    expect(insights.topicsToAvoid).toContain(expect.stringContaining('pain'));
  });
});
```

#### 3.2 Storage Service Tests (`test/storage-service.test.js`)
```javascript
const StorageService = require('../services/storage-service');
const fs = require('fs').promises;

jest.mock('fs').promises;

describe('StorageService', () => {
  let storage;
  
  beforeEach(() => {
    storage = new StorageService();
  });
  
  test('should create correct directory structure', async () => {
    const summary = {
      callSid: 'test-123',
      startTime: new Date('2024-01-15T14:30:00').toISOString()
    };
    
    await storage.saveSummary(summary);
    
    expect(fs.mkdir).toHaveBeenCalledWith(
      expect.stringContaining('conversation-summaries/2024/01-January'),
      expect.any(Object)
    );
  });
  
  test('should generate correct filename', async () => {
    const summary = {
      callSid: 'abc123',
      startTime: new Date('2024-01-15T14:30:00').toISOString()
    };
    
    const filePath = await storage.saveSummary(summary);
    expect(filePath).toContain('2024-01-15_14-30_call-abc123.json');
  });
});
```

#### 3.3 Mock Data Generator (`test/mock-data.js`)
```javascript
function generateMockConversation() {
  return {
    callSid: 'mock-' + Math.random().toString(36).substr(2, 9),
    startTime: Date.now() - 300000, // 5 minutes ago
    interactions: [
      { type: 'user', text: "Hello? Who is this?", timestamp: Date.now() - 290000 },
      { type: 'assistant', text: "Hi Francine! It's Jessica. How are you today?", timestamp: Date.now() - 285000 },
      { type: 'user', text: "I need my medicine. They won't give it to me.", timestamp: Date.now() - 280000 },
      { type: 'assistant', text: "I understand that's frustrating. The nurses will help with that. Did you have lunch today?", timestamp: Date.now() - 275000 },
      { type: 'user', text: "I don't know. Where is Ryan?", timestamp: Date.now() - 270000 },
      { type: 'assistant', text: "Ryan is at work right now. He asked me to call and check on you. Tell me about your dog.", timestamp: Date.now() - 265000 },
      { type: 'user', text: "I had a dog. A golden retriever. So beautiful.", timestamp: Date.now() - 260000 },
      { type: 'interruption', timestamp: Date.now() - 255000 },
      { type: 'user', text: "Where is Ryan? I need to talk to Ryan.", timestamp: Date.now() - 250000 }
    ]
  };
}

module.exports = { generateMockConversation };
```

### Stream 4: Integration Points (WORK-004/005) - Requires Coordination

#### 4.1 WebSocket Integration (`app.js` modifications)
**Lines to modify: ~38, ~100, ~140**

```javascript
// At line ~38, after creating service instances, ADD:
const { ConversationAnalyzer } = require('./services/conversation-analyzer');
const { StorageService } = require('./services/storage-service');
const { SummaryGenerator } = require('./services/summary-generator');

// Initialize analyzer after line ~45:
const conversationAnalyzer = new ConversationAnalyzer(callSid, Date.now());
const storageService = new StorageService();
const summaryGenerator = new SummaryGenerator();

// At line ~101, after transcriptionService.on('utterance'), ADD:
transcriptionService.on('utterance', async (text) => {
  // Track interruption in analyzer
  if(marks.length > 0 && text?.length > 5) {
    conversationAnalyzer.trackInterruption(Date.now());
    // ... existing interruption code
  }
});

// At line ~116, inside transcriptionService.on('transcription'), ADD:
transcriptionService.on('transcription', async (text) => {
  if (!text) { return; }
  // Track user utterance
  conversationAnalyzer.trackUserUtterance(text, Date.now());
  // ... existing code
});

// At line ~140, modify ws.on('close') to generate summary:
ws.on('close', async () => {
  console.log('WebSocket closed, cleaning up services'.cyan);
  
  // Generate and save conversation summary
  try {
    conversationAnalyzer.endTime = Date.now();
    const summary = summaryGenerator.generateSummary(conversationAnalyzer);
    const filePath = await storageService.saveSummary(summary);
    console.log(`Conversation summary saved to: ${filePath}`.green);
  } catch (error) {
    console.error('Failed to save conversation summary:', error);
  }
  
  transcriptionService.close();
  markCompletionService.clearAll();
});
```

#### 4.2 GPT Service Enhancement (`services/gpt-service.js` modifications)
**Lines to modify: ~15, ~123, ~146**

```javascript
// At line ~15, in constructor, ADD:
constructor(markCompletionService, conversationAnalyzer = null) {
  super();
  this.openai = new OpenAI();
  this.markCompletionService = markCompletionService;
  this.conversationAnalyzer = conversationAnalyzer; // NEW
  // ... rest of constructor
}

// At line ~123, after gptService.on('gptreply'), ADD:
gptService.on('gptreply', async (gptReply, icount) => {
  console.log(`Interaction ${icount}: GPT -> TTS: ${gptReply.partialResponse}`.green);
  
  // Track assistant response in analyzer
  if (this.conversationAnalyzer) {
    this.conversationAnalyzer.trackAssistantResponse(
      gptReply.partialResponse, 
      Date.now()
    );
  }
  
  ttsService.generate(gptReply, icount);
});

// At line ~124, when function is called, ADD:
if (finishReason === 'tool_calls') {
  // Track function call in analyzer
  if (this.conversationAnalyzer) {
    this.conversationAnalyzer.trackFunctionCall(
      functionName,
      validatedArgs,
      Date.now()
    );
  }
  // ... existing function call code
}
```

**Note: Pass conversationAnalyzer when creating GptService in app.js:**
```javascript
// In app.js, modify line ~46:
const gptService = new GptService(markCompletionService, conversationAnalyzer);
```

## JSON Summary Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [
    "callMetadata",
    "conversationMetrics",
    "mentalStateIndicators",
    "careIndicators",
    "caregiverInsights"
  ],
  "properties": {
    "callMetadata": {
      "type": "object",
      "properties": {
        "callSid": { "type": "string" },
        "startTime": { "type": "string", "format": "date-time" },
        "endTime": { "type": "string", "format": "date-time" },
        "duration": { "type": "number", "description": "Duration in seconds" },
        "dayOfWeek": { "type": "string" },
        "timeOfDay": { 
          "type": "string", 
          "enum": ["early-morning", "morning", "afternoon", "evening", "night"]
        }
      }
    },
    "conversationMetrics": {
      "type": "object",
      "properties": {
        "totalInteractions": { "type": "integer" },
        "userUtterances": { "type": "integer" },
        "assistantResponses": { "type": "integer" },
        "repetitionCount": { "type": "integer" },
        "topicsDiscussed": { 
          "type": "array",
          "items": { "type": "string" }
        },
        "successfulRedirections": { "type": "integer" },
        "interruptionCount": { "type": "integer" },
        "averageResponseLatency": { "type": "number" }
      }
    },
    "mentalStateIndicators": {
      "type": "object",
      "properties": {
        "moodProgression": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "timestamp": { "type": "string", "format": "date-time" },
              "mood": { "type": "string" },
              "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
            }
          }
        },
        "anxietyLevel": {
          "type": "string",
          "enum": ["none", "low", "moderate", "high", "severe"]
        },
        "confusionIndicators": { "type": "integer" },
        "agitationLevel": {
          "type": "string",
          "enum": ["calm", "mild", "moderate", "severe"]
        },
        "positiveEngagement": { 
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "0-1 score of positive engagement"
        }
      }
    },
    "careIndicators": {
      "type": "object",
      "properties": {
        "medicationConcerns": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "timestamp": { "type": "string", "format": "date-time" },
              "concern": { "type": "string" }
            }
          }
        },
        "painComplaints": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "timestamp": { "type": "string", "format": "date-time" },
              "location": { "type": "string" },
              "severity": { "type": "string" }
            }
          }
        },
        "hospitalRequests": { "type": "integer" },
        "staffComplaints": {
          "type": "array",
          "items": { "type": "string" }
        },
        "sleepPatterns": {
          "type": "object",
          "properties": {
            "mentionedSleepIssues": { "type": "boolean" },
            "appearsTired": { "type": "boolean" }
          }
        }
      }
    },
    "behavioralPatterns": {
      "type": "object",
      "properties": {
        "responseLatency": { "type": "number", "description": "Average seconds to respond" },
        "coherenceLevel": { "type": "number", "minimum": 0, "maximum": 1 },
        "memoryIndicators": {
          "type": "object",
          "properties": {
            "recognizedPeople": { "type": "array", "items": { "type": "string" } },
            "recalledEvents": { "type": "array", "items": { "type": "string" } },
            "temporalOrientation": { "type": "string", "enum": ["oriented", "confused", "severely-confused"] }
          }
        },
        "sundowningRisk": {
          "type": "string",
          "enum": ["none", "low", "moderate", "high"]
        }
      }
    },
    "clinicalObservations": {
      "type": "object",
      "properties": {
        "hypochondriaEvents": { "type": "integer" },
        "delusionalStatements": {
          "type": "array",
          "items": { "type": "string" }
        },
        "hallucinationIndicators": {
          "type": "array",
          "items": { "type": "string" }
        },
        "paranoiaLevel": {
          "type": "string",
          "enum": ["none", "mild", "moderate", "severe"]
        }
      }
    },
    "supportEffectiveness": {
      "type": "object",
      "properties": {
        "comfortingSuccess": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "strategy": { "type": "string" },
              "effectiveness": { "type": "string", "enum": ["successful", "partial", "failed"] }
            }
          }
        },
        "triggerTopics": {
          "type": "array",
          "items": { "type": "string" }
        },
        "calmingStrategies": {
          "type": "array",
          "items": { "type": "string" }
        },
        "engagementQuality": {
          "type": "string",
          "enum": ["excellent", "good", "fair", "poor"]
        }
      }
    },
    "caregiverInsights": {
      "type": "object",
      "properties": {
        "recommendedConversationStarters": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Topics that engaged her positively"
        },
        "topicsToAvoid": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Topics that increased anxiety or agitation"
        },
        "optimalCallTimes": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Best times to call based on patterns"
        },
        "currentConcerns": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Issues that need attention"
        },
        "positiveStrategies": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Approaches that worked well"
        },
        "communicationTips": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Specific advice for next interaction"
        }
      }
    }
  }
}
```

## Implementation Guidelines

### Coding Standards
- Use ES6+ features (classes, arrow functions, destructuring)
- Maintain consistent error handling with try-catch blocks
- All async operations should return promises
- Use meaningful variable names that reflect dementia care context

### Error Handling
```javascript
try {
  // Operation
} catch (error) {
  console.error(`[${this.constructor.name}] Error:`, error);
  // Don't throw - log and continue to ensure call isn't disrupted
}
```

### Performance Requirements
- Summary generation must complete in < 2 seconds
- No blocking operations during active call
- Async processing for all I/O operations
- Memory-efficient storage of conversation data

### Testing Requirements
- Minimum 80% code coverage
- Unit tests for all utility functions
- Integration tests for summary generation
- Mock data for all external dependencies

## Validation Checklist

### Pre-Implementation
- [ ] Review existing codebase structure
- [ ] Confirm no additional dependencies needed beyond current package.json
- [ ] Verify directory permissions for conversation-summaries/

### Implementation Phase
- [ ] All new services created with proper error handling
- [ ] Utility functions have comprehensive input validation
- [ ] Integration points added to app.js (3 locations)
- [ ] GPT service enhanced with event emissions (2 locations)
- [ ] Storage service creates proper directory structure
- [ ] Summary generator produces valid JSON schema

### Testing Phase
- [ ] Unit tests pass for all utilities
- [ ] Integration tests pass for summary generation
- [ ] Mock conversation generates valid summary
- [ ] Caregiver insights are meaningful and actionable
- [ ] File storage works with proper naming convention

### Quality Gates
- [ ] Code follows established patterns in codebase
- [ ] No console errors during call processing
- [ ] Summary files are human-readable JSON
- [ ] Performance impact < 100ms on call processing
- [ ] All emotional indicators properly detected
- [ ] Caregiver insights provide actionable recommendations

### Acceptance Criteria
- [ ] Summary generated for every completed call
- [ ] JSON validates against schema
- [ ] Files saved in correct directory structure
- [ ] Caregiver insights include at least 3 recommendations
- [ ] Mental state indicators accurately reflect conversation
- [ ] No disruption to existing call functionality

## Parallel Development Timeline

### Day 1-2: Core Development
- **Developer 1**: Stream 1 (Analytics Services)
- **Developer 2**: Stream 2 (Storage & Summary)
- **Developer 3**: Stream 3 (Test Development)

### Day 3: Integration
- **All Developers**: Merge streams, integrate with app.js and gpt-service.js

### Day 4: Testing & Refinement
- **All Developers**: Run integration tests, refine algorithms, optimize performance

### Day 5: Documentation & Deployment
- **All Developers**: Complete documentation, prepare deployment, final testing

## Notes for Implementers

1. **Sentiment Analysis**: Start with keyword-based approach, can enhance with NLP library later
2. **Pattern Detection**: Use regex for initial implementation, consider ML enhancement in v2
3. **Caregiver Insights**: Focus on actionable, specific recommendations
4. **File Storage**: Ensure atomic writes to prevent corruption
5. **Testing**: Use mock data that reflects real conversation patterns with Francine

This implementation plan enables 80% parallel development with minimal integration complexity. Each stream can work independently, coming together only for final integration.