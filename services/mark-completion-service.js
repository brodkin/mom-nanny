const EventEmitter = require('events');

class MarkCompletionService extends EventEmitter {
  constructor() {
    super();
    this.activeMarks = new Set();
    this.pendingCallbacks = [];
  }

  addMark(markId) {
    this.activeMarks.add(markId);
  }

  removeMark(markId) {
    this.activeMarks.delete(markId);
    
    // Check if all marks are complete
    if (this.activeMarks.size === 0) {
      this.emit('all-marks-complete');
      // Resolve all pending callbacks
      this.pendingCallbacks.forEach(callback => callback());
      this.pendingCallbacks = [];
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
    this.activeMarks.clear();
    this.pendingCallbacks.forEach(callback => callback());
    this.pendingCallbacks = [];
  }
}

module.exports = { MarkCompletionService };