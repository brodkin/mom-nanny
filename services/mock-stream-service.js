require('colors');
const EventEmitter = require('events');
const uuid = require('uuid');

/**
 * Mock Stream Service for text-based chat testing
 * Simulates the behavior of the real StreamService without WebSocket
 */
class MockStreamService extends EventEmitter {
  constructor() {
    super();
    this.expectedAudioIndex = 0;
    this.audioBuffer = {};
    this.streamSid = 'mock-stream-id';
    console.log('Mock Stream -> Connected to mock stream service'.magenta);
  }

  setStreamSid(streamSid) {
    this.streamSid = streamSid || 'mock-stream-id';
    console.log(`Mock Stream -> Stream SID set to: ${this.streamSid}`.magenta);
  }

  /**
   * Mock buffer method that logs marks without WebSocket
   * @param {number|null} index - Audio segment index
   * @param {string} audio - Audio data (mock)
   */
  buffer(index, audio) {
    // Escape hatch for intro message, which doesn't have an index
    if (index === null) {
      this.sendAudio(audio, 'intro');
    } else if (index === this.expectedAudioIndex) {
      this.sendAudio(audio, index);
      this.expectedAudioIndex++;

      // Process buffered audio in sequence
      while (Object.prototype.hasOwnProperty.call(this.audioBuffer, this.expectedAudioIndex)) {
        const bufferedAudio = this.audioBuffer[this.expectedAudioIndex];
        this.sendAudio(bufferedAudio, this.expectedAudioIndex);
        delete this.audioBuffer[this.expectedAudioIndex];
        this.expectedAudioIndex++;
      }
    } else {
      // Buffer out-of-order audio
      this.audioBuffer[index] = audio;
      if (this.debugMode) {
        console.log(`Mock Stream -> Buffered audio segment ${index}`.gray);
      }
    }
  }

  /**
   * Mock sendAudio method that logs instead of sending via WebSocket
   * @param {string} audio - Audio data to send
   * @param {number|string} identifier - Segment identifier
   */
  sendAudio(audio, identifier = 'unknown') {
    // Log the audio send event
    const audioLength = audio ? audio.length : 0;
    if (this.debugMode) {
      console.log(`Mock Stream -> Sending audio segment ${identifier} (${audioLength} chars)`.magenta);
    }

    // Generate a mock mark label
    const markLabel = uuid.v4();
    if (this.debugMode) {
      console.log(`Mock Stream -> Mark sent: ${markLabel}`.gray);
    }

    // Emit audiosent event like the real service
    this.emit('audiosent', markLabel);

    // Simulate mark completion after a short delay
    setTimeout(() => {
      this.emit('markCompleted', markLabel);
    }, 100);
  }

  /**
   * Mock clear method to reset audio buffer
   */
  clear() {
    this.expectedAudioIndex = 0;
    this.audioBuffer = {};
    if (this.debugMode) {
      console.log('Mock Stream -> Audio buffer cleared'.magenta);
    }
  }

  /**
   * Mock interrupt method to handle user interruptions
   */
  interrupt() {
    if (this.debugMode) {
      console.log('Mock Stream -> User interruption detected, clearing buffer'.magenta);
    }
    this.clear();
    this.emit('interrupted');
  }

  /**
   * Close the mock service
   */
  close() {
    this.clear();
    if (this.debugMode) {
      console.log('Mock Stream -> Service closed'.magenta);
    }
    this.emit('close');
  }

  /**
   * Get connection status
   */
  isConnected() {
    return true; // Mock service is always "connected"
  }
}

module.exports = { StreamService: MockStreamService };