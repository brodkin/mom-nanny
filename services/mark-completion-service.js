const EventEmitter = require('events');

class MarkCompletionService extends EventEmitter {
  constructor() {
    super();
    this.activeMarks = new Set();
    this.pendingCallbacks = [];
    // CRITICAL FIX: Add debounce timer to prevent premature 'all-marks-complete' events
    // This prevents the silence detection from starting between rapid audio chunks
    this.completeTimer = null;
  }

  addMark(markId) {
    this.activeMarks.add(markId);
  }

  removeMark(markId) {
    this.activeMarks.delete(markId);
    
    // CRITICAL FIX: Clear any existing completion timer to prevent multiple timers
    if (this.completeTimer) {
      clearTimeout(this.completeTimer);
      this.completeTimer = null;
    }
    
    // Check if all marks are complete with debounce to prevent race conditions
    if (this.activeMarks.size === 0) {
      // DEBOUNCE: Wait 250ms to ensure no new marks are added between audio chunks
      // This prevents premature silence detection when GPT responses have multiple parts
      this.completeTimer = setTimeout(() => {
        // Double-check that marks are still empty after the delay
        // (in case new marks were added while we were waiting)
        if (this.activeMarks.size === 0) {
          console.log('Debounced mark completion - all audio truly finished'.cyan);
          this.emit('all-marks-complete');
          // Resolve all pending callbacks
          this.pendingCallbacks.forEach(callback => callback());
          this.pendingCallbacks = [];
        } else {
          console.log('Mark completion cancelled - new marks added during debounce'.gray);
        }
        this.completeTimer = null;
      }, 250); // 250ms debounce - long enough to catch rapid chunks, short enough to feel responsive
    }
  }

  async waitForAllMarks() {
    // If no active marks, resolve immediately
    if (this.activeMarks.size === 0) {
      return Promise.resolve();
    }

    // Wait for all marks to complete
    return new Promise((resolve) => {
      this.pendingCallbacks.push(resolve);
    });
  }

  getActiveMarkCount() {
    return this.activeMarks.size;
  }

  clearAll() {
    // CRITICAL FIX: Clear the completion timer when clearing all marks
    if (this.completeTimer) {
      clearTimeout(this.completeTimer);
      this.completeTimer = null;
    }
    this.activeMarks.clear();
    this.pendingCallbacks.forEach(callback => callback());
    this.pendingCallbacks = [];
  }
}

module.exports = { MarkCompletionService };