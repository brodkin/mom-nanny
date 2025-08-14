/**
 * PatternMatcher - Clinical pattern detection for dementia care
 * Identifies behavioral patterns, clinical concerns, and risk indicators
 */
class PatternMatcher {
  constructor() {
    // Clinical pattern regexes for dementia care
    this.patterns = {
      medicationConcern: /(?:medicine|medication|pills?|dose|prescription|tablets?|drugs?|meds)/i,
      painComplaint: /(?:hurt|pain|ache|sore|burning|stabbing|throbbing|sharp|dull)/i,
      hospitalRequest: /(?:hospital|emergency|ambulance|doctor|ER|urgent care|911)/i,
      staffComplaint: /(?:mean|rude|ignore|won't help|bad|stealing|unfair|cruel)/i,
      delusional: /(?:someone in my room|they're watching|stealing|conspiracy|spying|following)/i,
      sundowning: /(?:go home|where am I|need to leave|get me out|want to go|take me home)/i,
      repetition: /(?:already told|asked before|said that|told you|mentioned)/i,
      toileting: /(?:bathroom|toilet|restroom|need to go|pee|poop|wet|soiled)/i,
      family: /(?:ryan|son|daughter|family|children|grandchildren|husband|wife)/i,
      memories: /(?:remember|used to|long ago|back then|when I was|hawaii|dog)/i
    };

    // Levenshtein distance threshold for repetition detection
    this.repetitionThreshold = 0.8;
  }

  /**
   * Detect clinical patterns in text
   * @param {string} text - Text to analyze
   * @returns {Array<Object>} Array of detected patterns with metadata
   */
  detectPatterns(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const detected = [];
    const normalizedText = text.toLowerCase();

    for (const [patternType, regex] of Object.entries(this.patterns)) {
      const matches = normalizedText.match(regex);
      if (matches) {
        detected.push({
          type: patternType,
          match: matches[0],
          fullText: text,
          timestamp: Date.now(),
          severity: this.assessPatternSeverity(patternType, matches[0]),
          context: this.extractContext(text, matches.index, matches[0].length)
        });
      }
    }

    return detected;
  }

  /**
   * Assess severity of detected pattern
   * @param {string} patternType - Type of pattern detected
   * @param {string} match - Matched text
   * @returns {string} Severity level (low, medium, high, critical)
   */
  assessPatternSeverity(patternType, match) {
    const severityMap = {
      hospitalRequest: 'critical',
      painComplaint: 'high',
      delusional: 'high',
      medicationConcern: 'medium',
      staffComplaint: 'medium',
      sundowning: 'medium',
      repetition: 'low',
      toileting: 'medium',
      family: 'low',
      memories: 'low'
    };

    // Additional severity modifiers based on specific words
    const criticalWords = ['emergency', '911', 'ambulance', 'urgent'];
    const highWords = ['severe', 'terrible', 'excruciating', 'can\'t stand'];
    
    if (criticalWords.some(word => match.includes(word))) {
      return 'critical';
    }
    
    if (highWords.some(word => match.includes(word))) {
      return 'high';
    }

    return severityMap[patternType] || 'low';
  }

  /**
   * Extract context around matched pattern
   * @param {string} text - Full text
   * @param {number} matchIndex - Index of match
   * @param {number} matchLength - Length of match
   * @returns {string} Context surrounding the match
   */
  extractContext(text, matchIndex, matchLength) {
    const contextRadius = 50;
    const start = Math.max(0, matchIndex - contextRadius);
    const end = Math.min(text.length, matchIndex + matchLength + contextRadius);
    return text.substring(start, end).trim();
  }

  /**
   * Calculate repetition score for utterances using Levenshtein distance
   * @param {Array<string>} utterances - Array of utterances to analyze
   * @returns {number} Repetition score (0-1)
   */
  calculateRepetitionScore(utterances) {
    if (!utterances || utterances.length < 2) {
      return 0;
    }

    let totalSimilarityScore = 0;
    let comparisons = 0;

    // Compare each utterance with others
    for (let i = 0; i < utterances.length; i++) {
      for (let j = i + 1; j < utterances.length; j++) {
        const similarity = this.levenshteinSimilarity(utterances[i], utterances[j]);
        totalSimilarityScore += similarity;
        comparisons++;
      }
    }

    const averageSimilarity = comparisons > 0 ? totalSimilarityScore / comparisons : 0;
    
    // Weight by frequency of high-similarity pairs
    const highSimilarityPairs = [];
    for (let i = 0; i < utterances.length; i++) {
      for (let j = i + 1; j < utterances.length; j++) {
        if (this.levenshteinSimilarity(utterances[i], utterances[j]) > this.repetitionThreshold) {
          highSimilarityPairs.push([i, j]);
        }
      }
    }

    const repetitionBoost = Math.min(highSimilarityPairs.length / comparisons, 0.5);
    return Math.min(averageSimilarity + repetitionBoost, 1);
  }

  /**
   * Calculate Levenshtein similarity between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  levenshteinSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1;
    
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    
    return maxLength > 0 ? 1 - (distance / maxLength) : 0;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));

    // Initialize first row and column
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    // Fill the matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,     // deletion
            dp[i][j - 1] + 1,     // insertion  
            dp[i - 1][j - 1] + 1  // substitution
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Detect sundowning risk based on time and behaviors
   * @param {Date} time - Current time
   * @param {Array<string>} behaviors - Observed behaviors
   * @returns {Object} Risk assessment with level and factors
   */
  detectSundowningRisk(time, behaviors) {
    const hour = time.getHours();
    let riskLevel = 'low';
    const riskFactors = [];

    // Time-based risk (late afternoon/evening)
    if (hour >= 15 && hour <= 20) { // 3 PM - 8 PM
      riskFactors.push('high_risk_time_window');
      riskLevel = 'medium';
    }

    // Behavior-based risk factors
    const sundowningBehaviors = [
      'agitation', 'confusion', 'wanting to leave', 'restlessness',
      'repetitive questions', 'anxiety', 'disorientation'
    ];

    const matchedBehaviors = behaviors.filter(b => 
      sundowningBehaviors.some(sb => b.toLowerCase().includes(sb))
    );

    if (matchedBehaviors.length > 2) {
      riskLevel = 'high';
      riskFactors.push('multiple_behavioral_indicators');
    } else if (matchedBehaviors.length > 0) {
      riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
      riskFactors.push('behavioral_indicators_present');
    }

    return {
      level: riskLevel,
      factors: riskFactors,
      timeOfDay: hour,
      behaviorCount: matchedBehaviors.length,
      recommendation: this.getSundowningRecommendation(riskLevel)
    };
  }

  /**
   * Get recommendation based on sundowning risk level
   * @param {string} riskLevel - Risk level
   * @returns {string} Recommendation text
   */
  getSundowningRecommendation(riskLevel) {
    const recommendations = {
      low: 'Continue monitoring. Maintain regular routine and adequate lighting.',
      medium: 'Increase supervision. Consider calming activities and reduce stimulation.',
      high: 'Immediate intervention needed. Implement calming strategies, check for triggers.'
    };

    return recommendations[riskLevel] || recommendations.low;
  }

  /**
   * Assess UTI (Urinary Tract Infection) risk indicators
   * @param {number} confusionLevel - Current confusion level (0-1)
   * @param {string} timePattern - Pattern of onset (sudden_onset, gradual, chronic)
   * @returns {Object} UTI risk assessment
   */
  assessUTIIndicators(confusionLevel, timePattern) {
    const indicators = [];
    let riskLevel = 'low';

    // Sudden confusion spike is a key UTI indicator in elderly
    if (confusionLevel > 0.7 && timePattern === 'sudden_onset') {
      riskLevel = 'high';
      indicators.push('sudden_severe_confusion');
    } else if (confusionLevel > 0.5 && timePattern === 'sudden_onset') {
      riskLevel = 'medium';
      indicators.push('moderate_sudden_confusion');
    } else if (confusionLevel > 0.7) {
      riskLevel = 'medium';
      indicators.push('severe_confusion_gradual');
    }

    return {
      risk: riskLevel,
      indicators,
      confusionLevel,
      timePattern,
      recommendation: this.getUTIRecommendation(riskLevel),
      medicalAttentionNeeded: riskLevel === 'high'
    };
  }

  /**
   * Get UTI risk recommendation
   * @param {string} riskLevel - Risk level
   * @returns {string} Recommendation text  
   */
  getUTIRecommendation(riskLevel) {
    const recommendations = {
      low: 'Continue normal monitoring. Ensure adequate hydration.',
      medium: 'Monitor closely for additional symptoms. Consider medical evaluation.',
      high: 'Urgent medical evaluation recommended. Document symptoms for healthcare provider.'
    };

    return recommendations[riskLevel] || recommendations.low;
  }
}

module.exports = PatternMatcher;