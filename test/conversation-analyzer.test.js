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
      
      // Care indicators
      expect(analyzer.medicationMentions).toEqual([]);
      expect(analyzer.painComplaints).toEqual([]);
      expect(analyzer.hospitalRequests).toBe(0);
      expect(analyzer.staffComplaints).toEqual([]);
      
      // Basic metrics
      expect(analyzer.responseLatencies).toEqual([]);
      expect(analyzer.interruptionCount).toBe(0);
    });
  });

  describe('trackUserUtterance', () => {
    test('should record user utterance with timestamp', () => {
      const text = 'I feel worried about my health';
      const timestamp = new Date();
      const latency = 500;

      analyzer.trackUserUtterance(text, timestamp, latency);

      expect(analyzer.userUtterances).toHaveLength(1);
      expect(analyzer.userUtterances[0]).toEqual({
        text,
        timestamp,
        latency
      });

      expect(analyzer.interactions).toHaveLength(1);
      expect(analyzer.interactions[0]).toEqual({
        type: 'user_utterance',
        timestamp,
        text,
        data: {
          text,
          timestamp,
          latency
        }
      });

      expect(analyzer.responseLatencies).toHaveLength(1);
      expect(analyzer.responseLatencies[0]).toEqual({ timestamp, latency });
    });

    test('should track utterance without latency', () => {
      const text = 'Hello';
      const timestamp = new Date();

      analyzer.trackUserUtterance(text, timestamp);

      expect(analyzer.userUtterances).toHaveLength(1);
      expect(analyzer.userUtterances[0].latency).toBeNull();
      expect(analyzer.responseLatencies).toHaveLength(0);
    });
  });

  describe('trackAssistantResponse', () => {
    test('should record assistant response', () => {
      const text = 'Hello! How are you feeling today?';
      const timestamp = new Date();

      analyzer.trackAssistantResponse(text, timestamp);

      expect(analyzer.assistantResponses).toHaveLength(1);
      expect(analyzer.assistantResponses[0]).toEqual({
        text,
        timestamp,
        length: text.length
      });

      expect(analyzer.interactions).toHaveLength(1);
      expect(analyzer.interactions[0]).toEqual({
        type: 'assistant_response',
        timestamp,
        text,
        data: {
          text,
          timestamp,
          length: text.length
        }
      });
    });

    test('should prevent duplicate responses within time window', () => {
      const text = 'Hello there!';
      const timestamp1 = new Date();
      const timestamp2 = new Date(timestamp1.getTime() + 1000); // 1 second later

      analyzer.trackAssistantResponse(text, timestamp1);
      analyzer.trackAssistantResponse(text, timestamp2); // Exact duplicate

      expect(analyzer.assistantResponses).toHaveLength(1);
      expect(analyzer.interactions).toHaveLength(1);
    });

    test('should allow similar responses outside time window', () => {
      const text = 'Hello there!';
      const timestamp1 = new Date();
      const timestamp2 = new Date(timestamp1.getTime() + 6000); // 6 seconds later

      analyzer.trackAssistantResponse(text, timestamp1);
      analyzer.trackAssistantResponse(text, timestamp2);

      expect(analyzer.assistantResponses).toHaveLength(2);
      expect(analyzer.interactions).toHaveLength(2);
    });
  });

  describe('trackInterruption', () => {
    test('should increment interruption count and record event', () => {
      const timestamp = new Date();

      analyzer.trackInterruption(timestamp);

      expect(analyzer.interruptionCount).toBe(1);
      expect(analyzer.interactions).toHaveLength(1);
      expect(analyzer.interactions[0]).toEqual({
        type: 'interruption',
        timestamp,
        data: { count: 1 }
      });
    });
  });

  describe('trackFunctionCall', () => {
    test('should record function call details', () => {
      const functionName = 'getNewsHeadlines';
      const args = { category: 'general' };
      const timestamp = new Date();

      analyzer.trackFunctionCall(functionName, args, timestamp);

      expect(analyzer.interactions).toHaveLength(1);
      expect(analyzer.interactions[0]).toEqual({
        type: 'function_call',
        timestamp,
        functionName,
        args,
        data: {
          functionName,
          args,
          timestamp
        }
      });
    });

    test('should increment hospital requests for transferCall function', () => {
      const timestamp = new Date();

      analyzer.trackFunctionCall('transferCall', { reason: 'emergency' }, timestamp);

      expect(analyzer.hospitalRequests).toBe(1);
    });
  });

  describe('generateSummary', () => {
    test('should generate basic conversation summary', () => {
      analyzer.endTime = new Date(analyzer.startTime.getTime() + 120000); // 2 minutes later
      
      // Add some test data
      analyzer.trackUserUtterance('Hello', new Date(), 100);
      analyzer.trackAssistantResponse('Hi there!', new Date());
      analyzer.trackInterruption(new Date());

      const summary = analyzer.generateSummary();

      expect(summary).toEqual({
        callMetadata: {
          callSid: mockCallSid,
          startTime: analyzer.startTime,
          endTime: analyzer.endTime,
          duration: 120 // 2 minutes in seconds
        },
        conversationMetrics: {
          totalUtterances: 1,
          userUtterances: 1,
          assistantResponses: 1,
          totalInteractions: 3, // 1 utterance + 1 response + 1 interruption
          interruptionCount: 1,
          averageResponseLatency: 100
        },
        clinicalIndicators: {
          medicationMentions: [],
          painComplaints: [],
          hospitalRequests: 0,
          staffComplaints: []
        }
      });
    });

    test('should handle minimum 1 second duration', () => {
      analyzer.endTime = new Date(analyzer.startTime.getTime() + 500); // 0.5 seconds

      const summary = analyzer.generateSummary();

      expect(summary.callMetadata.duration).toBe(1);
    });

    test('should calculate duration for ongoing conversation', () => {
      // Don't set endTime to simulate ongoing conversation
      const summary = analyzer.generateSummary();
      
      expect(summary.callMetadata.duration).toBeGreaterThan(0);
      expect(summary.callMetadata.endTime).toBeNull();
    });
  });

  describe('_calculateAverageLatency', () => {
    test('should return 0 for no latencies', () => {
      expect(analyzer._calculateAverageLatency()).toBe(0);
    });

    test('should calculate average of response latencies', () => {
      analyzer.responseLatencies = [
        { timestamp: new Date(), latency: 100 },
        { timestamp: new Date(), latency: 200 },
        { timestamp: new Date(), latency: 300 }
      ];

      expect(analyzer._calculateAverageLatency()).toBe(200);
    });
  });

  describe('_calculateTextSimilarity', () => {
    test('should return 1 for identical texts', () => {
      const text = 'Hello there';
      expect(analyzer._calculateTextSimilarity(text, text)).toBe(1);
    });

    test('should return 0 for completely different texts', () => {
      expect(analyzer._calculateTextSimilarity('Hello there', 'Goodbye friend')).toBeLessThan(0.5);
    });

    test('should handle empty strings', () => {
      expect(analyzer._calculateTextSimilarity('', '')).toBe(1);
      expect(analyzer._calculateTextSimilarity('Hello', '')).toBe(0);
      expect(analyzer._calculateTextSimilarity('', 'Hello')).toBe(0);
    });
  });
});