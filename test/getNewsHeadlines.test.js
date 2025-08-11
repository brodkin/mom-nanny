// Create a mock Parser class
const mockParseURL = jest.fn();

jest.mock('rss-parser', () => {
  return jest.fn().mockImplementation(() => {
    return {
      parseURL: mockParseURL
    };
  });
});

const getNewsHeadlines = require('../functions/getNewsHeadlines');

describe('getNewsHeadlines function', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Set up the default successful mock
    mockParseURL.mockResolvedValue({
      items: [
        {
          title: 'Breaking News: Major Scientific Discovery',
          contentSnippet: 'Scientists have made a groundbreaking discovery in quantum physics. The research could revolutionize our understanding of the universe. Further studies are planned for next year.',
        },
        {
          title: 'Technology Update: New AI Breakthrough',
          description: 'Researchers announce major advancement in artificial intelligence. The new system shows remarkable capabilities. Industry experts are excited about potential applications.',
        },
        {
          title: 'Weather Alert: Beautiful Weekend Ahead',
          contentSnippet: 'Meteorologists predict sunny skies and mild temperatures this weekend. Perfect conditions for outdoor activities are expected. No rain is forecast for the next week.',
        },
        {
          title: 'Entertainment: Award Show Highlights',
          content: 'Last night\'s award ceremony featured stunning performances. Several surprise wins delighted audiences. The event raised millions for charity.',
        },
        {
          title: 'Health News: New Study on Exercise',
          contentSnippet: 'A new study reveals the benefits of daily walking. Just 30 minutes a day can improve health significantly. Researchers recommend making it a daily habit.',
        }
      ]
    });
  });

  test('should return news headlines with correct structure', async () => {
    const result = await getNewsHeadlines();
    const parsed = JSON.parse(result);
    
    expect(parsed).toHaveProperty('category');
    expect(parsed).toHaveProperty('headlines');
    expect(Array.isArray(parsed.headlines)).toBe(true);
    expect(parsed.headlines).toHaveLength(5);
  });

  test('each headline should have title and summary', async () => {
    const result = await getNewsHeadlines();
    const parsed = JSON.parse(result);
    
    parsed.headlines.forEach(headline => {
      expect(headline).toHaveProperty('headline');
      expect(headline).toHaveProperty('summary');
      expect(typeof headline.headline).toBe('string');
      expect(typeof headline.summary).toBe('string');
    });
  });

  test('category should be one of the expected values', async () => {
    const result = await getNewsHeadlines();
    const parsed = JSON.parse(result);
    
    const validCategories = ['general news', 'health news', 'science news', 'entertainment news'];
    expect(validCategories).toContain(parsed.category);
  });

  test('should handle errors gracefully', async () => {
    // Mock an error scenario
    mockParseURL.mockRejectedValueOnce(new Error('Network error'));
    
    const result = await getNewsHeadlines();
    const parsed = JSON.parse(result);
    
    expect(parsed).toHaveProperty('error');
    expect(parsed.error).toBe('Unable to fetch news at this time');
    expect(parsed.headlines).toEqual([]);
  });
});