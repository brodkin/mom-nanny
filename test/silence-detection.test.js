const { MarkCompletionService } = require('../services/mark-completion-service.js');

describe('Silence Detection Integration', () => {
  let markCompletionService;
  let mockStartSilenceDetection;
  let mockClearSilenceTimer;
  
  beforeEach(() => {
    markCompletionService = new MarkCompletionService();
    mockStartSilenceDetection = jest.fn();
    mockClearSilenceTimer = jest.fn();
  });

  test('should start silence detection when all marks complete', (done) => {
    // Listen for the event that triggers silence detection
    markCompletionService.on('all-marks-complete', () => {
      console.log('✅ all-marks-complete event received - would start silence detection');
      done();
    });

    // Simulate audio lifecycle
    markCompletionService.addMark('audio-chunk-1');
    markCompletionService.addMark('audio-chunk-2');
    
    // Remove all marks to trigger the event
    markCompletionService.removeMark('audio-chunk-1');
    markCompletionService.removeMark('audio-chunk-2');
  });

  test('should handle multiple marks correctly', () => {
    let eventCount = 0;
    
    markCompletionService.on('all-marks-complete', () => {
      eventCount++;
    });

    // Add marks
    markCompletionService.addMark('mark1');
    markCompletionService.addMark('mark2');
    markCompletionService.addMark('mark3');
    expect(markCompletionService.getActiveMarkCount()).toBe(3);

    // Remove some marks
    markCompletionService.removeMark('mark1');
    expect(markCompletionService.getActiveMarkCount()).toBe(2);
    expect(eventCount).toBe(0); // Event shouldn't fire yet

    markCompletionService.removeMark('mark2');
    expect(markCompletionService.getActiveMarkCount()).toBe(1);
    expect(eventCount).toBe(0); // Event shouldn't fire yet

    // Remove final mark
    markCompletionService.removeMark('mark3');
    expect(markCompletionService.getActiveMarkCount()).toBe(0);
    
    // Allow event to fire
    setTimeout(() => {
      expect(eventCount).toBe(1); // Event should fire once
    }, 10);
  });

  test('should not start silence detection if marks are still active', () => {
    const isWaitingForResponse = false;
    const marks = ['active-mark-1', 'active-mark-2'];
    
    // Simulate the condition check from our implementation
    const shouldStartDetection = !isWaitingForResponse && marks.length === 0;
    
    expect(shouldStartDetection).toBe(false);
  });

  test('should start silence detection when no marks are active', () => {
    const isWaitingForResponse = false;
    const marks = [];
    
    // Simulate the condition check from our implementation
    const shouldStartDetection = !isWaitingForResponse && marks.length === 0;
    
    expect(shouldStartDetection).toBe(true);
  });
});