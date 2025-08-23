const { GptService } = require('../services/gpt-service');
const { MarkCompletionService } = require('../services/mark-completion-service');

describe('GPT Emotional Analysis', () => {
  let gptService;
  let markCompletionService;

  beforeEach(() => {
    markCompletionService = new MarkCompletionService();
    gptService = new GptService(markCompletionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeEmotionalState', () => {
    test('should return default values in test environment', async () => {
      const mockInteractions = [
        {
          type: 'user_utterance',
          text: 'I feel worried about my health',
          timestamp: new Date().toISOString()
        },
        {
          type: 'assistant_response', 
          text: 'I understand you are feeling worried. That is very normal.',
          timestamp: new Date().toISOString()
        }
      ];

      const result = await gptService.analyzeEmotionalState(mockInteractions);

      expect(result).toEqual({
        anxietyLevel: 25.5,
        anxietyPeak: 65.0,
        anxietyTrend: 'decreasing',
        confusionLevel: 40.0,
        confusionPeak: 75.0,
        confusionTrend: 'stable',
        agitationLevel: 15.0,
        agitationPeak: 30.0,
        agitationTrend: 'stable',
        overallMood: 20.5,
        moodTrend: 'improving',
        analysisConfidence: 0.85,
        keyObservations: [
          'Mock analysis for testing',
          'Simulated emotional metrics'
        ]
      });
    });

    test('should handle string input format', async () => {
      const conversationText = 'User: I am feeling anxious\nAssistant: I understand your feelings.';

      const result = await gptService.analyzeEmotionalState(conversationText);

      // Should return mock data in test environment
      expect(result.anxietyLevel).toBe(25.5);
      expect(result.keyObservations).toContain('Mock analysis for testing');
    });

    test('should throw error for invalid input', async () => {
      await expect(async () => {
        await gptService.analyzeEmotionalState(null);
      }).rejects.toThrow('Invalid conversation transcript format');
    });

    test('should validate all required fields are present', async () => {
      const result = await gptService.analyzeEmotionalState([]);

      // Check all required fields exist
      expect(result).toHaveProperty('anxietyLevel');
      expect(result).toHaveProperty('anxietyPeak');
      expect(result).toHaveProperty('anxietyTrend');
      expect(result).toHaveProperty('confusionLevel');
      expect(result).toHaveProperty('confusionPeak');
      expect(result).toHaveProperty('confusionTrend');
      expect(result).toHaveProperty('agitationLevel');
      expect(result).toHaveProperty('agitationPeak');
      expect(result).toHaveProperty('agitationTrend');
      expect(result).toHaveProperty('overallMood');
      expect(result).toHaveProperty('moodTrend');
      expect(result).toHaveProperty('analysisConfidence');
      expect(result).toHaveProperty('keyObservations');
    });

    test('should return numeric values for metrics', async () => {
      const result = await gptService.analyzeEmotionalState([]);

      expect(typeof result.anxietyLevel).toBe('number');
      expect(typeof result.confusionLevel).toBe('number');
      expect(typeof result.agitationLevel).toBe('number');
      expect(typeof result.overallMood).toBe('number');
      expect(typeof result.analysisConfidence).toBe('number');
      expect(Array.isArray(result.keyObservations)).toBe(true);
    });
  });
});