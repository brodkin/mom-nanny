const ConversationAnalyzer = require('../services/conversation-analyzer');

describe('ConversationAnalyzer', () => {
  let analyzer;
  const mockCallSid = 'CA123456789';
  const mockStartTime = new Date();

  beforeEach(() => {
    analyzer = new ConversationAnalyzer(mockCallSid, mockStartTime);
  });

  describe('constructor', () => {
    test('should initialize with call metadata and tracking arrays', () => {
      expect(analyzer.callSid).toBe(mockCallSid);
      expect(analyzer.startTime).toBe(mockStartTime);
      expect(analyzer.endTime).toBeNull();
      
      // Conversation tracking
      expect(analyzer.interactions).toEqual([]);
      expect(analyzer.userUtterances).toEqual([]);
      expect(analyzer.assistantResponses).toEqual([]);
      expect(analyzer.topics).toBeInstanceOf(Map);
      expect(analyzer.repetitions).toBeInstanceOf(Map);
      
      // Mental state tracking
      expect(analyzer.moodProgression).toEqual([]);
      expect(analyzer.anxietyEvents).toEqual([]);
      expect(analyzer.confusionIndicators).toBe(0);
      expect(analyzer.agitationMarkers).toEqual([]);
      
      // Care indicators
      expect(analyzer.medicationMentions).toEqual([]);
      expect(analyzer.painComplaints).toEqual([]);
      expect(analyzer.hospitalRequests).toBe(0);
      expect(analyzer.staffComplaints).toEqual([]);
      
      // Behavioral patterns
      expect(analyzer.responseLatencies).toEqual([]);
      expect(analyzer.interruptionCount).toBe(0);
      expect(analyzer.coherenceScores).toEqual([]);
      
      // Support effectiveness
      expect(analyzer.successfulRedirections).toEqual([]);
      expect(analyzer.failedRedirections).toEqual([]);
      expect(analyzer.engagementMetrics).toEqual([]);
    });
  });

  describe('trackUserUtterance', () => {
    test('should record user utterance with timestamp and analysis', () => {
      const text = 'I\'m worried about my medication';
      const timestamp = new Date();
      
      analyzer.trackUserUtterance(text, timestamp);
      
      expect(analyzer.userUtterances).toHaveLength(1);
      expect(analyzer.userUtterances[0]).toHaveProperty('text', text);
      expect(analyzer.userUtterances[0]).toHaveProperty('timestamp', timestamp);
      expect(analyzer.userUtterances[0]).toHaveProperty('sentiment');
      expect(analyzer.userUtterances[0]).toHaveProperty('patterns');
      expect(analyzer.userUtterances[0]).toHaveProperty('topics');
    });

    test('should detect anxiety in user utterance', () => {
      const text = 'I\'m so scared and worried';
      analyzer.trackUserUtterance(text, new Date());
      
      expect(analyzer.anxietyEvents).toHaveLength(1);
      expect(analyzer.anxietyEvents[0]).toHaveProperty('text', text);
      expect(analyzer.anxietyEvents[0]).toHaveProperty('intensity');
    });

    test('should detect repetition patterns', () => {
      analyzer.trackUserUtterance('Where is Ryan?', new Date());
      analyzer.trackUserUtterance('Where is Ryan?', new Date());
      
      expect(analyzer.repetitions.size).toBeGreaterThan(0);
    });
  });

  describe('trackAssistantResponse', () => {
    test('should record assistant response with analysis', () => {
      const text = 'That sounds concerning. Let me help you feel better.';
      const timestamp = new Date();
      
      analyzer.trackAssistantResponse(text, timestamp);
      
      expect(analyzer.assistantResponses).toHaveLength(1);
      expect(analyzer.assistantResponses[0]).toHaveProperty('text', text);
      expect(analyzer.assistantResponses[0]).toHaveProperty('timestamp', timestamp);
      expect(analyzer.assistantResponses[0]).toHaveProperty('type');
    });
  });

  describe('trackInterruption', () => {
    test('should increment interruption count and record timestamp', () => {
      const timestamp = new Date();
      analyzer.trackInterruption(timestamp);
      
      expect(analyzer.interruptionCount).toBe(1);
      expect(analyzer.interactions.some(i => i.type === 'interruption')).toBe(true);
    });
  });

  describe('trackFunctionCall', () => {
    test('should record function calls with metadata', () => {
      const functionName = 'transferCall';
      const args = { reason: 'medical emergency' };
      const timestamp = new Date();
      
      analyzer.trackFunctionCall(functionName, args, timestamp);
      
      const functionCall = analyzer.interactions.find(i => i.type === 'function_call');
      expect(functionCall).toBeDefined();
      expect(functionCall.functionName).toBe(functionName);
      expect(functionCall.args).toEqual(args);
    });
  });

  describe('detectRepetition', () => {
    test('should detect similar text using Levenshtein distance', () => {
      const similarity = analyzer.detectRepetition('Where is Ryan?', 'Where is Ryan?');
      expect(similarity).toBe(1.0); // Exact match
    });

    test('should detect high similarity in slightly different text', () => {
      const similarity = analyzer.detectRepetition('Where is Ryan?', 'Where is my son Ryan?');
      expect(similarity).toBeGreaterThan(0.6);
    });

    test('should detect low similarity in different text', () => {
      const similarity = analyzer.detectRepetition('Where is Ryan?', 'I love Hawaii');
      expect(similarity).toBeLessThan(0.3);
    });
  });

  describe('analyzeSentiment', () => {
    test('should analyze sentiment using injected sentiment analyzer', () => {
      const mockSentimentAnalyzer = {
        analyzeSentiment: jest.fn().mockReturnValue({
          anxiety: 0.7,
          agitation: 0.2,
          confusion: 0.1,
          positivity: 0.0,
          overall: -0.6
        })
      };
      
      analyzer.sentimentAnalyzer = mockSentimentAnalyzer;
      const result = analyzer.analyzeSentiment('I\'m worried');
      
      expect(mockSentimentAnalyzer.analyzeSentiment).toHaveBeenCalledWith('I\'m worried');
      expect(result.anxiety).toBe(0.7);
    });
  });

  describe('detectAnxietyMarkers', () => {
    test('should identify anxiety-related words and phrases', () => {
      const anxietyWords = analyzer.detectAnxietyMarkers('I\'m worried and scared about going to the hospital');
      expect(anxietyWords).toContain('worried');
      expect(anxietyWords).toContain('scared');
      expect(anxietyWords).toContain('hospital');
    });

    test('should return empty array for non-anxious text', () => {
      const anxietyWords = analyzer.detectAnxietyMarkers('I had a wonderful day today');
      expect(anxietyWords).toEqual([]);
    });
  });

  describe('detectConfusion', () => {
    test('should identify confusion markers', () => {
      const confusionLevel = analyzer.detectConfusion('I don\'t know where I am or what time it is');
      expect(confusionLevel).toBeGreaterThan(0.5);
    });

    test('should detect low confusion in coherent text', () => {
      const confusionLevel = analyzer.detectConfusion('I remember having lunch and talking with the nurse');
      expect(confusionLevel).toBeLessThan(0.3);
    });
  });

  describe('calculateCoherence', () => {
    test('should assess text coherence in context', () => {
      const context = ['We were talking about your dog', 'You mentioned you had a golden retriever'];
      const coherenceScore = analyzer.calculateCoherence('Yes, I loved that dog so much', context);
      expect(coherenceScore).toBeGreaterThan(0.7);
    });

    test('should detect low coherence for non-sequitur responses', () => {
      const context = ['We were talking about your dog'];
      const coherenceScore = analyzer.calculateCoherence('The purple elephant flies at midnight', context);
      expect(coherenceScore).toBeLessThan(0.3);
    });
  });

  describe('identifyTopics', () => {
    test('should extract and categorize conversation topics', () => {
      const topics = analyzer.identifyTopics('I miss my dog in Hawaii and want to see Ryan');
      expect(topics.memories).toContain('dog');
      expect(topics.memories).toContain('hawaii');
      expect(topics.family).toContain('ryan');
    });
  });

  describe('generateSummary', () => {
    beforeEach(() => {
      // Add some test data
      analyzer.trackUserUtterance('I\'m worried about my medication', new Date());
      analyzer.trackUserUtterance('Where is Ryan?', new Date());
      analyzer.trackAssistantResponse('Let\'s talk about something pleasant', new Date());
      analyzer.endTime = new Date();
    });

    test('should generate comprehensive conversation summary', () => {
      const summary = analyzer.generateSummary();
      
      expect(summary).toHaveProperty('callMetadata');
      expect(summary).toHaveProperty('conversationMetrics');
      expect(summary).toHaveProperty('mentalStateAnalysis');
      expect(summary).toHaveProperty('clinicalIndicators');
      expect(summary).toHaveProperty('behavioralPatterns');
      expect(summary).toHaveProperty('supportEffectiveness');
      expect(summary).toHaveProperty('topicAnalysis');
      
      expect(summary.callMetadata.callSid).toBe(mockCallSid);
      expect(summary.callMetadata.duration).toBeGreaterThan(0);
    });

    test('should calculate conversation metrics', () => {
      const summary = analyzer.generateSummary();
      
      expect(summary.conversationMetrics.totalUtterances).toBeGreaterThan(0);
      expect(summary.conversationMetrics.userUtterances).toBeGreaterThan(0);
      expect(summary.conversationMetrics.assistantResponses).toBeGreaterThan(0);
    });
  });

  describe('generateCaregiverInsights', () => {
    beforeEach(() => {
      analyzer.trackUserUtterance('I\'m worried and confused', new Date());
      analyzer.trackUserUtterance('The staff are mean to me', new Date());
      analyzer.endTime = new Date();
    });

    test('should provide actionable insights for caregivers', () => {
      const insights = analyzer.generateCaregiverInsights();
      
      expect(insights).toHaveProperty('immediateAlerts');
      expect(insights).toHaveProperty('trendAnalysis');
      expect(insights).toHaveProperty('recommendations');
      expect(insights).toHaveProperty('riskAssessment');
    });

    test('should identify high-priority alerts', () => {
      analyzer.hospitalRequests = 3;
      analyzer.painComplaints.push({ text: 'I hurt everywhere', intensity: 0.9 });
      
      const insights = analyzer.generateCaregiverInsights();
      expect(insights.immediateAlerts.length).toBeGreaterThan(0);
      expect(insights.riskAssessment.priority).toBe('critical'); // Corrected expectation
    });

    test('should provide trend analysis', () => {
      // Set up proper mood progression with object structure
      analyzer.moodProgression = [
        { overall: 0.2, anxiety: 0.1, agitation: 0.1, confusion: 0.1 },
        { overall: 0.1, anxiety: 0.2, agitation: 0.1, confusion: 0.2 },
        { overall: -0.2, anxiety: 0.3, agitation: 0.2, confusion: 0.3 },
        { overall: -0.5, anxiety: 0.4, agitation: 0.3, confusion: 0.4 }
      ];
      
      const insights = analyzer.generateCaregiverInsights();
      expect(insights.trendAnalysis).toHaveProperty('moodTrend');
      expect(insights.trendAnalysis.moodTrend).toBe('declining');
    });
  });
});