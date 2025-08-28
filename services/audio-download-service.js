/**
 * AudioDownloadService - Downloads audio recordings from Twilio
 * 
 * Provides fast audio download capabilities for voicemail transcription
 * with Twilio authentication and retry logic
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class AudioDownloadService {
  constructor() {
    this.twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    this.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    this.timeout = parseInt(process.env.AUDIO_DOWNLOAD_TIMEOUT) || 5000;
    this.tempDir = path.join(__dirname, '..', 'temp', 'audio');
    this.maxRetries = 3;
    
    // Ensure temp directory exists
    this.ensureTempDirectory();
  }

  /**
   * Create temp directory for audio files if it doesn't exist
   */
  async ensureTempDirectory() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp audio directory:', error.message);
    }
  }

  /**
   * Download audio file from Twilio Recording URL
   * @param {string} recordingUrl - Twilio recording URL (without format extension)
   * @param {string} callSid - Call SID for file naming
   * @param {string} format - Audio format preference ('mp3' or 'wav')
   * @returns {Promise<Buffer>} - Audio data buffer
   */
  async downloadAudio(recordingUrl, callSid, format = 'mp3') {
    if (!this.twilioAccountSid || !this.twilioAuthToken) {
      throw new Error('Twilio credentials not configured for audio download');
    }

    const audioUrl = `${recordingUrl}.${format}`;
    console.log(`🎵 Downloading audio from Twilio: ${format.toUpperCase()} format`.cyan);

    let lastError = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        
        const response = await axios.get(audioUrl, {
          auth: {
            username: this.twilioAccountSid,
            password: this.twilioAuthToken
          },
          responseType: 'arraybuffer',
          timeout: this.timeout,
          headers: {
            'Accept': `audio/${format}`
          }
        });

        const downloadTime = Date.now() - startTime;
        const audioBuffer = Buffer.from(response.data);
        
        console.log(`✅ Audio downloaded successfully: ${audioBuffer.length} bytes in ${downloadTime}ms (attempt ${attempt})`.green);
        
        // Optional: Cache to temp file for debugging
        if (process.env.NODE_ENV === 'development') {
          await this.cacheAudioFile(callSid, audioBuffer, format);
        }
        
        return audioBuffer;
        
      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt === this.maxRetries;
        
        if (error.response) {
          console.log(`❌ Audio download failed (attempt ${attempt}/${this.maxRetries}): HTTP ${error.response.status}`.red);
          
          // Don't retry on 404 or 403 - these won't resolve with retries
          if (error.response.status === 404 || error.response.status === 403) {
            throw new Error(`Audio file not accessible: HTTP ${error.response.status}`);
          }
        } else if (error.code === 'ECONNABORTED') {
          console.log(`⏱️ Audio download timeout (attempt ${attempt}/${this.maxRetries})`.yellow);
        } else {
          console.log(`🔗 Network error downloading audio (attempt ${attempt}/${this.maxRetries}): ${error.message}`.yellow);
        }
        
        if (!isLastAttempt) {
          // Exponential backoff: 500ms, 1000ms, 2000ms
          const delay = 500 * Math.pow(2, attempt - 1);
          console.log(`⏳ Retrying in ${delay}ms...`.yellow);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`Failed to download audio after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Download with fallback format - try MP3 first, then WAV
   * @param {string} recordingUrl - Twilio recording URL
   * @param {string} callSid - Call SID for file naming
   * @returns {Promise<{buffer: Buffer, format: string}>}
   */
  async downloadWithFallback(recordingUrl, callSid) {
    // Try MP3 first (smaller, faster)
    try {
      const buffer = await this.downloadAudio(recordingUrl, callSid, 'mp3');
      return { buffer, format: 'mp3' };
    } catch (mp3Error) {
      console.log('🔄 MP3 download failed, trying WAV format...'.yellow);
      
      try {
        const buffer = await this.downloadAudio(recordingUrl, callSid, 'wav');
        return { buffer, format: 'wav' };
      } catch (wavError) {
        throw new Error(`Both MP3 and WAV downloads failed. MP3: ${mp3Error.message}, WAV: ${wavError.message}`);
      }
    }
  }

  /**
   * Cache audio file temporarily for debugging
   * @param {string} callSid - Call SID for filename
   * @param {Buffer} audioBuffer - Audio data
   * @param {string} format - File format
   */
  async cacheAudioFile(callSid, audioBuffer, format) {
    try {
      const filename = `${callSid}_${Date.now()}.${format}`;
      const filepath = path.join(this.tempDir, filename);
      
      await fs.writeFile(filepath, audioBuffer);
      console.log(`💾 Audio cached: ${filename}`.gray);
      
      // Auto-cleanup after 10 minutes
      setTimeout(async () => {
        try {
          await fs.unlink(filepath);
          console.log(`🗑️ Cleaned up cached audio: ${filename}`.gray);
        } catch (error) {
          // Ignore cleanup errors
        }
      }, 600000);
      
    } catch (error) {
      console.error('Failed to cache audio file:', error.message);
      // Don't throw - caching is optional
    }
  }

  /**
   * Validate audio buffer format and size
   * @param {Buffer} audioBuffer - Audio data buffer
   * @param {string} format - Expected format
   * @returns {boolean} - Valid audio buffer
   */
  validateAudioBuffer(audioBuffer, format) {
    if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
      return false;
    }
    
    // Basic format validation based on magic bytes
    if (format === 'mp3') {
      // MP3 files start with ID3 tag or sync frame
      const header = audioBuffer.slice(0, 3).toString();
      return header === 'ID3' || audioBuffer[0] === 0xFF;
    } else if (format === 'wav') {
      // WAV files start with 'RIFF' and contain 'WAVE'
      return audioBuffer.slice(0, 4).toString() === 'RIFF' && 
             audioBuffer.slice(8, 12).toString() === 'WAVE';
    }
    
    return true; // Unknown format - assume valid
  }

  /**
   * Get audio file size limits for Whisper API
   * @returns {object} Size limits in bytes
   */
  getWhisperLimits() {
    return {
      maxFileSize: 25 * 1024 * 1024, // 25MB Whisper API limit
      recommendedSize: 10 * 1024 * 1024 // 10MB for faster processing
    };
  }

  /**
   * Check if audio buffer is within Whisper API limits
   * @param {Buffer} audioBuffer - Audio data buffer
   * @returns {object} Size validation result
   */
  validateForWhisper(audioBuffer) {
    const limits = this.getWhisperLimits();
    const size = audioBuffer.length;
    
    return {
      valid: size <= limits.maxFileSize,
      size: size,
      maxSize: limits.maxFileSize,
      withinRecommended: size <= limits.recommendedSize,
      sizeMB: Math.round(size / (1024 * 1024) * 100) / 100
    };
  }

  /**
   * Clean up temp directory (remove old cached files)
   */
  async cleanupTempFiles() {
    try {
      const files = await fs.readdir(this.tempDir);
      const cutoffTime = Date.now() - (10 * 60 * 1000); // 10 minutes ago
      
      for (const file of files) {
        const filepath = path.join(this.tempDir, file);
        const stats = await fs.stat(filepath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filepath);
          console.log(`🗑️ Cleaned up old cached audio: ${file}`.gray);
        }
      }
    } catch (error) {
      console.error('Error cleaning up temp files:', error.message);
    }
  }
}

module.exports = AudioDownloadService;