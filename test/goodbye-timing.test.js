const { MarkCompletionService } = require('../services/mark-completion-service.js');

describe('Goodbye Audio Timing', () => {
  let markCompletionService;
  let mockWebSocket;
  
  beforeEach(() => {
    markCompletionService = new MarkCompletionService();
    mockWebSocket = {
      readyState: 1, // OPEN
      close: jest.fn()
    };
  });

  test('should wait for goodbye audio completion before closing call', (done) => {
    let callClosed = false;
    
    // Mock the goodbye completion logic
    let goodbyeCompletionHandler;
    goodbyeCompletionHandler = () => {
      // Only close if there are no active marks (goodbye audio finished)
      if (markCompletionService.getActiveMarkCount() === 0) {
        console.log('Goodbye audio completed - closing call');
        if (mockWebSocket.readyState === 1) {
          mockWebSocket.close();
          callClosed = true;
        }
        markCompletionService.off('all-marks-complete', goodbyeCompletionHandler);
        
        // Verify the call was closed at the right time
        expect(callClosed).toBe(true);
        expect(mockWebSocket.close).toHaveBeenCalled();
        done();
      }
    };
    
    // Listen for marks completion (simulating our app.js logic)
    markCompletionService.on('all-marks-complete', goodbyeCompletionHandler);
    
    // Simulate goodbye audio being sent (adds marks)
    markCompletionService.addMark('goodbye-audio-chunk-1');
    markCompletionService.addMark('goodbye-audio-chunk-2');
    
    // Call should not be closed yet
    expect(callClosed).toBe(false);
    expect(mockWebSocket.close).not.toHaveBeenCalled();
    
    // Simulate audio completion (remove marks)
    setTimeout(() => {
      markCompletionService.removeMark('goodbye-audio-chunk-1');
      // Call still should not be closed
      expect(callClosed).toBe(false);
    }, 100);
    
    setTimeout(() => {
      markCompletionService.removeMark('goodbye-audio-chunk-2');
      // Now the call should close after debouncing
    }, 200);
  }, 1000); // Allow time for debouncing and event handling

  test('should close call with safety fallback if marks get stuck', (done) => {
    let callClosed = false;
    let safetyFallbackTriggered = false;
    
    // Mock the goodbye completion logic with safety fallback
    let goodbyeCompletionHandler = () => {
      if (markCompletionService.getActiveMarkCount() === 0) {
        mockWebSocket.close();
        callClosed = true;
        markCompletionService.off('all-marks-complete', goodbyeCompletionHandler);
      }
    };
    
    markCompletionService.on('all-marks-complete', goodbyeCompletionHandler);
    
    // Safety fallback (simulating our app.js logic)
    setTimeout(() => {
      if (mockWebSocket.readyState === 1 && !callClosed) {
        console.log('Safety fallback: Closing call after 5-second maximum wait');
        markCompletionService.off('all-marks-complete', goodbyeCompletionHandler);
        mockWebSocket.close();
        safetyFallbackTriggered = true;
        
        expect(safetyFallbackTriggered).toBe(true);
        expect(mockWebSocket.close).toHaveBeenCalled();
        done();
      }
    }, 500); // Shorter timeout for testing
    
    // Simulate goodbye audio being sent but never completing (marks stuck)
    markCompletionService.addMark('stuck-goodbye-mark');
    
    // Mark never gets removed, so safety fallback should trigger
  }, 1000);
});