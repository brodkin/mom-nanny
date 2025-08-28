require('dotenv').config();
const { Buffer } = require('node:buffer');
const EventEmitter = require('events');
const fetch = require('node-fetch');
const { createDeepgramRetry } = require('./retry-utils');

class TextToSpeechService extends EventEmitter {
  constructor() {
    super();
    this.nextExpectedIndex = 0;
    this.speechBuffer = {};
    this.retryDeepgram = createDeepgramRetry();
    
    // Rate limiting configuration
    this.maxRequestsPerSecond = parseInt(process.env.TTS_MAX_REQUESTS_PER_SECOND) || 5;
    this.requestSpacingMs = parseInt(process.env.TTS_REQUEST_SPACING_MS) || 200;
    
    // Circuit breaker configuration
    this.circuitBreakerThreshold = parseInt(process.env.TTS_CIRCUIT_BREAKER_THRESHOLD) || 3;
    this.circuitRecoveryTimeMs = parseInt(process.env.TTS_CIRCUIT_RECOVERY_TIME_MS) || 30000;
    
    // Circuit breaker state
    this.circuitBreakerState = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.consecutiveFailures = 0;
    this.lastFailureTime = null;
    
    // Request queue and processing
    this.requestQueue = [];
    this.isProcessing = false;
    this.lastRequestTime = 0;
    
    // Adaptive throttling
    this.currentDelayMs = this.requestSpacingMs;
    this.recentErrors = [];
    this.recentResponseTimes = [];
    
    // Active request tracking for interruption handling
    this.activeRequests = new Set();
    
    // Cancellable timeout tracking for rate limiting
    this.rateLimitTimeouts = new Set();
    this.shouldStop = false;
    
    // Metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitedRequests: 0,
      averageResponseTime: 0,
      queueSize: 0,
      circuitBreakerTrips: 0
    };
  }

  async generate(gptReply, interactionCount) {
    const { partialResponseIndex, partialResponse } = gptReply;

    if (!partialResponse) { return; }

    // Add request to queue instead of processing immediately
    const request = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      partialResponseIndex,
      partialResponse,
      interactionCount,
      timestamp: Date.now()
    };

    this.requestQueue.push(request);
    this.metrics.queueSize = this.requestQueue.length;
    
    // Reset stop flag if it was set by previous clearQueue
    this.resetStopFlag();
    
    // Start processing queue if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0 || this.shouldStop) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0 && !this.shouldStop) {
      // Check circuit breaker state
      if (!this.isCircuitClosed()) {
        console.log('🚫 TTS Circuit breaker is OPEN - skipping requests'.yellow);
        this.clearQueue();
        break;
      }

      const request = this.requestQueue.shift();
      this.metrics.queueSize = this.requestQueue.length;
      
      // Apply rate limiting with cancellable delay
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      const minDelay = this.getCurrentDelay();
      
      if (timeSinceLastRequest < minDelay) {
        const waitTime = minDelay - timeSinceLastRequest;
        console.log(`⏱️ TTS rate limiting: waiting ${waitTime}ms`.gray);
        
        // Use cancellable sleep instead of regular sleep
        const cancelled = await this.cancellableSleep(waitTime);
        if (cancelled) {
          console.log('🚫 TTS rate limiting cancelled, stopping queue processing'.yellow);
          break;
        }
      }

      // Check if we should stop before processing the request
      if (this.shouldStop) {
        console.log('🚫 TTS queue processing stopped'.yellow);
        break;
      }

      try {
        await this.processRequest(request);
        this.onRequestSuccess();
      } catch (error) {
        this.onRequestFailure(error);
        console.error(`❌ TTS request failed: ${error.message}`.red);
      }

      this.lastRequestTime = Date.now();
    }

    this.isProcessing = false;
  }

  async processRequest(request) {
    const { id, partialResponseIndex, partialResponse, interactionCount } = request;
    
    this.activeRequests.add(id);
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Wrap the API call in retry logic
      const response = await this.retryDeepgram(async () => {
        // Check if request was cancelled during retry
        if (!this.activeRequests.has(id)) {
          const error = new Error('Request cancelled during retry');
          error.cancelled = true;
          throw error;
        }

        const res = await fetch(
          `https://api.deepgram.com/v1/speak?model=${process.env.VOICE_MODEL}&encoding=mulaw&sample_rate=8000&container=none`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: partialResponse,
            }),
          }
        );

        // Track response time for adaptive throttling
        const responseTime = Date.now() - startTime;
        this.recentResponseTimes.push(responseTime);
        if (this.recentResponseTimes.length > 10) {
          this.recentResponseTimes.shift();
        }

        // Check for errors that should trigger retry
        if (res.status === 429) {
          this.metrics.rateLimitedRequests++;
          const error = new Error(`Deepgram rate limit: ${res.status}`);
          error.response = res;
          error.rateLimited = true;
          throw error;
        } else if (res.status >= 500) {
          const error = new Error(`Deepgram server error: ${res.status}`);
          error.response = res;
          throw error;
        } else if (res.status !== 200) {
          // Non-retryable error
          console.log(`Deepgram TTS error (non-retryable): ${res.status}`.red);
          const error = new Error(`Deepgram TTS error: ${res.status}`);
          error.response = res;
          error.retryable = false;
          throw error;
        }

        return res;
      });

      // Check if request was cancelled during processing
      if (!this.activeRequests.has(id)) {
        console.log(`🚫 TTS request ${id} was cancelled`.gray);
        return;
      }

      if (response && response.status === 200) {
        try {
          const blob = await response.blob();
          const audioArrayBuffer = await blob.arrayBuffer();
          const base64String = Buffer.from(audioArrayBuffer).toString('base64');
          
          // Only emit if request hasn't been cancelled
          if (this.activeRequests.has(id)) {
            this.emit('speech', partialResponseIndex, base64String, partialResponse, interactionCount);
          }
        } catch (err) {
          console.log('Error processing TTS response:'.red, err);
          throw err;
        }
      }
    } finally {
      this.activeRequests.delete(id);
    }
  }

  clearQueue() {
    console.log(`🧹 Clearing TTS queue: ${this.requestQueue.length} requests, ${this.activeRequests.size} active, ${this.rateLimitTimeouts.size} rate-limit timeouts`.cyan);
    
    // Signal all processing to stop
    this.shouldStop = true;
    
    // Clear all active rate-limiting timeouts
    for (const timeoutId of this.rateLimitTimeouts) {
      clearTimeout(timeoutId);
    }
    this.rateLimitTimeouts.clear();
    
    // Clear pending requests
    this.requestQueue = [];
    this.metrics.queueSize = 0;
    
    // Mark active requests as cancelled (they'll check this flag)
    this.activeRequests.clear();
    
    // Reset processing state
    this.isProcessing = false;
    
    // Emit event for monitoring
    this.emit('queue-cleared', {
      timestamp: Date.now(),
      reason: 'interruption'
    });
  }

  isCircuitClosed() {
    const now = Date.now();
    
    switch (this.circuitBreakerState) {
    case 'CLOSED':
      return true;
      
    case 'OPEN':
      if (now - this.lastFailureTime >= this.circuitRecoveryTimeMs) {
        console.log('🔄 TTS Circuit breaker: OPEN -> HALF_OPEN (attempting recovery)'.yellow);
        this.circuitBreakerState = 'HALF_OPEN';
        return true;
      }
      return false;
      
    case 'HALF_OPEN':
      return true;
      
    default:
      return false;
    }
  }

  onRequestSuccess() {
    this.metrics.successfulRequests++;
    this.consecutiveFailures = 0;
    
    // Reset circuit breaker if in HALF_OPEN state
    if (this.circuitBreakerState === 'HALF_OPEN') {
      console.log('✅ TTS Circuit breaker: HALF_OPEN -> CLOSED (recovery successful)'.green);
      this.circuitBreakerState = 'CLOSED';
    }
    
    // Reduce delay if we're being successful
    this.adaptDelay(true);
  }

  onRequestFailure(error) {
    this.metrics.failedRequests++;
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    
    // Track error for adaptive throttling
    this.recentErrors.push({
      timestamp: Date.now(),
      rateLimited: error.rateLimited || false
    });
    if (this.recentErrors.length > 10) {
      this.recentErrors.shift();
    }
    
    // Trip circuit breaker if threshold reached
    if (this.consecutiveFailures >= this.circuitBreakerThreshold) {
      console.log(`🚨 TTS Circuit breaker: CLOSED -> OPEN (${this.consecutiveFailures} consecutive failures)`.red);
      this.circuitBreakerState = 'OPEN';
      this.metrics.circuitBreakerTrips++;
    }
    
    // Increase delay on failures
    this.adaptDelay(false);
    
    // Emit error for handling
    this.emit('tts-error', {
      error: error.message,
      rateLimited: error.rateLimited || false,
      circuitOpen: this.circuitBreakerState === 'OPEN'
    });
  }

  getCurrentDelay() {
    return this.currentDelayMs;
  }

  adaptDelay(success) {
    if (success) {
      // Gradually reduce delay on success (but not below minimum)
      this.currentDelayMs = Math.max(
        this.requestSpacingMs,
        this.currentDelayMs * 0.9
      );
    } else {
      // Increase delay on failure, especially for rate limits
      const recentRateLimits = this.recentErrors.filter(e => 
        e.rateLimited && Date.now() - e.timestamp < 60000
      ).length;
      
      if (recentRateLimits > 0) {
        this.currentDelayMs = Math.min(
          10000, // Max 10 seconds
          this.currentDelayMs * (1 + recentRateLimits * 0.5)
        );
      } else {
        this.currentDelayMs = Math.min(
          5000, // Max 5 seconds for non-rate-limit errors
          this.currentDelayMs * 1.2
        );
      }
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      circuitBreakerState: this.circuitBreakerState,
      consecutiveFailures: this.consecutiveFailures,
      currentDelayMs: this.currentDelayMs,
      activeRequests: this.activeRequests.size,
      averageResponseTime: this.recentResponseTimes.length > 0 
        ? this.recentResponseTimes.reduce((a, b) => a + b, 0) / this.recentResponseTimes.length
        : 0
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  cancellableSleep(ms) {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        this.rateLimitTimeouts.delete(timeoutId);
        resolve(false); // false means not cancelled
      }, ms);
      
      this.rateLimitTimeouts.add(timeoutId);
    });
  }

  // Reset the stop flag when new requests come in after clearQueue
  resetStopFlag() {
    if (this.shouldStop) {
      console.log('🔄 Resetting TTS stop flag for new requests'.cyan);
      this.shouldStop = false;
    }
  }
}

module.exports = { TextToSpeechService };