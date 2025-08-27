const VoicemailRecordingService = require('../services/voicemail-recording-service');

describe('VoicemailRecordingService', () => {
  let service;

  beforeEach(() => {
    // Set up environment variables for testing
    process.env.SERVER = 'test.example.com';
    process.env.DEEPGRAM_API_KEY = 'test-key';
    service = new VoicemailRecordingService();
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.SERVER;
    delete process.env.DEEPGRAM_API_KEY;
  });

  describe('createInitialRingResponse', () => {
    test('should generate TwiML for initial ring with 1-second pause', () => {
      const response = service.createInitialRingResponse();
      
      expect(response).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(response).toContain('<Response>');
      expect(response).toContain('<Pause length="1"/>');
      expect(response).toContain('<Redirect>/voicemail/start-recording</Redirect>');
      expect(response).toContain('</Response>');
    });
  });

  describe('createRecordingResponse', () => {
    test('should generate TwiML for recording with correct parameters', () => {
      const response = service.createRecordingResponse();
      
      expect(response).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(response).toContain('<Response>');
      expect(response).toContain('<Play>https://test.example.com/assets/audio/voicemail-greeting.mp3</Play>');
      expect(response).toContain('<Play>https://test.example.com/assets/audio/beep.mp3</Play>');
      expect(response).toContain('<Record');
      expect(response).toContain('maxLength="20"');
      expect(response).toContain('timeout="2"');
      expect(response).toContain('playBeep="false"');
      expect(response).toContain('transcribe="true"');
      expect(response).toContain('transcribeCallback="/voicemail/transcription-webhook"');
      expect(response).toContain('action="/voicemail/recording-complete"');
      expect(response).toContain('method="POST"');
      expect(response).toContain('</Response>');
    });
  });

  describe('createConnectionResponse', () => {
    test('should generate TwiML for WebSocket connection with voicemail mode', () => {
      const callSid = 'CA123456789';
      const response = service.createConnectionResponse(callSid);
      
      expect(response).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(response).toContain('<Response>');
      expect(response).toContain('<Play>https://test.example.com/assets/audio/beep.mp3</Play>');
      expect(response).toContain('<Connect>');
      expect(response).toContain('<Stream url="wss://test.example.com/connection">');
      expect(response).toContain('<Parameter name="persona" value="jessica"/>');
      expect(response).toContain('<Parameter name="voicemail_mode" value="true"/>');
      expect(response).toContain(`<Parameter name="call_sid" value="${callSid}"/>`);
      expect(response).toContain('<Parameter name="play_confirmation" value="true"/>');
      expect(response).toContain('</Stream>');
      expect(response).toContain('</Connect>');
      expect(response).toContain('</Response>');
    });
  });

  describe('createFallbackGreetingResponse', () => {
    test('should generate TwiML with TTS fallback greeting and correct record parameters', () => {
      const response = service.createFallbackGreetingResponse();
      
      expect(response).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(response).toContain('<Response>');
      expect(response).toContain('<Say voice="alice">');
      expect(response).toContain('Hi, this is your AI companion');
      expect(response).toContain('<Play>https://test.example.com/assets/audio/beep.mp3</Play>');
      expect(response).toContain('<Record');
      expect(response).toContain('maxLength="20"');
      expect(response).toContain('timeout="2"');
      expect(response).toContain('playBeep="false"');
      expect(response).toContain('transcribe="true"');
      expect(response).toContain('transcribeCallback="/voicemail/transcription-webhook"');
      expect(response).toContain('action="/voicemail/recording-complete"');
      expect(response).toContain('method="POST"');
      expect(response).toContain('</Response>');
    });
  });

  describe('createErrorFallbackResponse', () => {
    test('should generate TwiML redirect to legacy flow', () => {
      const response = service.createErrorFallbackResponse();
      
      expect(response).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(response).toContain('<Response>');
      expect(response).toContain('<Redirect>/incoming/voicemail-legacy</Redirect>');
      expect(response).toContain('</Response>');
    });
  });

  describe('handleRecordingComplete', () => {
    test('should store recording metadata and set up auto-cleanup', (done) => {
      const callSid = 'CA123456789';
      const recordingUrl = 'https://api.twilio.com/recordings/RE123';
      const recordingDuration = 15;

      service.handleRecordingComplete(callSid, recordingUrl, recordingDuration);

      // Should be stored immediately
      const stored = service.getRecordingData(callSid);
      expect(stored).toBeTruthy();
      expect(stored.recordingUrl).toBe(recordingUrl);
      expect(stored.recordingDuration).toBe(recordingDuration);
      expect(stored.timestamp).toBeGreaterThan(Date.now() - 1000); // Within last second

      done();
    });
  });

  describe('getRecordingData', () => {
    test('should return recording data for valid call SID', () => {
      const callSid = 'CA123456789';
      const recordingUrl = 'https://api.twilio.com/recordings/RE123';
      const recordingDuration = 15;

      service.handleRecordingComplete(callSid, recordingUrl, recordingDuration);
      const result = service.getRecordingData(callSid);

      expect(result).toBeTruthy();
      expect(result.recordingUrl).toBe(recordingUrl);
      expect(result.recordingDuration).toBe(recordingDuration);
    });

    test('should return undefined for invalid call SID', () => {
      const result = service.getRecordingData('INVALID');
      expect(result).toBeUndefined();
    });
  });

  describe('generateMessageSentAudio', () => {
    test('should return null when Deepgram API key is missing', async () => {
      delete process.env.DEEPGRAM_API_KEY;
      const service = new VoicemailRecordingService();
      
      const result = await service.generateMessageSentAudio();
      expect(result).toBeNull();
    });

    // Note: We don't test actual API calls to avoid external dependencies
    // In a real scenario, you'd mock axios to test the API integration
  });
});