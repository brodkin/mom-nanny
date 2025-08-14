const KeywordExtractor = require('../utils/keyword-extractor');

describe('KeywordExtractor', () => {
  let extractor;

  beforeEach(() => {
    extractor = new KeywordExtractor();
  });

  describe('constructor', () => {
    test('should initialize with stop words and topic categories', () => {
      expect(extractor.stopWords.has('the')).toBe(true);
      expect(extractor.stopWords.has('is')).toBe(true);
      expect(extractor.topicCategories).toHaveProperty('family');
      expect(extractor.topicCategories).toHaveProperty('health');
      expect(extractor.topicCategories).toHaveProperty('facility');
      expect(extractor.topicCategories).toHaveProperty('memories');
      expect(extractor.topicCategories).toHaveProperty('emotions');
    });
  });

  describe('extractKeywords', () => {
    test('should extract meaningful keywords from text', () => {
      const text = 'I really miss my dog and want to go home to Hawaii';
      const keywords = extractor.extractKeywords(text);
      
      expect(keywords).toContain('miss');
      expect(keywords).toContain('dog');
      expect(keywords).toContain('home');
      expect(keywords).toContain('hawaii');
      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('to');
      expect(keywords).not.toContain('and');
    });

    test('should filter out stop words', () => {
      const text = 'The dog is at the house which is on a hill';
      const keywords = extractor.extractKeywords(text);
      
      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('is');
      expect(keywords).not.toContain('at');
      expect(keywords).not.toContain('which');
      expect(keywords).not.toContain('on');
      expect(keywords).not.toContain('a');
    });

    test('should filter out words shorter than 3 characters', () => {
      const text = 'I go to my house by car';
      const keywords = extractor.extractKeywords(text);
      
      expect(keywords).not.toContain('I');
      expect(keywords).not.toContain('go');
      expect(keywords).not.toContain('to');
      expect(keywords).not.toContain('my');
      expect(keywords).not.toContain('by');
      expect(keywords).toContain('house');
      expect(keywords).toContain('car');
    });

    test('should handle empty text', () => {
      const keywords = extractor.extractKeywords('');
      expect(keywords).toEqual([]);
    });

    test('should convert text to lowercase', () => {
      const text = 'HAWAII Dog FAMILY';
      const keywords = extractor.extractKeywords(text);
      
      expect(keywords).toContain('hawaii');
      expect(keywords).toContain('dog');
      expect(keywords).toContain('family');
    });
  });

  describe('categorizeTopics', () => {
    test('should categorize family-related keywords', () => {
      const keywords = ['ryan', 'son', 'family', 'grandchildren'];
      const categories = extractor.categorizeTopics(keywords);
      
      expect(categories).toHaveProperty('family');
      expect(categories.family.length).toBeGreaterThan(0);
      expect(categories.family).toContain('ryan');
      expect(categories.family).toContain('son');
    });

    test('should categorize health-related keywords', () => {
      const keywords = ['doctor', 'medicine', 'pain', 'hospital'];
      const categories = extractor.categorizeTopics(keywords);
      
      expect(categories).toHaveProperty('health');
      expect(categories.health).toContain('doctor');
      expect(categories.health).toContain('medicine');
    });

    test('should categorize facility-related keywords', () => {
      const keywords = ['room', 'staff', 'nurse', 'food'];
      const categories = extractor.categorizeTopics(keywords);
      
      expect(categories).toHaveProperty('facility');
      expect(categories.facility).toContain('room');
      expect(categories.facility).toContain('staff');
    });

    test('should categorize memory-related keywords', () => {
      const keywords = ['hawaii', 'dog', 'house', 'remember'];
      const categories = extractor.categorizeTopics(keywords);
      
      expect(categories).toHaveProperty('memories');
      expect(categories.memories).toContain('hawaii');
      expect(categories.memories).toContain('dog');
    });

    test('should handle uncategorized keywords', () => {
      const keywords = ['random', 'unknown', 'test'];
      const categories = extractor.categorizeTopics(keywords);
      
      expect(categories).toHaveProperty('uncategorized');
      expect(categories.uncategorized).toContain('random');
      expect(categories.uncategorized).toContain('unknown');
    });
  });

  describe('findDominantThemes', () => {
    test('should identify most frequent conversation themes', () => {
      const conversations = [
        ['hawaii', 'dog', 'family'],
        ['hawaii', 'beach', 'vacation'],
        ['dog', 'pet', 'love'],
        ['hawaii', 'sunset', 'beautiful']
      ];
      
      const themes = extractor.findDominantThemes(conversations);
      expect(themes).toHaveProperty('themes');
      expect(themes).toHaveProperty('frequencies');
      expect(themes.themes[0]).toBe('hawaii'); // Most frequent
    });

    test('should handle empty conversations array', () => {
      const themes = extractor.findDominantThemes([]);
      expect(themes.themes).toEqual([]);
      expect(themes.frequencies).toEqual({});
    });
  });

  describe('identifyTriggerWords', () => {
    test('should identify words associated with negative emotional events', () => {
      const negativeEvents = [
        { keywords: ['hospital', 'pain', 'scared'], emotion: 'anxiety' },
        { keywords: ['staff', 'mean', 'angry'], emotion: 'agitation' },
        { keywords: ['confused', 'lost', 'help'], emotion: 'confusion' }
      ];
      
      const triggerWords = extractor.identifyTriggerWords(negativeEvents);
      expect(triggerWords).toHaveProperty('anxiety');
      expect(triggerWords).toHaveProperty('agitation');
      expect(triggerWords).toHaveProperty('confusion');
      expect(triggerWords.anxiety).toContain('hospital');
      expect(triggerWords.agitation).toContain('staff');
      expect(triggerWords.confusion).toContain('confused');
    });
  });

  describe('identifyCalmingTopics', () => {
    test('should identify topics that correlate with improved mood', () => {
      const positiveEvents = [
        { keywords: ['hawaii', 'beach', 'sunset'], mood: 0.8 },
        { keywords: ['dog', 'pet', 'love'], mood: 0.7 },
        { keywords: ['family', 'ryan', 'visit'], mood: 0.6 }
      ];
      
      const calmingTopics = extractor.identifyCalmingTopics(positiveEvents);
      expect(calmingTopics).toHaveProperty('topics');
      expect(calmingTopics).toHaveProperty('effectiveness');
      expect(calmingTopics.topics).toContain('hawaii');
      expect(calmingTopics.topics).toContain('dog');
    });

    test('should rank calming topics by effectiveness', () => {
      const positiveEvents = [
        { keywords: ['hawaii'], mood: 0.9 },
        { keywords: ['dog'], mood: 0.6 },
        { keywords: ['family'], mood: 0.8 }
      ];
      
      const calmingTopics = extractor.identifyCalmingTopics(positiveEvents);
      expect(calmingTopics.topics[0]).toBe('hawaii'); // Highest mood score
    });
  });
});