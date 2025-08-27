/**
 * VoicemailTranscriptionCache - Simple in-memory cache for voicemail transcriptions
 * 
 * Stores transcriptions temporarily while caller transitions from voicemail recording
 * to live conversation. Transcriptions auto-expire after 10 minutes to prevent memory leaks.
 * 
 * This cache bridges the gap between Twilio's async transcription webhook and
 * the WebSocket connection that needs the voicemail context.
 */

class VoicemailTranscriptionCache {
  constructor() {
    this.transcriptions = new Map();
    this.cleanupInterval = null;
    this.startCleanupInterval();
  }

  /**
   * Store a transcription for a specific call
   * @param {string} callSid - Twilio call SID 
   * @param {string} transcription - The transcribed voicemail text
   */
  store(callSid, transcription) {
    const transcriptionData = {
      transcription: transcription.trim(),
      timestamp: Date.now(),
      callSid
    };

    this.transcriptions.set(callSid, transcriptionData);
    
    console.log(`📝 Voicemail transcription cached for ${callSid}: "${transcription.substring(0, 50)}${transcription.length > 50 ? '...' : ''}"`.cyan);

    // Auto-cleanup after 10 minutes (600,000ms)
    setTimeout(() => {
      if (this.transcriptions.has(callSid)) {
        this.transcriptions.delete(callSid);
        console.log(`🗑️ Auto-cleaned voicemail transcription for ${callSid}`.gray);
      }
    }, 600000);

    return transcriptionData;
  }

  /**
   * Retrieve a transcription for a specific call
   * @param {string} callSid - Twilio call SID
   * @returns {Object|null} Transcription data or null if not found
   */
  retrieve(callSid) {
    const transcriptionData = this.transcriptions.get(callSid);
    
    if (transcriptionData) {
      console.log(`📖 Retrieved voicemail transcription for ${callSid}`.green);
      return transcriptionData;
    } else {
      console.log(`⚠️ No voicemail transcription found for ${callSid}`.yellow);
      return null;
    }
  }

  /**
   * Check if a transcription exists for a call
   * @param {string} callSid - Twilio call SID
   * @returns {boolean} True if transcription exists
   */
  exists(callSid) {
    return this.transcriptions.has(callSid);
  }

  /**
   * Manually remove a transcription (optional - they auto-expire)
   * @param {string} callSid - Twilio call SID
   * @returns {boolean} True if transcription was removed
   */
  remove(callSid) {
    const removed = this.transcriptions.delete(callSid);
    if (removed) {
      console.log(`🗑️ Manually removed voicemail transcription for ${callSid}`.gray);
    }
    return removed;
  }

  /**
   * Get current cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const now = Date.now();
    let totalTranscriptions = this.transcriptions.size;
    let oldTranscriptions = 0;

    // Count transcriptions older than 5 minutes (but not yet expired)
    for (const [_callSid, data] of this.transcriptions.entries()) {
      if (now - data.timestamp > 300000) { // 5 minutes
        oldTranscriptions++;
      }
    }

    return {
      total: totalTranscriptions,
      old: oldTranscriptions,
      fresh: totalTranscriptions - oldTranscriptions
    };
  }

  /**
   * Clear all transcriptions (useful for testing)
   */
  clear() {
    const count = this.transcriptions.size;
    this.transcriptions.clear();
    console.log(`🧹 Cleared ${count} voicemail transcriptions from cache`.gray);
  }

  /**
   * Start periodic cleanup of expired entries (every 5 minutes)
   * This is a backup cleanup in case setTimeout cleanup fails
   */
  startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 300000); // 5 minutes
  }

  /**
   * Stop periodic cleanup (useful for testing/shutdown)
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Perform cleanup of entries older than 10 minutes
   */
  performCleanup() {
    const now = Date.now();
    const expiredEntries = [];

    // Find expired entries
    for (const [callSid, data] of this.transcriptions.entries()) {
      if (now - data.timestamp > 600000) { // 10 minutes
        expiredEntries.push(callSid);
      }
    }

    // Remove expired entries
    expiredEntries.forEach(_callSid => {
      this.transcriptions.delete(_callSid);
    });

    if (expiredEntries.length > 0) {
      console.log(`🧹 Cleanup removed ${expiredEntries.length} expired voicemail transcriptions`.gray);
    }
  }

  /**
   * Get all cached transcriptions (for debugging)
   * @returns {Array} Array of transcription data objects
   */
  getAllTranscriptions() {
    return Array.from(this.transcriptions.values());
  }

  /**
   * Shutdown cleanup (call when app terminates)
   */
  shutdown() {
    this.stopCleanupInterval();
    this.clear();
  }
}

module.exports = VoicemailTranscriptionCache;