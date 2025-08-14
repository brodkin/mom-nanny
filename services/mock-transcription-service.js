require('colors');
const EventEmitter = require('events');

/**
 * Mock Transcription Service for text-based chat testing
 * Simulates the behavior of the real TranscriptionService without Deepgram
 */
class MockTranscriptionService extends EventEmitter {
  constructor(debugMode = false) {
    super();
    this.finalResult = '';
    this.speechFinal = false;
    this.isConnected = true;
    this.isCallActive = true;
    this.debugMode = debugMode;
    
    if (this.debugMode) {
      console.log('Mock STT -> Connected to mock transcription service'.cyan);
    }
  }

  /**
   * Simulate receiving user text input
   * @param {string} text - The user's text input
   */
  processTextInput(text) {
    if (!text || typeof text !== 'string') {
      return;
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
      return;
    }

    // Simulate the interim and final results like Deepgram
    // First emit an interim result (is_final: false)
    this.emit('transcript', {
      channel: {
        alternatives: [{
          transcript: trimmedText,
          confidence: 1.0
        }]
      },
      is_final: false,
      speech_final: false
    });

    // Then emit the final result (is_final: true, speech_final: true)
    setTimeout(() => {
      this.finalResult = trimmedText;
      this.speechFinal = true;

      this.emit('transcript', {
        channel: {
          alternatives: [{
            transcript: trimmedText,
            confidence: 1.0
          }]
        },
        is_final: true,
        speech_final: true
      });

      if (this.debugMode) {
        console.log(`Mock STT -> User: ${trimmedText}`.yellow);
      }
    }, 50); // Small delay to simulate processing
  }

  /**
   * Close the mock service
   */
  close() {
    this.isConnected = false;
    this.isCallActive = false;
    if (this.debugMode) {
      console.log('Mock STT -> Service closed'.cyan);
    }
    this.emit('close');
  }

  /**
   * Mock methods to maintain compatibility with real service
   */
  send() {
    // No-op for mock service
  }

  getReadyState() {
    return this.isConnected ? 1 : 3; // OPEN = 1, CLOSED = 3
  }

  finish() {
    console.log('Mock STT -> Finishing transcription'.cyan);
    this.emit('finalized');
  }
}

module.exports = { TranscriptionService: MockTranscriptionService };