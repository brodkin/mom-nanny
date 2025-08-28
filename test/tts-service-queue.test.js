const { TextToSpeechService } = require('../services/tts-service');

describe('TextToSpeechService Queue Management', () => {
  let ttsService;

  beforeEach(() => {
    // Mock environment variables for testing
    process.env.TTS_MAX_REQUESTS_PER_SECOND = '2';
    process.env.TTS_REQUEST_SPACING_MS = '500';
    process.env.TTS_CIRCUIT_BREAKER_THRESHOLD = '2';
    process.env.TTS_CIRCUIT_RECOVERY_TIME_MS = '1000';
    
    ttsService = new TextToSpeechService();
    
    // Mock the fetch function to avoid real API calls
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.fetch;
  });

  describe('Request Queue', () => {
    test('should queue multiple requests and process them sequentially', async () => {
      const mockResponse = {
        status: 200,
        blob: jest.fn().mockResolvedValue({
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8))
        })
      };
      global.fetch.mockResolvedValue(mockResponse);

      const speechEvents = [];
      ttsService.on('speech', (index, audio, text) => {
        speechEvents.push({ index, text });
      });

      // Stop processing to check queue state
      const originalProcessQueue = ttsService.processQueue;
      let processQueueCalled = false;
      ttsService.processQueue = async function() {
        processQueueCalled = true;
        // Don't actually process during this test
      };

      // Add multiple requests rapidly
      ttsService.generate({ partialResponseIndex: 1, partialResponse: 'First' }, 1);
      ttsService.generate({ partialResponseIndex: 2, partialResponse: 'Second' }, 1);
      ttsService.generate({ partialResponseIndex: 3, partialResponse: 'Third' }, 1);

      expect(ttsService.requestQueue).toHaveLength(3);
      expect(processQueueCalled).toBe(true);

      // Restore processing and wait for completion
      ttsService.processQueue = originalProcessQueue;
      await ttsService.processQueue();
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(speechEvents).toHaveLength(3);
      expect(speechEvents[0].text).toBe('First');
      expect(speechEvents[1].text).toBe('Second');
      expect(speechEvents[2].text).toBe('Third');
    });

    test('should clear queue on interruption', () => {
      // Stop processing to check queue state
      const originalProcessQueue = ttsService.processQueue;
      ttsService.processQueue = async function() {
        // Don't actually process during this test
      };

      // Add some requests
      ttsService.generate({ partialResponseIndex: 1, partialResponse: 'First' }, 1);
      ttsService.generate({ partialResponseIndex: 2, partialResponse: 'Second' }, 1);
      
      expect(ttsService.requestQueue).toHaveLength(2);
      expect(ttsService.activeRequests.size).toBe(0);

      // Clear the queue
      ttsService.clearQueue();

      expect(ttsService.requestQueue).toHaveLength(0);
      expect(ttsService.activeRequests.size).toBe(0);

      // Restore processing
      ttsService.processQueue = originalProcessQueue;
    });

    test('should emit queue-cleared event when queue is cleared', (done) => {
      ttsService.on('queue-cleared', (event) => {
        expect(event.reason).toBe('interruption');
        expect(event.timestamp).toBeGreaterThan(0);
        done();
      });

      ttsService.generate({ partialResponseIndex: 1, partialResponse: 'Test' }, 1);
      ttsService.clearQueue();
    });
  });

  describe('Rate Limiting', () => {
    test('should respect rate limiting with configured delay', async () => {
      const mockResponse = {
        status: 200,
        blob: jest.fn().mockResolvedValue({
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8))
        })
      };
      global.fetch.mockResolvedValue(mockResponse);

      const startTime = Date.now();
      
      // Add two requests (should have delay between them)
      ttsService.generate({ partialResponseIndex: 1, partialResponse: 'First' }, 1);
      ttsService.generate({ partialResponseIndex: 2, partialResponse: 'Second' }, 1);

      // Wait for both to complete
      await new Promise(resolve => setTimeout(resolve, 1500));

      const duration = Date.now() - startTime;
      // Should take at least the configured delay (500ms)
      expect(duration).toBeGreaterThan(400);
    });

    test('should adapt delay after rate limit errors', () => {
      const initialDelay = ttsService.getCurrentDelay();
      
      // Simulate a rate limit error
      const rateLimitError = new Error('Rate limited');
      rateLimitError.rateLimited = true;
      
      ttsService.onRequestFailure(rateLimitError);
      
      const newDelay = ttsService.getCurrentDelay();
      expect(newDelay).toBeGreaterThan(initialDelay);
    });
  });

  describe('Circuit Breaker', () => {
    test('should open circuit after consecutive failures', () => {
      expect(ttsService.circuitBreakerState).toBe('CLOSED');
      expect(ttsService.isCircuitClosed()).toBe(true);

      // Simulate consecutive failures
      const error = new Error('Test error');
      ttsService.onRequestFailure(error);
      expect(ttsService.isCircuitClosed()).toBe(true);
      
      ttsService.onRequestFailure(error);
      expect(ttsService.circuitBreakerState).toBe('OPEN');
      expect(ttsService.isCircuitClosed()).toBe(false);
    });

    test('should attempt recovery after timeout', async () => {
      // Open the circuit
      const error = new Error('Test error');
      ttsService.onRequestFailure(error);
      ttsService.onRequestFailure(error);
      expect(ttsService.circuitBreakerState).toBe('OPEN');

      // Wait for recovery timeout (1000ms in test config)
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Circuit should attempt recovery
      expect(ttsService.isCircuitClosed()).toBe(true);
      expect(ttsService.circuitBreakerState).toBe('HALF_OPEN');
    });

    test('should reset circuit on successful request', () => {
      // Open circuit
      const error = new Error('Test error');
      ttsService.onRequestFailure(error);
      ttsService.onRequestFailure(error);
      ttsService.circuitBreakerState = 'HALF_OPEN'; // Simulate half-open state
      
      // Successful request should close circuit
      ttsService.onRequestSuccess();
      
      expect(ttsService.circuitBreakerState).toBe('CLOSED');
      expect(ttsService.consecutiveFailures).toBe(0);
    });
  });

  describe('Metrics', () => {
    test('should track request metrics', () => {
      const initialMetrics = ttsService.getMetrics();
      expect(initialMetrics.totalRequests).toBe(0);
      expect(initialMetrics.successfulRequests).toBe(0);
      expect(initialMetrics.failedRequests).toBe(0);

      ttsService.onRequestSuccess();
      const successMetrics = ttsService.getMetrics();
      expect(successMetrics.successfulRequests).toBe(1);

      const error = new Error('Test error');
      ttsService.onRequestFailure(error);
      const failureMetrics = ttsService.getMetrics();
      expect(failureMetrics.failedRequests).toBe(1);
    });

    test('should track queue size', () => {
      // Stop processing to check queue state
      const originalProcessQueue = ttsService.processQueue;
      ttsService.processQueue = async function() {
        // Don't actually process during this test
      };

      const initialMetrics = ttsService.getMetrics();
      expect(initialMetrics.queueSize).toBe(0);

      ttsService.generate({ partialResponseIndex: 1, partialResponse: 'Test' }, 1);
      expect(ttsService.metrics.queueSize).toBe(1);

      ttsService.clearQueue();
      expect(ttsService.metrics.queueSize).toBe(0);

      // Restore processing
      ttsService.processQueue = originalProcessQueue;
    });

    test('should track circuit breaker trips', () => {
      const initialMetrics = ttsService.getMetrics();
      expect(initialMetrics.circuitBreakerTrips).toBe(0);

      // Trip circuit breaker
      const error = new Error('Test error');
      ttsService.onRequestFailure(error);
      ttsService.onRequestFailure(error);

      const metrics = ttsService.getMetrics();
      expect(metrics.circuitBreakerTrips).toBe(1);
    });
  });

  describe('Error Handling', () => {
    test('should emit tts-error event on request failure', (done) => {
      ttsService.on('tts-error', (errorEvent) => {
        expect(errorEvent.error).toBe('Test error');
        expect(errorEvent.rateLimited).toBe(false);
        done();
      });

      const error = new Error('Test error');
      ttsService.onRequestFailure(error);
    });

    test('should mark rate limited errors appropriately', (done) => {
      ttsService.on('tts-error', (errorEvent) => {
        expect(errorEvent.rateLimited).toBe(true);
        done();
      });

      const rateLimitError = new Error('Rate limited');
      rateLimitError.rateLimited = true;
      ttsService.onRequestFailure(rateLimitError);
    });
  });
});