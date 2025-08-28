const request = require('supertest');
const express = require('express');
const VoicemailRecordingService = require('../services/voicemail-recording-service');
const VoicemailTranscriptionCache = require('../services/voicemail-transcription-cache');

// Mock the services since we're testing the endpoints, not the service implementations
jest.mock('../services/voicemail-recording-service');
jest.mock('../services/voicemail-transcription-cache');

describe('Voicemail Webhook Endpoints', () => {
  let app;
  let mockVoicemailService;
  let mockTranscriptionCache;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create Express app with basic middleware
    app = express();
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());

    // Create mock instances
    mockVoicemailService = new VoicemailRecordingService();
    mockTranscriptionCache = new VoicemailTranscriptionCache();

    // Set up the voicemail endpoints (simplified version of what's in app.js)
    app.post('/incoming/voicemail', (req, res) => {
      try {
        const response = mockVoicemailService.createInitialRingResponse();
        res.type('text/xml');
        res.end(response);
      } catch (err) {
        const errorResponse = mockVoicemailService.createErrorFallbackResponse();
        res.type('text/xml');
        res.end(errorResponse);
      }
    });

    app.post('/voicemail/start-recording', (req, res) => {
      try {
        const response = mockVoicemailService.createRecordingResponse();
        res.type('text/xml');
        res.end(response);
      } catch (err) {
        const errorResponse = mockVoicemailService.createErrorFallbackResponse();
        res.type('text/xml');
        res.end(errorResponse);
      }
    });

    app.post('/voicemail/recording-complete', (req, res) => {
      try {
        const { CallSid, RecordingUrl, RecordingDuration } = req.body;
        mockVoicemailService.handleRecordingComplete(CallSid, RecordingUrl, RecordingDuration);
        const response = mockVoicemailService.createConnectionResponse(CallSid);
        res.type('text/xml');
        res.end(response);
      } catch (err) {
        const errorResponse = mockVoicemailService.createErrorFallbackResponse();
        res.type('text/xml');
        res.end(errorResponse);
      }
    });

    app.post('/voicemail/transcription-webhook', async (req, res) => {
      try {
        const { CallSid, TranscriptionText } = req.body;
        if (TranscriptionText) {
          mockTranscriptionCache.store(CallSid, TranscriptionText);
        }
        res.status(200).send('OK');
      } catch (err) {
        res.status(500).send('Error');
      }
    });
  });

  describe('POST /incoming/voicemail', () => {
    test('should return TwiML for initial ring response', async () => {
      const mockResponse = '<?xml version="1.0" encoding="UTF-8"?><Response><Pause length="15"/><Redirect>/voicemail/start-recording</Redirect></Response>';
      mockVoicemailService.createInitialRingResponse.mockReturnValue(mockResponse);

      const response = await request(app)
        .post('/incoming/voicemail')
        .expect(200)
        .expect('Content-Type', /xml/);

      expect(response.text).toBe(mockResponse);
      expect(mockVoicemailService.createInitialRingResponse).toHaveBeenCalledTimes(1);
    });

    test('should return error fallback on service error', async () => {
      const mockErrorResponse = '<?xml version="1.0" encoding="UTF-8"?><Response><Redirect>/incoming/voicemail-legacy</Redirect></Response>';
      mockVoicemailService.createInitialRingResponse.mockImplementation(() => {
        throw new Error('Service error');
      });
      mockVoicemailService.createErrorFallbackResponse.mockReturnValue(mockErrorResponse);

      const response = await request(app)
        .post('/incoming/voicemail')
        .expect(200)
        .expect('Content-Type', /xml/);

      expect(response.text).toBe(mockErrorResponse);
      expect(mockVoicemailService.createErrorFallbackResponse).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /voicemail/start-recording', () => {
    test('should return TwiML for recording response', async () => {
      const mockResponse = '<?xml version="1.0" encoding="UTF-8"?><Response><Play>greeting.mp3</Play><Play>beep.mp3</Play><Record maxLength="20" timeout="2"/></Response>';
      mockVoicemailService.createRecordingResponse.mockReturnValue(mockResponse);

      const response = await request(app)
        .post('/voicemail/start-recording')
        .expect(200)
        .expect('Content-Type', /xml/);

      expect(response.text).toBe(mockResponse);
      expect(mockVoicemailService.createRecordingResponse).toHaveBeenCalledTimes(1);
    });

    test('should return error fallback on service error', async () => {
      const mockErrorResponse = '<?xml version="1.0" encoding="UTF-8"?><Response><Redirect>/incoming/voicemail-legacy</Redirect></Response>';
      mockVoicemailService.createRecordingResponse.mockImplementation(() => {
        throw new Error('Service error');
      });
      mockVoicemailService.createErrorFallbackResponse.mockReturnValue(mockErrorResponse);

      const response = await request(app)
        .post('/voicemail/start-recording')
        .expect(200)
        .expect('Content-Type', /xml/);

      expect(response.text).toBe(mockErrorResponse);
      expect(mockVoicemailService.createErrorFallbackResponse).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /voicemail/recording-complete', () => {
    test('should handle recording completion and return connection response', async () => {
      const callSid = 'CA123456789';
      const recordingUrl = 'https://api.twilio.com/recordings/RE123';
      const recordingDuration = '15';
      const mockResponse = '<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="wss://test.com/connection"/></Connect></Response>';
      
      mockVoicemailService.createConnectionResponse.mockReturnValue(mockResponse);

      const response = await request(app)
        .post('/voicemail/recording-complete')
        .send({
          CallSid: callSid,
          RecordingUrl: recordingUrl,
          RecordingDuration: recordingDuration
        })
        .expect(200)
        .expect('Content-Type', /xml/);

      expect(response.text).toBe(mockResponse);
      expect(mockVoicemailService.handleRecordingComplete).toHaveBeenCalledWith(callSid, recordingUrl, recordingDuration);
      expect(mockVoicemailService.createConnectionResponse).toHaveBeenCalledWith(callSid);
    });

    test('should return error fallback on service error', async () => {
      const mockErrorResponse = '<?xml version="1.0" encoding="UTF-8"?><Response><Redirect>/incoming/voicemail-legacy</Redirect></Response>';
      mockVoicemailService.handleRecordingComplete.mockImplementation(() => {
        throw new Error('Service error');
      });
      mockVoicemailService.createErrorFallbackResponse.mockReturnValue(mockErrorResponse);

      const response = await request(app)
        .post('/voicemail/recording-complete')
        .send({
          CallSid: 'CA123456789',
          RecordingUrl: 'https://api.twilio.com/recordings/RE123',
          RecordingDuration: '15'
        })
        .expect(200)
        .expect('Content-Type', /xml/);

      expect(response.text).toBe(mockErrorResponse);
      expect(mockVoicemailService.createErrorFallbackResponse).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /voicemail/transcription-webhook', () => {
    test('should store transcription when TranscriptionText is provided', async () => {
      const callSid = 'CA123456789';
      const transcriptionText = 'Hello, this is a test message';

      const response = await request(app)
        .post('/voicemail/transcription-webhook')
        .send({
          CallSid: callSid,
          TranscriptionText: transcriptionText
        })
        .expect(200);

      expect(response.text).toBe('OK');
      expect(mockTranscriptionCache.store).toHaveBeenCalledWith(callSid, transcriptionText);
    });

    test('should not store transcription when TranscriptionText is empty', async () => {
      const callSid = 'CA123456789';

      const response = await request(app)
        .post('/voicemail/transcription-webhook')
        .send({
          CallSid: callSid,
          TranscriptionText: ''
        })
        .expect(200);

      expect(response.text).toBe('OK');
      expect(mockTranscriptionCache.store).not.toHaveBeenCalled();
    });

    test('should not store transcription when TranscriptionText is missing', async () => {
      const callSid = 'CA123456789';

      const response = await request(app)
        .post('/voicemail/transcription-webhook')
        .send({
          CallSid: callSid
        })
        .expect(200);

      expect(response.text).toBe('OK');
      expect(mockTranscriptionCache.store).not.toHaveBeenCalled();
    });

    test('should return error status when transcription storage fails', async () => {
      mockTranscriptionCache.store.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const response = await request(app)
        .post('/voicemail/transcription-webhook')
        .send({
          CallSid: 'CA123456789',
          TranscriptionText: 'Test message'
        })
        .expect(500);

      expect(response.text).toBe('Error');
    });
  });
});