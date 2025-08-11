require('colors');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const { Buffer } = require('node:buffer');
const EventEmitter = require('events');
const { sleep } = require('./retry-utils');


class TranscriptionService extends EventEmitter {
  constructor() {
    super();
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    this.dgConnection = null;
    this.finalResult = '';
    this.speechFinal = false; // used to determine if we have seen speech_final=true indicating that deepgram detected a natural pause in the speakers speech.
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = parseInt(process.env.DEEPGRAM_MAX_RETRIES) || 3;
    this.reconnectDelayMs = parseInt(process.env.DEEPGRAM_INITIAL_RETRY_DELAY_MS) || 1000;
    this.audioBuffer = []; // Buffer audio during reconnection
    this.isConnected = false;
    this.isCallActive = true; // Track if call is still active
    this.intentionalClose = false; // Track if we're closing intentionally
    this.hasConnected = false; // Track if we've ever connected
    
    // Initialize connection on first use
    this.connect();
  }

  async connect() {
    try {
      console.log('STT -> Connecting to Deepgram...'.cyan);
      
      this.dgConnection = this.deepgram.listen.live({
        encoding: 'mulaw',
        sample_rate: '8000',
        model: 'nova-2',
        punctuate: true,
        interim_results: true,
        endpointing: 200,
        utterance_end_ms: 1000
      });

      this.setupEventHandlers();
      
    } catch (error) {
      console.error('STT -> Failed to create Deepgram connection:'.red, error);
      await this.handleReconnection();
    }
  }

  setupEventHandlers() {
    this.dgConnection.on(LiveTranscriptionEvents.Open, () => {
      console.log('STT -> Deepgram connection opened'.green);
      this.isConnected = true;
      this.hasConnected = true;
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      
      // Process any buffered audio
      if (this.audioBuffer.length > 0) {
        console.log(`STT -> Processing ${this.audioBuffer.length} buffered audio chunks`.yellow);
        while (this.audioBuffer.length > 0) {
          const payload = this.audioBuffer.shift();
          this.send(payload);
        }
      }
      this.dgConnection.on(LiveTranscriptionEvents.Transcript, (transcriptionEvent) => {
        const alternatives = transcriptionEvent.channel?.alternatives;
        let text = '';
        if (alternatives) {
          text = alternatives[0]?.transcript;
        }
        
        // if we receive an UtteranceEnd and speech_final has not already happened then we should consider this the end of of the human speech and emit the transcription
        if (transcriptionEvent.type === 'UtteranceEnd') {
          if (!this.speechFinal) {
            console.log(`UtteranceEnd received before speechFinal, emit the text collected so far: ${this.finalResult}`.yellow);
            this.emit('transcription', this.finalResult);
            return;
          } else {
            console.log('STT -> Speech was already final when UtteranceEnd recevied'.yellow);
            return;
          }
        }
    
        // console.log(text, "is_final: ", transcription?.is_final, "speech_final: ", transcription.speech_final);
        // if is_final that means that this chunk of the transcription is accurate and we need to add it to the finalResult 
        if (transcriptionEvent.is_final === true && text.trim().length > 0) {
          this.finalResult += ` ${text}`;
          // if speech_final and is_final that means this text is accurate and it's a natural pause in the speakers speech. We need to send this to the assistant for processing
          if (transcriptionEvent.speech_final === true) {
            this.speechFinal = true; // this will prevent a utterance end which shows up after speechFinal from sending another response
            this.emit('transcription', this.finalResult);
            this.finalResult = '';
          } else {
            // if we receive a message without speechFinal reset speechFinal to false, this will allow any subsequent utteranceEnd messages to properly indicate the end of a message
            this.speechFinal = false;
          }
        } else {
          this.emit('utterance', text);
        }
      });

      this.dgConnection.on(LiveTranscriptionEvents.Error, async (error) => {
        console.error('STT -> Deepgram error:'.red);
        console.error(error);
        
        // Check if this is a rate limit or connection error
        if (error.code === 'ERR_WS_RATE_LIMIT' || error.code === 429 || 
            error.message?.includes('429') || error.message?.includes('rate')) {
          console.log('STT -> Rate limit detected, initiating reconnection...'.yellow);
          await this.handleReconnection();
        }
      });

      this.dgConnection.on(LiveTranscriptionEvents.Warning, (warning) => {
        console.error('STT -> Deepgram warning:'.yellow);
        console.error(warning);
      });

      this.dgConnection.on(LiveTranscriptionEvents.Metadata, (metadata) => {
        // Reduced logging for metadata
        console.log('STT -> Deepgram metadata received'.gray);
      });

      this.dgConnection.on(LiveTranscriptionEvents.Close, async () => {
        console.log('STT -> Deepgram connection closed'.yellow);
        this.isConnected = false;
        
        // Only reconnect if call is still active and not an intentional close
        if (this.isCallActive && !this.intentionalClose && !this.isReconnecting) {
          console.log('STT -> Unexpected close, attempting reconnection...'.yellow);
          await this.handleReconnection();
        } else if (this.intentionalClose) {
          console.log('STT -> Connection closed intentionally'.gray);
        } else if (!this.isCallActive) {
          console.log('STT -> Call ended, not reconnecting'.gray);
        }
      });
    });
  }

