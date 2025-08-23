/**
 * ConversationAnalyzer - Basic conversation tracking for dementia care
 * Tracks conversation events and clinical indicators
 * Note: Emotional analysis now handled by GPT-based system after conversation ends
 */

class ConversationAnalyzer {
  /**
   * Constructor
   * @param {string} callSid - Unique call identifier
   * @param {Date} startTime - Call start timestamp
   * @param {Object} dependencies - Injected dependencies (optional, for testing)
   */
  constructor(callSid, startTime, dependencies = {}) {
    this.callSid = callSid;
    this.startTime = startTime;
    this.endTime = null;
    
    // Conversation tracking
    this.interactions = [];
    this.userUtterances = [];
    this.assistantResponses = [];
    
    // Care indicators tracking
    this.medicationMentions = [];
    this.painComplaints = [];
    this.hospitalRequests = 0;
    this.staffComplaints = [];
    
    // Basic metrics
    this.responseLatencies = [];
    this.interruptionCount = 0;
  }

  /**
   * Track user utterance
   * @param {string} text - User's spoken text
   * @param {Date} timestamp - When utterance occurred
   * @param {number} latency - Response latency in ms (optional)
   */
  trackUserUtterance(text, timestamp, latency = null) {
    const utterance = {
      text,
      timestamp,
      latency
    };

    this.userUtterances.push(utterance);
    this.interactions.push({
      type: 'user_utterance',
      timestamp,
      text, // Include text for GPT analysis
      data: utterance
    });

    // Track response latency if provided
    if (latency !== null) {
      this.responseLatencies.push({ timestamp, latency });
    }
  }

  /**
   * Track assistant response
   * @param {string} text - Assistant's response text
   * @param {Date} timestamp - When response was given
   */
  trackAssistantResponse(text, timestamp) {
    // Prevent duplicate tracking of identical or very similar responses
    // This fixes the bug where function "say" messages and GPT responses
    // both get tracked with nearly identical content and timestamps
    if (this._isDuplicateResponse(text, timestamp)) {
      return; // Skip tracking this duplicate
    }
    
    const response = {
      text,
      timestamp,
      length: text.length
    };

    this.assistantResponses.push(response);
    this.interactions.push({
      type: 'assistant_response',
      timestamp,
      text, // Include text for GPT analysis
      data: response
    });
  }

  /**
   * Track interruption events
   * @param {Date} timestamp - When interruption occurred
   */
  trackInterruption(timestamp) {
    this.interruptionCount++;
    this.interactions.push({
      type: 'interruption',
      timestamp,
      data: { count: this.interruptionCount }
    });
  }

  /**
   * Track function calls (like transferCall, endCall)
   * @param {string} functionName - Name of function called
   * @param {Object} args - Function arguments
   * @param {Date} timestamp - When function was called
   */
  trackFunctionCall(functionName, args, timestamp) {
    const functionCall = {
      functionName,
      args,
      timestamp
    };

    this.interactions.push({
      type: 'function_call',
      timestamp,
      functionName,
      args,
      data: functionCall
    });

    // Track specific function types
    if (functionName === 'transferCall') {
      this.hospitalRequests++;
    }
  }

  /**
   * Generate basic conversation summary
   * @returns {Object} Basic conversation analysis
   */
  generateSummary() {
    const duration = this.endTime ? 
      (this.endTime - this.startTime) / 1000 : 
      (new Date() - this.startTime) / 1000;

    return {
      callMetadata: {
        callSid: this.callSid,
        startTime: this.startTime,
        endTime: this.endTime,
        duration: Math.max(Math.round(duration), 1) // Ensure at least 1 second
      },
      
      conversationMetrics: {
        totalUtterances: this.userUtterances.length,
        userUtterances: this.userUtterances.length,
        assistantResponses: this.assistantResponses.length,
        totalInteractions: this.interactions.length,
        interruptionCount: this.interruptionCount,
        averageResponseLatency: this._calculateAverageLatency()
      },

      // Note: Emotional analysis now handled by GPT-based system after conversation ends
      // Clinical indicators tracking
      clinicalIndicators: {
        medicationMentions: this.medicationMentions,
        painComplaints: this.painComplaints,
        hospitalRequests: this.hospitalRequests,
        staffComplaints: this.staffComplaints
      }
    };
  }

  // Private helper methods

  /**
   * Check if a response is a duplicate of a recently tracked response
   * @param {string} text - Response text to check
   * @param {Date} timestamp - Timestamp of the response
   * @returns {boolean} True if this response should be considered a duplicate
   * @private
   */
  _isDuplicateResponse(text, timestamp) {
    if (this.assistantResponses.length === 0) {
      return false; // No existing responses to compare against
    }
    
    const timeWindow = 5000; // 5 seconds window for duplicate detection
    const similarityThreshold = 0.85; // 85% similarity threshold
    
    // Check recent responses within the time window
    for (let i = this.assistantResponses.length - 1; i >= 0; i--) {
      const existingResponse = this.assistantResponses[i];
      const timeDiff = Math.abs(timestamp - existingResponse.timestamp);
      
      if (timeDiff > timeWindow) {
        break; // Responses are ordered by time, so we can stop here
      }
      
      // Check for exact match
      if (existingResponse.text === text) {
        return true;
      }
      
      // Check for high similarity (handles minor variations)
      const similarity = this._calculateTextSimilarity(existingResponse.text, text);
      if (similarity >= similarityThreshold) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Calculate text similarity between two strings using simple word overlap
   * @param {string} text1 - First text
   * @param {string} text2 - Second text  
   * @returns {number} Similarity score between 0 and 1
   * @private
   */
  _calculateTextSimilarity(text1, text2) {
    // Handle undefined or null inputs
    if (!text1 || !text2) {
      return 0;
    }
    
    // Simple word-based similarity calculation
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    
    if (words1.size === 0 && words2.size === 0) {
      return 1; // Both empty
    }
    
    if (words1.size === 0 || words2.size === 0) {
      return 0; // One empty, one not
    }
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size; // Jaccard similarity
  }

  /**
   * Calculate average response latency
   * @returns {number} Average latency in ms
   * @private
   */
  _calculateAverageLatency() {
    if (this.responseLatencies.length === 0) return 0;
    const total = this.responseLatencies.reduce((sum, r) => sum + r.latency, 0);
    return Math.round(total / this.responseLatencies.length);
  }
}

module.exports = ConversationAnalyzer;