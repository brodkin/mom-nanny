/**
 * SentimentAnalyzer - Emotion detection and mood scoring for dementia care
 * Focuses on clinical relevance with weighted scoring for anxiety, agitation, and confusion
 */
class SentimentAnalyzer {
  constructor() {
    // Emotion lexicons tailored for dementia care context
    this.anxietyWords = [
      'worried', 'scared', 'afraid', 'nervous', 'anxious', 'panic', 'frightened',
      'terrified', 'concerned', 'upset', 'stressed', 'overwhelmed', 'helpless',
      'hospital', 'emergency', 'wrong', 'hurt', 'help me',
      // CRITICAL SAFETY: Mental health crisis phrases
      'want to die', 'wanting to die', 'better off dead', 'end my life',
      'kill myself', 'suicidal', 'no point in living', 'can\'t go on',
      'life is meaningless', 'hopeless', 'nothing to live for', 'give up'
    ];
    
    this.agitationWords = [
      'angry', 'mad', 'upset', 'frustrated', 'annoyed', 'irritated', 'furious',
      'mean', 'rude', 'stealing', 'liar', 'hate', 'stop it', 'leave me alone'
    ];
    
    this.confusionWords = [
      'confused', 'lost', 'forget', 'don\'t know', 'can\'t remember', 'where am i',
      'what time', 'who are you', 'mixed up', 'unclear', 'foggy', 'blank'
    ];
    
    this.positiveWords = [
      'happy', 'good', 'nice', 'wonderful', 'love', 'laugh', 'smile', 'joy',
      'pleasant', 'beautiful', 'peaceful', 'comfortable', 'better', 'fine'
    ];
    
    // Clinical relevance weights
    this.weights = {
      anxiety: 1.5,      // Higher weight for clinical significance
      agitation: 1.3,    // Behavioral management importance
      confusion: 1.2,    // Cognitive assessment relevance
      positive: 1.0      // Baseline for mood improvement
    };
  }

  /**
   * Analyze sentiment with clinical focus
   * @param {string} text - Input text to analyze
   * @returns {Object} Sentiment scores for each emotion category
   */
  analyzeSentiment(text) {
    if (!text || typeof text !== 'string') {
      return {
        anxiety: 0,
        agitation: 0,
        confusion: 0,
        positivity: 0,
        overall: 0
      };
    }

    const normalizedText = text.toLowerCase();
    
    const anxiety = this.calculateAnxietyScore(normalizedText);
    const agitation = this.calculateAgitationScore(normalizedText);
    const confusion = this.calculateConfusionScore(normalizedText);
    const positivity = this.calculatePositivityScore(normalizedText);
    
    const overall = this.calculateOverallMood(anxiety, agitation, confusion, positivity);

    return {
      anxiety,
      agitation,
      confusion,
      positivity,
      overall
    };
  }

  /**
   * Calculate anxiety score based on keywords and context
   * @param {string} text - Normalized text
   * @returns {number} Anxiety score (0-1)
   */
  calculateAnxietyScore(text) {
    let score = 0;

    for (const word of this.anxietyWords) {
      if (text.includes(word)) {
        // Weight by word severity - CRITICAL mental health phrases get highest weight
        if (['want to die', 'wanting to die', 'better off dead', 'end my life', 
             'kill myself', 'suicidal', 'no point in living', 'can\'t go on', 'give up'].includes(word)) {
          score += 4; // CRITICAL: Suicidal ideation gets highest weight
        } else if (['terrified', 'panic', 'hospital', 'emergency', 'hopeless', 
                   'life is meaningless', 'nothing to live for'].includes(word)) {
          score += 2; // HIGH: Severe distress
        } else {
          score += 1; // MEDIUM: General anxiety
        }
      }
    }

    // Normalize and apply weight - adjusted for higher critical scores
    // Critical phrases should immediately trigger high anxiety (0.8+)
    const normalized = Math.min(score / 8, 1); // More aggressive normalization for critical detection
    return Math.min(normalized * this.weights.anxiety, 1);
  }