  async handleReconnection() {
    // Don't reconnect if call is no longer active
    if (!this.isCallActive) {
      console.log('STT -> Call no longer active, skipping reconnection'.gray);
      return;
    }
    
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('STT -> Max reconnection attempts reached'.red);
        this.emit('connection-failed', { 
          attempts: this.reconnectAttempts,
          message: 'Failed to reconnect to Deepgram after max attempts'
        });
      }
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.reconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1),
      parseInt(process.env.DEEPGRAM_MAX_RETRY_DELAY_MS) || 30000
    );
    
    console.log(`STT -> Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`.yellow);
    
    await sleep(delay);
    
    // Close existing connection if any
    if (this.dgConnection) {
      try {
        this.dgConnection.finish();
      } catch (e) {
        // Ignore errors when closing
      }
    }
    
    // Attempt to reconnect
    await this.connect();
  }

  /**
   * Send the payload to Deepgram
   * @param {String} payload A base64 MULAW/8000 audio stream
   */
  send(payload) {
    // Don't process if call is not active
    if (!this.isCallActive) {
      return;
    }
    
    // Only buffer during active reconnection attempts
    if (this.isReconnecting && this.audioBuffer.length < 50) {
      // Limit buffering to prevent memory issues
      this.audioBuffer.push(payload);
      return;
    }
    
    // Check connection state and send
    if (this.dgConnection && this.dgConnection.getReadyState() === 1) {
      try {
        this.dgConnection.send(Buffer.from(payload, 'base64'));
      } catch (error) {
        console.error('STT -> Error sending audio to Deepgram:'.red, error);
        // Only trigger reconnection for actual errors, not normal operation
        if (this.isCallActive && !this.isReconnecting) {
          this.handleReconnection();
        }
      }
    }
    // Don't buffer if connection is not ready - just drop the audio
    // This prevents queue buildup
  }
  
  /**
   * Gracefully close the connection
   */
  close() {
    console.log('STT -> Closing transcription service'.cyan);
    this.isCallActive = false;
    this.intentionalClose = true;
    this.isConnected = false;
    this.isReconnecting = false;
    
    // Clear any buffered audio
    this.audioBuffer = [];
    this.finalResult = '';
    this.speechFinal = false;
    
    if (this.dgConnection) {
      try {
        this.dgConnection.finish();
      } catch (e) {
        // Ignore errors when closing
      }
      this.dgConnection = null;
    }
  }
  
  /**
   * Clear buffers when user interrupts
   */
  clearBuffers() {
    this.audioBuffer = [];
    this.finalResult = '';
    this.speechFinal = false;
  }
}

module.exports = { TranscriptionService };