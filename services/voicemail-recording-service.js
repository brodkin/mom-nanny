/**
 * VoicemailRecordingService - Handles voicemail recording flow with user-provided greeting
 * 
 * Implements the complete voicemail experience:
 * 1. Ring simulation (30 seconds)
 * 2. User's greeting playback
 * 3. Beep sound 
 * 4. Recording (up to 20 seconds)
 * 5. "Message sent!" confirmation via Deepgram TTS
 * 6. Seamless transition to interactive conversation
 */

const axios = require('axios');

class VoicemailRecordingService {
  constructor() {
    this.server = process.env.SERVER;
    this.deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    this.recordingStorage = new Map(); // Store recording URLs temporarily
  }

  /**
   * Step 1: Initial ring response - simulates traditional voicemail ringing
   * Returns TwiML to pause for 30 seconds then redirect to greeting
   */
  createInitialRingResponse() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- Simulate 1-second ring for testing (normally 30s) -->
  <Pause length="1"/>
  <Redirect>/voicemail/start-recording</Redirect>
</Response>`;
  }

  /**
   * Step 2: Play greeting and start recording
   * Returns TwiML to play user's greeting, beep, then record
   */
  createRecordingResponse() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- Play user's pre-recorded voicemail greeting -->
  <Play>https://${this.server}/assets/audio/voicemail-greeting.mp3</Play>
  
  <!-- Standard voicemail beep -->
  <Play>https://${this.server}/assets/audio/beep.mp3</Play>
  
  <!-- Record caller's message -->
  <Record 
    maxLength="20" 
    timeout="2"
    playBeep="false"
    transcribe="true" 
    transcribeCallback="/voicemail/transcription-webhook"
    action="/voicemail/recording-complete"
    method="POST"/>
</Response>`;
  }

  /**
   * Step 3: After recording complete - connect to conversation
   * Plays beep, then connects to WebSocket with voicemail context
   */
  createConnectionResponse(callSid) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- Second beep to indicate recording complete -->
  <Play>https://${this.server}/assets/audio/beep.mp3</Play>
  
  <!-- Connect immediately to WebSocket conversation -->
  <Connect>
    <Stream url="wss://${this.server}/connection">
      <Parameter name="persona" value="jessica"/>
      <Parameter name="voicemail_mode" value="true"/>
      <Parameter name="call_sid" value="${callSid}"/>
      <Parameter name="play_confirmation" value="true"/>
    </Stream>
  </Connect>
</Response>`;
  }

  /**
   * Store recording URL and metadata
   */
  handleRecordingComplete(callSid, recordingUrl, recordingDuration) {
    console.log(`📼 Voicemail recording complete for ${callSid}: ${recordingUrl} (${recordingDuration}s)`.cyan);
    
    this.recordingStorage.set(callSid, {
      recordingUrl,
      recordingDuration,
      timestamp: Date.now()
    });

    // Auto-cleanup after 10 minutes (same as transcription cache)
    setTimeout(() => {
      this.recordingStorage.delete(callSid);
    }, 600000);
  }

  /**
   * Generate "Message sent!" audio using Deepgram TTS
   * Uses same voice model as the persona for consistency
   */
  async generateMessageSentAudio() {
    try {
      const voiceModel = process.env.VOICE_MODEL || 'aura-asteria-en';
      
      const response = await axios.post(
        'https://api.deepgram.com/v1/speak',
        {
          text: 'Message sent!'
        },
        {
          headers: {
            'Authorization': `Token ${this.deepgramApiKey}`,
            'Content-Type': 'application/json'
          },
          params: {
            model: voiceModel,
            encoding: 'linear16',
            sample_rate: 24000
          },
          responseType: 'arraybuffer'
        }
      );

      console.log('🔊 Generated "Message sent!" audio via Deepgram TTS'.green);
      return Buffer.from(response.data);
    } catch (error) {
      console.error('❌ Failed to generate "Message sent!" audio:', error.message);
      // Return null - will trigger fallback in calling code
      return null;
    }
  }

  /**
   * Get stored recording data for a call
   */
  getRecordingData(callSid) {
    return this.recordingStorage.get(callSid);
  }

  /**
   * Fallback response if greeting file is missing
   * Uses TTS to generate a default greeting
   */
  createFallbackGreetingResponse() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- Fallback TTS greeting if audio file unavailable -->
  <Say voice="alice">
    Hi, this is your AI companion. I can't answer right now, but please leave a message after the beep and I'll help you with whatever you need.
  </Say>
  
  <Play>https://${this.server}/assets/audio/beep.mp3</Play>
  
  <Record 
    maxLength="20" 
    timeout="2"
    playBeep="false"
    transcribe="true" 
    transcribeCallback="/voicemail/transcription-webhook"
    action="/voicemail/recording-complete"
    method="POST"/>
</Response>`;
  }

  /**
   * Error handling - redirect to legacy flow if voicemail fails
   */
  createErrorFallbackResponse() {
    console.log('⚠️  Voicemail recording failed - falling back to legacy flow'.yellow);
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect>/incoming/voicemail-legacy</Redirect>
</Response>`;
  }
}

module.exports = VoicemailRecordingService;