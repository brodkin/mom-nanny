const VoicemailTranscriptionCache = require('../services/voicemail-transcription-cache');

describe('VoicemailTranscriptionCache', () => {
  let cache;

  beforeEach(() => {
    cache = new VoicemailTranscriptionCache();
  });

  afterEach(() => {
    // Clean up any running intervals
    cache.shutdown();
  });

  describe('store', () => {
    test('should store transcription with metadata', () => {
      const callSid = 'CA123456789';
      const transcription = 'Hello, this is a test message';

      const result = cache.store(callSid, transcription);

      expect(result).toBeTruthy();
      expect(result.transcription).toBe(transcription);
      expect(result.callSid).toBe(callSid);
      expect(result.timestamp).toBeGreaterThan(Date.now() - 1000); // Within last second
    });

    test('should trim whitespace from transcription', () => {
      const callSid = 'CA123456789';
      const transcription = '  Hello, this is a test message  ';

      const result = cache.store(callSid, transcription);

      expect(result.transcription).toBe('Hello, this is a test message');
    });

    test('should handle empty transcription', () => {
      const callSid = 'CA123456789';
      const transcription = '';

      const result = cache.store(callSid, transcription);

      expect(result.transcription).toBe('');
    });
  });

  describe('retrieve', () => {
    test('should retrieve stored transcription', () => {
      const callSid = 'CA123456789';
      const transcription = 'Hello, this is a test message';

      cache.store(callSid, transcription);
      const result = cache.retrieve(callSid);

      expect(result).toBeTruthy();
      expect(result.transcription).toBe(transcription);
      expect(result.callSid).toBe(callSid);
    });

    test('should return null for non-existent call SID', () => {
      const result = cache.retrieve('INVALID');
      expect(result).toBeNull();
    });
  });

  describe('exists', () => {
    test('should return true for existing transcription', () => {
      const callSid = 'CA123456789';
      const transcription = 'Hello, this is a test message';

      cache.store(callSid, transcription);
      const result = cache.exists(callSid);

      expect(result).toBe(true);
    });

    test('should return false for non-existent transcription', () => {
      const result = cache.exists('INVALID');
      expect(result).toBe(false);
    });
  });

  describe('remove', () => {
    test('should remove existing transcription', () => {
      const callSid = 'CA123456789';
      const transcription = 'Hello, this is a test message';

      cache.store(callSid, transcription);
      const removed = cache.remove(callSid);

      expect(removed).toBe(true);
      expect(cache.exists(callSid)).toBe(false);
    });

    test('should return false when removing non-existent transcription', () => {
      const removed = cache.remove('INVALID');
      expect(removed).toBe(false);
    });
  });

  describe('getStats', () => {
    test('should return correct stats for empty cache', () => {
      const stats = cache.getStats();

      expect(stats.total).toBe(0);
      expect(stats.old).toBe(0);
      expect(stats.fresh).toBe(0);
    });

    test('should return correct stats with transcriptions', () => {
      cache.store('CA1', 'Message 1');
      cache.store('CA2', 'Message 2');
      
      const stats = cache.getStats();

      expect(stats.total).toBe(2);
      expect(stats.fresh).toBe(2); // Both should be fresh
      expect(stats.old).toBe(0);
    });

    test('should identify old transcriptions', (done) => {
      // Mock timestamp for old entry
      const oldTimestamp = Date.now() - 400000; // 6.67 minutes ago (older than 5 minutes)
      cache.store('CA1', 'Old message');
      
      // Manually set old timestamp
      const transcriptionData = cache.transcriptions.get('CA1');
      transcriptionData.timestamp = oldTimestamp;
      
      cache.store('CA2', 'Fresh message');
      
      const stats = cache.getStats();

      expect(stats.total).toBe(2);
      expect(stats.old).toBe(1);
      expect(stats.fresh).toBe(1);
      done();
    });
  });

  describe('clear', () => {
    test('should clear all transcriptions', () => {
      cache.store('CA1', 'Message 1');
      cache.store('CA2', 'Message 2');

      expect(cache.getStats().total).toBe(2);

      cache.clear();

      expect(cache.getStats().total).toBe(0);
    });
  });

  describe('getAllTranscriptions', () => {
    test('should return array of all transcription data', () => {
      cache.store('CA1', 'Message 1');
      cache.store('CA2', 'Message 2');

      const all = cache.getAllTranscriptions();

      expect(Array.isArray(all)).toBe(true);
      expect(all).toHaveLength(2);
      expect(all.some(t => t.transcription === 'Message 1')).toBe(true);
      expect(all.some(t => t.transcription === 'Message 2')).toBe(true);
    });

    test('should return empty array for empty cache', () => {
      const all = cache.getAllTranscriptions();

      expect(Array.isArray(all)).toBe(true);
      expect(all).toHaveLength(0);
    });
  });

  describe('performCleanup', () => {
    test('should remove expired entries', (done) => {
      // Create old entry
      const oldTimestamp = Date.now() - 700000; // 11.67 minutes ago (older than 10 minutes)
      cache.store('CA1', 'Old message');
      
      // Manually set old timestamp
      const transcriptionData = cache.transcriptions.get('CA1');
      transcriptionData.timestamp = oldTimestamp;
      
      cache.store('CA2', 'Fresh message');

      expect(cache.getStats().total).toBe(2);

      cache.performCleanup();

      expect(cache.getStats().total).toBe(1);
      expect(cache.exists('CA1')).toBe(false);
      expect(cache.exists('CA2')).toBe(true);
      done();
    });

    test('should not remove fresh entries', () => {
      cache.store('CA1', 'Fresh message 1');
      cache.store('CA2', 'Fresh message 2');

      expect(cache.getStats().total).toBe(2);

      cache.performCleanup();

      expect(cache.getStats().total).toBe(2);
    });
  });

  describe('cleanup interval', () => {
    test('should start cleanup interval on construction', () => {
      const cache = new VoicemailTranscriptionCache();
      expect(cache.cleanupInterval).toBeTruthy();
      cache.shutdown();
    });

    test('should stop cleanup interval on shutdown', () => {
      const cache = new VoicemailTranscriptionCache();
      const _intervalId = cache.cleanupInterval;
      
      cache.shutdown();
      
      expect(cache.cleanupInterval).toBeNull();
    });

    test('should stop cleanup interval when called explicitly', () => {
      const cache = new VoicemailTranscriptionCache();
      
      cache.stopCleanupInterval();
      
      expect(cache.cleanupInterval).toBeNull();
    });
  });
});