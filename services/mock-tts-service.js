require('colors');
const EventEmitter = require('events');

/**
 * Mock Text-to-Speech Service for text-based chat testing
 * Simulates the behavior of the real TextToSpeechService without Deepgram
 */
class MockTextToSpeechService extends EventEmitter {
  constructor() {
    super();
    this.nextExpectedIndex = 0;
    this.speechBuffer = {};
    console.log('Mock TTS -> Connected to mock text-to-speech service'.blue);
  }

  /**
   * Mock generate method that captures AI responses without generating audio
   * @param {Object} gptReply - Reply object from GPT service
   * @param {number} interactionCount - Current interaction number
   */
  async generate(gptReply, interactionCount) {
    const { partialResponseIndex, partialResponse } = gptReply;

    if (!partialResponse) { 
      return; 
    }

    try {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // Log the AI response with color coding
      if (this.debugMode) {
        console.log(`Mock TTS -> AI: ${partialResponse}`.green);
      }

      // Simulate the audio generation process
      const mockAudioData = {
        partialResponseIndex,
        partialResponse,
        mockAudio: `[AUDIO: ${partialResponse.length} chars]`,
        timestamp: Date.now()
      };

      // Store in buffer like the real service
      if (partialResponseIndex !== null) {
        this.speechBuffer[partialResponseIndex] = mockAudioData;
      }

      // Emit speech event to simulate audio being ready
      this.emit('speech', mockAudioData, interactionCount);

      // If this is the expected next index, process it immediately
      if (partialResponseIndex === this.nextExpectedIndex) {
        this.processNextSpeech(interactionCount);
      }

    } catch (error) {
      console.log(`Mock TTS -> Error generating speech: ${error.message}`.red);
      this.emit('error', error);
    }
  }

  /**
   * Process the next expected speech segment
   */
  processNextSpeech(interactionCount) {
    while (this.speechBuffer[this.nextExpectedIndex]) {
      const audioData = this.speechBuffer[this.nextExpectedIndex];
      
      // Emit speech ready event
      this.emit('speechReady', audioData, interactionCount);
      
      // Clean up processed audio
      delete this.speechBuffer[this.nextExpectedIndex];
      this.nextExpectedIndex++;
    }
  }

  /**
   * Reset the service for a new conversation
   */
  reset() {
    this.nextExpectedIndex = 0;
    this.speechBuffer = {};
    console.log('Mock TTS -> Service reset for new conversation'.blue);
  }

  /**
   * Close the mock service
   */
  close() {
    this.reset();
    if (this.debugMode) {
      console.log('Mock TTS -> Service closed'.blue);
    }
    this.emit('close');
  }
}

module.exports = { TextToSpeechService: MockTextToSpeechService };