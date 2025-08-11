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
  }

  async generate(gptReply, interactionCount) {
    const { partialResponseIndex, partialResponse } = gptReply;

    if (!partialResponse) { return; }

    try {
      // Wrap the API call in retry logic
      const response = await this.retryDeepgram(async () => {
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

        // Check for errors that should trigger retry
        if (res.status === 429) {
          const error = new Error(`Deepgram rate limit: ${res.status}`);
          error.response = res;
          throw error;
        } else if (res.status >= 500) {
          const error = new Error(`Deepgram server error: ${res.status}`);
          error.response = res;
          throw error;
        } else if (res.status !== 200) {
          // Non-retryable error
          console.log(`Deepgram TTS error (non-retryable): ${res.status}`.red);
          console.log(res);
          return null;
        }

        return res;
      });

      if (response && response.status === 200) {
        try {
          const blob = await response.blob();
          const audioArrayBuffer = await blob.arrayBuffer();
          const base64String = Buffer.from(audioArrayBuffer).toString('base64');
          this.emit('speech', partialResponseIndex, base64String, partialResponse, interactionCount);
        } catch (err) {
          console.log('Error processing TTS response:'.red, err);
        }
      }
    } catch (err) {
      console.error('Error occurred in TextToSpeech service after retries:'.red);
      console.error(err);
      // Emit an event to notify about the failure
      this.emit('tts-error', { 
        partialResponseIndex, 
        partialResponse, 
        error: err.message 
      });
    }
  }
}

module.exports = { TextToSpeechService };