  /**
   * Calculate agitation score
   * @param {string} text - Normalized text
   * @returns {number} Agitation score (0-1)
   */
  calculateAgitationScore(text) {
    let score = 0;

    for (const word of this.agitationWords) {
      if (text.includes(word)) {
        if (['furious', 'hate', 'liar'].includes(word)) {
          score += 2;
        } else {
          score += 1;
        }
      }
    }

    const normalized = Math.min(score / 8, 1);
    return normalized * this.weights.agitation;
  }

  /**
   * Calculate confusion score
   * @param {string} text - Normalized text  
   * @returns {number} Confusion score (0-1)
   */
  calculateConfusionScore(text) {
    let score = 0;

    for (const word of this.confusionWords) {
      if (text.includes(word)) {
        if (['where am i', 'who are you', 'what time'].includes(word)) {
          score += 2;
        } else {
          score += 1;
        }
      }
    }

    const normalized = Math.min(score / 8, 1);
    return normalized * this.weights.confusion;
  }

  /**
   * Calculate positivity score
   * @param {string} text - Normalized text
   * @returns {number} Positivity score (0-1)
   */
  calculatePositivityScore(text) {
    let score = 0;

    for (const word of this.positiveWords) {
      if (text.includes(word)) {
        score += 1;
      }
    }

    const normalized = Math.min(score / 6, 1);
    return normalized * this.weights.positive;
  }

  /**
   * Calculate overall mood score
   * @param {number} anxiety - Anxiety score
   * @param {number} agitation - Agitation score  
   * @param {number} confusion - Confusion score
   * @param {number} positivity - Positivity score
   * @returns {number} Overall mood (-1 to 1, negative = distressed)
   */
  calculateOverallMood(anxiety, agitation, confusion, positivity) {
    const negative = anxiety + agitation + confusion;
    const positive = positivity;
    
    // Scale to -1 to 1 range
    return (positive - negative) / Math.max(positive + negative, 1);
  }

  /**
   * Detect significant emotional shifts between mood states
   * @param {Object} previousMood - Previous mood analysis
   * @param {Object} currentMood - Current mood analysis
   * @returns {Object} Shift analysis with magnitude and direction
   */
  detectEmotionalShift(previousMood, currentMood) {
    if (!previousMood || !currentMood) {
      return { magnitude: 0, direction: 'stable' };
    }

    const overallShift = currentMood.overall - previousMood.overall;
    const anxietyShift = currentMood.anxiety - previousMood.anxiety;
    const agitationShift = currentMood.agitation - previousMood.agitation;
    const confusionShift = currentMood.confusion - previousMood.confusion;

    const magnitude = Math.abs(overallShift);
    let direction = 'stable';

    if (magnitude > 0.3) {
      direction = overallShift > 0 ? 'improving' : 'declining';
    }

    return {
      magnitude,
      direction,
      overallShift,
      categoryShifts: {
        anxiety: anxietyShift,
        agitation: agitationShift,
        confusion: confusionShift
      },
      significant: magnitude > 0.3
    };
  }

  /**
   * Calculate mood trend over time
   * @param {Array<number>} moodArray - Array of overall mood scores
   * @returns {Object} Trend analysis with direction and strength
   */
  calculateTrend(moodArray) {
    if (!moodArray || moodArray.length < 3) {
      return { direction: 'insufficient_data', strength: 0 };
    }

    // Simple linear regression to detect trend
    const n = moodArray.length;
    const sumX = n * (n - 1) / 2;
    const sumY = moodArray.reduce((sum, val) => sum + val, 0);
    const sumXY = moodArray.reduce((sum, val, i) => sum + (i * val), 0);
    const sumXX = n * (n - 1) * (2 * n - 1) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const strength = Math.abs(slope);

    let direction = 'stable';
    if (strength > 0.05) {
      direction = slope > 0 ? 'improving' : 'declining';
    }

    return {
      direction,
      strength,
      slope,
      confidence: Math.min(strength * 10, 1) // 0-1 confidence in trend
    };
  }
}

module.exports = SentimentAnalyzer;