const SentimentAnalyzer = require('../utils/sentiment-analyzer');

describe('SentimentAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new SentimentAnalyzer();
  });

  describe('constructor', () => {
    test('should initialize with emotion lexicons and weights', () => {
      expect(analyzer.anxietyWords).toContain('worried');
      expect(analyzer.agitationWords).toContain('angry');
      expect(analyzer.confusionWords).toContain('confused');
      expect(analyzer.positiveWords).toContain('happy');
      expect(analyzer.weights.anxiety).toBe(1.5);
    });
  });

  describe('analyzeSentiment', () => {
    test('should detect anxiety in text', () => {
      const result = analyzer.analyzeSentiment("I'm so worried and scared about this");
      expect(result.anxiety).toBeGreaterThan(0);
      expect(result).toHaveProperty('agitation');
      expect(result).toHaveProperty('confusion');
      expect(result).toHaveProperty('positivity');
      expect(result).toHaveProperty('overall');
    });

    test('should detect agitation markers', () => {
      const result = analyzer.analyzeSentiment("I'm so angry and frustrated right now");
      expect(result.agitation).toBeGreaterThan(0);
    });

    test('should detect confusion indicators', () => {
      const result = analyzer.analyzeSentiment("I'm so confused and can't remember anything");
      expect(result.confusion).toBeGreaterThan(0);
    });

    test('should detect positive emotions', () => {
      const result = analyzer.analyzeSentiment("I'm happy and having a wonderful day");
      expect(result.positivity).toBeGreaterThan(0);
    });

    test('should handle empty text', () => {
      const result = analyzer.analyzeSentiment("");
      expect(result.anxiety).toBe(0);
      expect(result.agitation).toBe(0);
      expect(result.confusion).toBe(0);
      expect(result.positivity).toBe(0);
    });
  });

  describe('detectEmotionalShift', () => {
    test('should detect significant mood changes', () => {
      const previousMood = { overall: 0.2 };
      const currentMood = { overall: -0.8 };
      const shift = analyzer.detectEmotionalShift(previousMood, currentMood);
      expect(shift).toHaveProperty('magnitude');
      expect(shift).toHaveProperty('direction');
      expect(shift.magnitude).toBeGreaterThan(0.5);
    });
  });

  describe('calculateTrend', () => {
    test('should identify declining mood trend', () => {
      const moodArray = [0.5, 0.2, -0.1, -0.4, -0.7];
      const trend = analyzer.calculateTrend(moodArray);
      expect(trend).toHaveProperty('direction');
      expect(trend).toHaveProperty('strength');
      expect(trend.direction).toBe('declining');
    });

    test('should identify improving mood trend', () => {
      const moodArray = [-0.7, -0.4, -0.1, 0.2, 0.5];
      const trend = analyzer.calculateTrend(moodArray);
      expect(trend.direction).toBe('improving');
    });
  });
});