/**
 * KeywordExtractor - Topic extraction and categorization for dementia care
 * Identifies conversation themes, trigger words, and calming topics
 */
class KeywordExtractor {
  constructor() {
    // Stop words to filter out
    this.stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in',
      'with', 'to', 'for', 'of', 'as', 'by', 'that', 'this', 'it', 'he', 'she',
      'they', 'we', 'you', 'i', 'me', 'my', 'your', 'his', 'her', 'their',
      'be', 'have', 'do', 'will', 'can', 'could', 'would', 'should', 'may',
      'might', 'must', 'am', 'are', 'was', 'were', 'been', 'being', 'had',
      'has', 'did', 'does', 'done', 'get', 'got', 'go', 'going', 'went'
    ]);

    // Topic categories relevant to dementia care
    this.topicCategories = {
      family: [
        'ryan', 'son', 'daughter', 'family', 'grandchildren', 'children',
        'husband', 'wife', 'mother', 'father', 'brother', 'sister',
        'grandson', 'granddaughter', 'uncle', 'aunt', 'cousin', 'nephew',
        'niece', 'relatives', 'visit', 'visitors'
      ],
      health: [
        'doctor', 'medicine', 'medication', 'pills', 'pain', 'sick', 'hospital',
        'nurse', 'appointment', 'prescription', 'surgery', 'treatment',
        'symptoms', 'diagnosis', 'therapy', 'blood', 'pressure', 'heart',
        'diabetes', 'arthritis', 'memory', 'confusion', 'tired'
      ],
      facility: [
        'room', 'staff', 'nurse', 'food', 'bed', 'dining', 'activities',
        'building', 'hallway', 'bathroom', 'shower', 'laundry', 'cleaning',
        'maintenance', 'administrator', 'director', 'aide', 'helper',
        'schedule', 'routine', 'rules', 'policy'
      ],
      memories: [
        'hawaii', 'dog', 'house', 'home', 'used to', 'remember', 'long ago',
        'young', 'childhood', 'school', 'work', 'job', 'career', 'friends',
        'neighbors', 'church', 'vacation', 'trip', 'wedding', 'birthday',
        'christmas', 'holiday', 'celebration', 'garden', 'cooking'
      ],
      emotions: [
        'sad', 'happy', 'lonely', 'scared', 'worried', 'angry', 'frustrated',
        'confused', 'anxious', 'peaceful', 'comfortable', 'upset', 'mad',
        'glad', 'content', 'nervous', 'calm', 'relaxed', 'stressed',
        'overwhelmed', 'hopeful', 'grateful', 'disappointed'
      ],
      activities: [
        'eat', 'sleep', 'walk', 'exercise', 'read', 'watch', 'television',
        'music', 'sing', 'dance', 'play', 'games', 'cards', 'puzzle',
        'craft', 'painting', 'garden', 'cook', 'bake', 'shopping',
        'church', 'service', 'meeting', 'group', 'social'
      ],
      time: [
        'morning', 'afternoon', 'evening', 'night', 'today', 'yesterday',
        'tomorrow', 'week', 'weekend', 'monday', 'tuesday', 'wednesday',
        'thursday', 'friday', 'saturday', 'sunday', 'early', 'late',
        'time', 'clock', 'schedule', 'appointment', 'when', 'now', 'soon'
      ]
    };

    // Create reverse lookup for faster categorization
    this.wordToCategory = new Map();
    for (const [category, words] of Object.entries(this.topicCategories)) {
      words.forEach(word => {
        this.wordToCategory.set(word.toLowerCase(), category);
      });
    }
  }

  /**
   * Extract meaningful keywords from text
   * @param {string} text - Input text to process
   * @returns {Array<string>} Filtered keywords
   */
  extractKeywords(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    // Clean and split text
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(word => 
        word.length > 2 && 
        !this.stopWords.has(word) &&
        !this.isNumber(word)
      );

    // Remove duplicates and return
    return [...new Set(words)];
  }

  /**
   * Check if a word is a number
   * @param {string} word - Word to check
   * @returns {boolean} True if word is numeric
   */
  isNumber(word) {
    return /^\d+$/.test(word);
  }

  /**
   * Categorize keywords into topic groups
   * @param {Array<string>} keywords - Keywords to categorize
   * @returns {Object} Categorized keywords
   */
  categorizeTopics(keywords) {
    const categorized = {};
    const uncategorized = [];

    // Initialize all categories
    for (const category of Object.keys(this.topicCategories)) {
      categorized[category] = [];
    }

    // Categorize each keyword
    keywords.forEach(keyword => {
      const category = this.wordToCategory.get(keyword.toLowerCase());
      if (category) {
        categorized[category].push(keyword);
      } else {
        uncategorized.push(keyword);
      }
    });

    // Add uncategorized words if any exist
    if (uncategorized.length > 0) {
      categorized.uncategorized = uncategorized;
    }

    // Remove empty categories for cleaner output
    const filtered = {};
    for (const [category, words] of Object.entries(categorized)) {
      if (words.length > 0) {
        filtered[category] = words;
      }
    }

    return filtered;
  }

  /**
   * Find dominant themes across multiple conversations
   * @param {Array<Array<string>>} conversations - Array of keyword arrays
   * @returns {Object} Dominant themes with frequencies
   */
  findDominantThemes(conversations) {
    if (!conversations || conversations.length === 0) {
      return { themes: [], frequencies: {} };
    }

    const wordFrequency = {};
    const categoryFrequency = {};

    // Count word and category frequencies
    conversations.forEach(keywords => {
      const uniqueWords = new Set(keywords);
      const categorized = this.categorizeTopics([...uniqueWords]);

      // Count individual words
      uniqueWords.forEach(word => {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      });

      // Count categories
      Object.keys(categorized).forEach(category => {
        if (categorized[category].length > 0) {
          categoryFrequency[category] = (categoryFrequency[category] || 0) + 1;
        }
      });
    });

    // Sort words by frequency
    const sortedWords = Object.entries(wordFrequency)
      .sort(([,a], [,b]) => b - a)
      .map(([word]) => word);

    // Sort categories by frequency
    const sortedCategories = Object.entries(categoryFrequency)
      .sort(([,a], [,b]) => b - a)
      .map(([category]) => category);

    return {
      themes: sortedWords.slice(0, 10), // Top 10 most frequent words
      categories: sortedCategories.slice(0, 5), // Top 5 categories
      frequencies: wordFrequency,
      categoryFrequencies: categoryFrequency,
      totalConversations: conversations.length
    };
  }

  /**
   * Identify trigger words associated with negative emotional events
   * @param {Array<Object>} negativeEvents - Events with keywords and emotion data
   * @returns {Object} Trigger words grouped by emotion type
   */
  identifyTriggerWords(negativeEvents) {
    const triggerWords = {
      anxiety: [],
      agitation: [],
      confusion: [],
      general: []
    };

    if (!negativeEvents || negativeEvents.length === 0) {
      return triggerWords;
    }

    const wordEmotionMap = {};

    // Analyze each negative event
    negativeEvents.forEach(event => {
      const { keywords, emotion } = event;
      if (keywords && emotion) {
        keywords.forEach(keyword => {
          if (!wordEmotionMap[keyword]) {
            wordEmotionMap[keyword] = { anxiety: 0, agitation: 0, confusion: 0, general: 0 };
          }
          wordEmotionMap[keyword][emotion] = (wordEmotionMap[keyword][emotion] || 0) + 1;
        });
      }
    });

    // Categorize words by their strongest emotional association
    Object.entries(wordEmotionMap).forEach(([word, emotions]) => {
      let maxEmotion = 'general';
      let maxCount = emotions.general;

      Object.entries(emotions).forEach(([emotion, count]) => {
        if (count > maxCount && emotion !== 'general') {
          maxEmotion = emotion;
          maxCount = count;
        }
      });

      if (maxCount >= 1) { // Include words that appear at least once
        triggerWords[maxEmotion].push({
          word,
          frequency: maxCount,
          associations: emotions
        });
      }
    });

    // Sort by frequency within each category
    Object.keys(triggerWords).forEach(emotion => {
      triggerWords[emotion].sort((a, b) => b.frequency - a.frequency);
      triggerWords[emotion] = triggerWords[emotion].map(item => item.word);
    });

    return triggerWords;
  }

  /**
   * Identify topics that correlate with improved mood
   * @param {Array<Object>} positiveEvents - Events with keywords and mood scores
   * @returns {Object} Calming topics ranked by effectiveness
   */
  identifyCalmingTopics(positiveEvents) {
    if (!positiveEvents || positiveEvents.length === 0) {
      return { topics: [], effectiveness: {} };
    }

    const topicMoodMap = {};

    // Analyze each positive event
    positiveEvents.forEach(event => {
      const { keywords, mood } = event;
      if (keywords && typeof mood === 'number') {
        keywords.forEach(keyword => {
          if (!topicMoodMap[keyword]) {
            topicMoodMap[keyword] = { totalMood: 0, count: 0 };
          }
          topicMoodMap[keyword].totalMood += mood;
          topicMoodMap[keyword].count += 1;
        });
      }
    });

    // Calculate average mood for each topic
    const effectiveness = {};
    Object.entries(topicMoodMap).forEach(([topic, data]) => {
      effectiveness[topic] = data.totalMood / data.count;
    });

    // Sort topics by effectiveness (average mood improvement)
    const sortedTopics = Object.entries(effectiveness)
      .filter(([, avgMood]) => avgMood > 0.3) // Only include significantly positive topics
      .sort(([, a], [, b]) => b - a)
      .map(([topic]) => topic);

    return {
      topics: sortedTopics,
      effectiveness,
      totalEvents: positiveEvents.length,
      categories: this.categorizeTopics(sortedTopics)
    };
  }

  /**
   * Extract named entities (simple implementation)
   * @param {string} text - Text to analyze
   * @returns {Object} Named entities by type
   */
  extractNamedEntities(text) {
    const entities = {
      people: [],
      places: [],
      organizations: [],
      times: []
    };

    if (!text) return entities;

    // Simple patterns for common entities in dementia care context
    const patterns = {
      people: /\b(?:ryan|dr\.?\s+\w+|nurse\s+\w+|mom|dad)\b/gi,
      places: /\b(?:hawaii|hospital|room\s+\d+|dining\s+room|bathroom)\b/gi,
      organizations: /\b(?:medicare|social\s+security|insurance)\b/gi,
      times: /\b(?:yesterday|today|tomorrow|morning|afternoon|evening)\b/gi
    };

    Object.entries(patterns).forEach(([type, pattern]) => {
      const matches = text.match(pattern);
      if (matches) {
        entities[type] = [...new Set(matches.map(m => m.toLowerCase()))];
      }
    });

    return entities;
  }
}

module.exports = KeywordExtractor;