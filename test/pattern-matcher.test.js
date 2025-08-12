const PatternMatcher = require('../utils/pattern-matcher');

describe('PatternMatcher', () => {
  let matcher;

  beforeEach(() => {
    matcher = new PatternMatcher();
  });

  describe('constructor', () => {
    test('should initialize with clinical patterns', () => {
      expect(matcher.patterns).toHaveProperty('medicationConcern');
      expect(matcher.patterns).toHaveProperty('painComplaint');
      expect(matcher.patterns).toHaveProperty('hospitalRequest');
      expect(matcher.patterns).toHaveProperty('staffComplaint');
      expect(matcher.patterns).toHaveProperty('delusional');
      expect(matcher.patterns).toHaveProperty('sundowning');
      expect(matcher.patterns).toHaveProperty('repetition');
    });
  });

  describe('detectPatterns', () => {
    test('should detect medication concerns', () => {
      const text = "I need my medication and can't find my pills";
      const patterns = matcher.detectPatterns(text);
      const medicationPattern = patterns.find(p => p.type === 'medicationConcern');
      expect(medicationPattern).toBeDefined();
      expect(medicationPattern.match).toBeDefined();
      expect(medicationPattern.timestamp).toBeDefined();
    });

    test('should detect pain complaints', () => {
      const text = "My back really hurts and the pain is getting worse";
      const patterns = matcher.detectPatterns(text);
      const painPattern = patterns.find(p => p.type === 'painComplaint');
      expect(painPattern).toBeDefined();
    });

    test('should detect hospital requests', () => {
      const text = "I need to go to the hospital or see a doctor";
      const patterns = matcher.detectPatterns(text);
      const hospitalPattern = patterns.find(p => p.type === 'hospitalRequest');
      expect(hospitalPattern).toBeDefined();
    });

    test('should detect staff complaints', () => {
      const text = "The nurses are being mean and won't help me";
      const patterns = matcher.detectPatterns(text);
      const staffPattern = patterns.find(p => p.type === 'staffComplaint');
      expect(staffPattern).toBeDefined();
    });

    test('should detect delusional thoughts', () => {
      const text = "Someone is in my room watching me and stealing my things";
      const patterns = matcher.detectPatterns(text);
      const delusionalPattern = patterns.find(p => p.type === 'delusional');
      expect(delusionalPattern).toBeDefined();
    });

    test('should detect sundowning behavior', () => {
      const text = "I need to go home now, where am I?";
      const patterns = matcher.detectPatterns(text);
      const sundowningPattern = patterns.find(p => p.type === 'sundowning');
      expect(sundowningPattern).toBeDefined();
    });

    test('should detect multiple patterns in single text', () => {
      const text = "The staff are mean and I hurt everywhere and need to go to the hospital";
      const patterns = matcher.detectPatterns(text);
      expect(patterns.length).toBeGreaterThan(1);
      expect(patterns.some(p => p.type === 'staffComplaint')).toBe(true);
      expect(patterns.some(p => p.type === 'painComplaint')).toBe(true);
      expect(patterns.some(p => p.type === 'hospitalRequest')).toBe(true);
    });

    test('should return empty array for normal conversation', () => {
      const text = "I had a nice day today and enjoyed talking with you";
      const patterns = matcher.detectPatterns(text);
      expect(patterns).toEqual([]);
    });
  });

  describe('calculateRepetitionScore', () => {
    test('should calculate high score for repeated utterances', () => {
      const utterances = [
        "Where is Ryan?",
        "Where is Ryan?",
        "Is Ryan coming?",
        "Where is Ryan?"
      ];
      const score = matcher.calculateRepetitionScore(utterances);
      expect(score).toBeGreaterThan(0.5);
    });

    test('should calculate low score for varied conversation', () => {
      const utterances = [
        "How are you today?",
        "I had lunch earlier",
        "The weather is nice",
        "I miss my dog"
      ];
      const score = matcher.calculateRepetitionScore(utterances);
      expect(score).toBeLessThan(0.3);
    });
  });

  describe('detectSundowningRisk', () => {
    test('should detect high risk during evening hours with agitated behavior', () => {
      const eveningTime = new Date();
      eveningTime.setHours(18, 0, 0); // 6 PM
      const behaviors = ['agitation', 'confusion', 'wanting to leave'];
      
      const risk = matcher.detectSundowningRisk(eveningTime, behaviors);
      expect(risk).toHaveProperty('level');
      expect(risk).toHaveProperty('factors');
      expect(risk.level).toBe('high');
    });

    test('should detect low risk during morning hours', () => {
      const morningTime = new Date();
      morningTime.setHours(10, 0, 0); // 10 AM
      const behaviors = ['calm', 'coherent'];
      
      const risk = matcher.detectSundowningRisk(morningTime, behaviors);
      expect(risk.level).toBe('low');
    });
  });

  describe('assessUTIIndicators', () => {
    test('should detect UTI risk with sudden confusion spike', () => {
      const confusionLevel = 0.8;
      const timePattern = 'sudden_onset';
      
      const assessment = matcher.assessUTIIndicators(confusionLevel, timePattern);
      expect(assessment).toHaveProperty('risk');
      expect(assessment).toHaveProperty('indicators');
      expect(assessment.risk).toBe('high');
    });

    test('should detect low UTI risk with gradual confusion', () => {
      const confusionLevel = 0.3;
      const timePattern = 'gradual';
      
      const assessment = matcher.assessUTIIndicators(confusionLevel, timePattern);
      expect(assessment.risk).toBe('low');
    });
  });
});