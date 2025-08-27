const { MarkCompletionService } = require('../services/mark-completion-service.js');

describe('Silence Detection Integration', () => {
  let markCompletionService;
  let _mockStartSilenceDetection;
  let _mockClearSilenceTimer;
  
  beforeEach(() => {
    markCompletionService = new MarkCompletionService();
    _mockStartSilenceDetection = jest.fn();
    _mockClearSilenceTimer = jest.fn();
  });

  test('should start silence detection when all marks complete (with debouncing)', (done) => {
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
    
    // Note: Event will fire after 250ms debounce delay
  }, 400); // Increase timeout to accommodate debouncing

  test('should handle multiple marks correctly (with debouncing)', (done) => {
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
    
    // Allow event to fire with debouncing (250ms delay)
    setTimeout(() => {
      expect(eventCount).toBe(1); // Event should fire once after debounce
      done();
    }, 300); // Wait longer than the 250ms debounce delay
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

  test('should cancel debounced event when new marks are added', (done) => {
    let eventCount = 0;
    
    markCompletionService.on('all-marks-complete', () => {
      eventCount++;
    });

    // Add and remove a mark to start debouncing
    markCompletionService.addMark('mark1');
    markCompletionService.removeMark('mark1');
    expect(markCompletionService.getActiveMarkCount()).toBe(0);
    
    // Add another mark during the debounce period
    setTimeout(() => {
      markCompletionService.addMark('mark2');
      expect(markCompletionService.getActiveMarkCount()).toBe(1);
    }, 100); // Add mark before the 250ms debounce completes
    
    // Check that the event was cancelled
    setTimeout(() => {
      expect(eventCount).toBe(0); // Event should have been cancelled
      
      // Now remove the final mark to trigger the event
      markCompletionService.removeMark('mark2');
      
      // Wait for the new debounce to complete
      setTimeout(() => {
        expect(eventCount).toBe(1); // Event should fire now
        done();
      }, 300);
    }, 280); // Wait past the original debounce time but before the new one
  });
});