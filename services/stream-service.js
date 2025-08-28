const EventEmitter = require('events');
const uuid = require('uuid');

class StreamService extends EventEmitter {
  constructor(websocket) {
    super();
    this.ws = websocket;
    this.expectedAudioIndex = 0;
    this.audioBuffer = {};
    this.streamSid = '';
  }

  setStreamSid (streamSid) {
    this.streamSid = streamSid;
  }

  buffer (index, audio) {
    // Escape hatch for intro message, which doesn't have an index
    if(index === null) {
      this.sendAudio(audio);
    } else if(index === this.expectedAudioIndex) {
      this.sendAudio(audio);
      this.expectedAudioIndex++;

      while(Object.prototype.hasOwnProperty.call(this.audioBuffer, this.expectedAudioIndex)) {
        const bufferedAudio = this.audioBuffer[this.expectedAudioIndex];
        this.sendAudio(bufferedAudio);
        this.expectedAudioIndex++;
      }
    } else {
      this.audioBuffer[index] = audio;
    }
  }

  sendAudio (audio) {
    // CRITICAL: Check if WebSocket is still open before sending
    if (this.ws.readyState !== this.ws.OPEN) {
      console.log('🚫 Skipping audio send - WebSocket is closed'.red);
      return;
    }
    
    try {
      this.ws.send(
        JSON.stringify({
          streamSid: this.streamSid,
          event: 'media',
          media: {
            payload: audio,
          },
        })
      );
      // When the media completes you will receive a `mark` message with the label
      const markLabel = uuid.v4();
      this.ws.send(
        JSON.stringify({
          streamSid: this.streamSid,
          event: 'mark',
          mark: {
            name: markLabel
          }
        })
      );
      this.emit('audiosent', markLabel);
    } catch (error) {
      console.log(`⚠️ Failed to send audio - WebSocket error: ${error.message}`.yellow);
    }
  }

  clear() {
    const bufferedCount = Object.keys(this.audioBuffer).length;
    if (bufferedCount > 0) {
      console.log(`🧹 Clearing StreamService buffer: ${bufferedCount} chunks`.yellow);
      this.audioBuffer = {};
      // Reset expected index to prevent gaps in audio sequencing
      this.expectedAudioIndex = 0;
    }
  }
}

module.exports = {StreamService};