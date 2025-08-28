/**
 * WhisperTranscriptionService - OpenAI Whisper API integration for voicemail transcription
 * 
 * Provides fast, accurate transcription of voicemail recordings using OpenAI's Whisper model.
 * Designed specifically for elderly callers and dementia care scenarios.
 */

const OpenAI = require('openai');

class WhisperTranscriptionService {
  constructor() {
    this.openai = new OpenAI();
    this.model = process.env.WHISPER_MODEL || 'whisper-1';
    this.language = process.env.WHISPER_LANGUAGE || 'en';
    this.maxFileSize = 25 * 1024 * 1024; // 25MB Whisper API limit
    this.chunkSize = 20 * 1024 * 1024; // 20MB chunks for safety
  }

  /**
   * Transcribe audio buffer using OpenAI Whisper API
   * @param {Buffer} audioBuffer - Audio data buffer
   * @param {string} format - Audio format (mp3, wav, etc.)
   * @param {string} callSid - Call SID for context
   * @returns {Promise<object>} - Transcription result with text and metadata
   */
  async transcribeAudio(audioBuffer, format, callSid) {
    console.log(`🎤 Starting Whisper transcription for ${callSid}...`.cyan);
    const startTime = Date.now();

    // Validate buffer size
    const sizeValidation = this.validateAudioSize(audioBuffer);
    if (!sizeValidation.valid) {
      throw new Error(`Audio file too large: ${sizeValidation.sizeMB}MB (max: ${sizeValidation.maxSizeMB}MB)`);
    }

    try {
      // Check if chunking is needed for large files
      if (audioBuffer.length > this.chunkSize) {
        console.log(`📦 Large audio file detected (${sizeValidation.sizeMB}MB), chunking not implemented yet`.yellow);
        // For now, proceed with full file - chunking can be added later if needed
      }

      // Create a file-like object for the OpenAI client
      const audioFile = new File([audioBuffer], `voicemail_${callSid}.${format}`, {
        type: `audio/${format}`
      });

      // Create transcription request
      const transcriptionRequest = {
        file: audioFile,
        model: this.model,
        language: this.language,
        response_format: 'verbose_json',
        prompt: this.getContextPrompt()
      };

      console.log(`🔊 Sending ${sizeValidation.sizeMB}MB ${format.toUpperCase()} file to Whisper API...`.gray);
      
      const response = await this.openai.audio.transcriptions.create(transcriptionRequest);
      
      const processingTime = Date.now() - startTime;
      const transcriptionText = response.text?.trim() || '';
      
      if (!transcriptionText) {
        console.log('⚠️ Empty transcription returned from Whisper API'.yellow);
        return {
          text: '',
          confidence: 0,
          processingTime,
          language: response.language || this.language,
          duration: response.duration || 0,
          segments: response.segments || []
        };
      }

      console.log(`✅ Whisper transcription complete: "${transcriptionText.substring(0, 100)}${transcriptionText.length > 100 ? '...' : ''}" (${processingTime}ms)`.green);
      
      // Calculate confidence score from segments if available
      const confidence = this.calculateConfidenceScore(response.segments);
      
      return {
        text: transcriptionText,
        confidence,
        processingTime,
        language: response.language || this.language,
        duration: response.duration || 0,
        segments: response.segments || [],
        model: this.model,
        fileSizeMB: sizeValidation.sizeMB
      };

    } catch (error) {
      const _processingTime = Date.now() - startTime;
      
      // Parse OpenAI API errors
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;
        
        console.log(`❌ Whisper API error (${status}): ${errorData?.error?.message || 'Unknown error'}`.red);
        
        // Specific error handling
        if (status === 413) {
          throw new Error(`Audio file too large for Whisper API (${sizeValidation.sizeMB}MB)`);
        } else if (status === 400) {
          throw new Error(`Invalid audio format or corrupted file: ${errorData?.error?.message}`);
        } else if (status === 429) {
          throw new Error('Whisper API rate limit exceeded - too many requests');
        } else {
          throw new Error(`Whisper API error (${status}): ${errorData?.error?.message || 'Unknown error'}`);
        }
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Whisper API timeout - audio file may be too large or service unavailable');
      } else {
        console.error('Whisper transcription error:', error.message);
        throw new Error(`Whisper transcription failed: ${error.message}`);
      }
    }
  }

  /**
   * Get context prompt optimized for elderly callers and voicemail scenarios
   * @returns {string} - Context prompt for Whisper
   */
  getContextPrompt() {
    return 'Voicemail from elderly caller speaking to AI companion named Ryan. May include names like Francine, Mary, Gary, or medical terms. Speaker may have dementia-related speech patterns, repetition, or unclear pronunciation.';
  }

  /**
   * Calculate confidence score from Whisper segments
   * @param {Array} segments - Whisper response segments with timing info
   * @returns {number} - Confidence score (0-1)
   */
  calculateConfidenceScore(segments) {
    if (!segments || segments.length === 0) {
      return 0.5; // Default confidence for responses without segments
    }

    // Whisper doesn't always provide confidence scores in segments
    // Use segment count and timing consistency as proxy for confidence
    const totalDuration = segments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
    const avgSegmentLength = totalDuration / segments.length;
    
    // Longer segments with consistent timing suggest better confidence
    if (avgSegmentLength > 2) {
      return 0.9; // High confidence
    } else if (avgSegmentLength > 1) {
      return 0.7; // Medium confidence  
    } else {
      return 0.5; // Lower confidence for very short segments
    }
  }

  /**
   * Validate audio buffer size against Whisper API limits
   * @param {Buffer} audioBuffer - Audio data buffer
   * @returns {object} - Size validation result
   */
  validateAudioSize(audioBuffer) {
    const sizeBytes = audioBuffer.length;
    const sizeMB = Math.round(sizeBytes / (1024 * 1024) * 100) / 100;
    const maxSizeMB = Math.round(this.maxFileSize / (1024 * 1024) * 100) / 100;
    
    return {
      valid: sizeBytes <= this.maxFileSize,
      sizeBytes,
      sizeMB,
      maxSizeMB,
      withinRecommended: sizeBytes <= (10 * 1024 * 1024) // 10MB recommended
    };
  }

  /**
   * Process transcription for voicemail context
   * @param {string} transcriptionText - Raw transcription text
   * @returns {object} - Processed transcription with metadata
   */
  processVoicemailTranscription(transcriptionText) {
    if (!transcriptionText || transcriptionText.trim().length === 0) {
      return {
        processedText: '',
        isEmpty: true,
        wordCount: 0,
        hasGreeting: false,
        hasUrgency: false,
        topics: []
      };
    }

    const processedText = transcriptionText.trim();
    const wordCount = processedText.split(/\s+/).length;
    
    // Analyze voicemail content
    const lowerText = processedText.toLowerCase();
    
    // Check for common voicemail greetings
    const hasGreeting = /\b(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(lowerText);
    
    // Check for urgency indicators
    const hasUrgency = /\b(urgent|emergency|help|pain|can't|won't|need|please|worried|scared)\b/.test(lowerText);
    
    // Extract potential topics (simple keyword extraction)
    const topics = this.extractTopics(lowerText);
    
    return {
      processedText,
      isEmpty: false,
      wordCount,
      hasGreeting,
      hasUrgency,
      topics,
      length: processedText.length
    };
  }

  /**
   * Extract topics from transcription text for voicemail context
   * @param {string} text - Lowercase transcription text
   * @returns {Array} - Array of detected topics
   */
  extractTopics(text) {
    const topics = [];
    
    // Medical/health topics
    if (/\b(pain|hurt|sick|medicine|medication|doctor|hospital|nurse)\b/.test(text)) {
      topics.push('medical');
    }
    
    // Food/eating topics  
    if (/\b(eat|food|hungry|lunch|dinner|breakfast|meal)\b/.test(text)) {
      topics.push('food');
    }
    
    // Social/family topics
    if (/\b(visit|come|see|family|daughter|son|mary|gary)\b/.test(text)) {
      topics.push('family');
    }
    
    // Anxiety/worry topics
    if (/\b(worried|scared|afraid|anxious|nervous|upset)\b/.test(text)) {
      topics.push('anxiety');
    }
    
    // Basic needs topics
    if (/\b(bathroom|sleep|tired|cold|hot|water)\b/.test(text)) {
      topics.push('basic-needs');
    }
    
    return topics;
  }

  /**
   * Chunk large audio files for processing (for future implementation)
   * @param {Buffer} audioBuffer - Large audio buffer
   * @param {number} chunkSize - Size of each chunk in bytes
   * @returns {Array<Buffer>} - Array of audio chunks
   */
  chunkAudioBuffer(audioBuffer, chunkSize = this.chunkSize) {
    const chunks = [];
    let offset = 0;
    
    while (offset < audioBuffer.length) {
      const end = Math.min(offset + chunkSize, audioBuffer.length);
      chunks.push(audioBuffer.slice(offset, end));
      offset = end;
    }
    
    console.log(`📦 Split ${audioBuffer.length} bytes into ${chunks.length} chunks`.gray);
    return chunks;
  }

  /**
   * Get supported audio formats for Whisper API
   * @returns {Array<string>} - Supported audio formats
   */
  getSupportedFormats() {
    return ['m4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'wav', 'webm'];
  }

  /**
   * Check if audio format is supported by Whisper
   * @param {string} format - Audio format to check
   * @returns {boolean} - Format is supported
   */
  isFormatSupported(format) {
    return this.getSupportedFormats().includes(format.toLowerCase());
  }

  /**
   * Get estimated processing time based on audio duration and size
   * @param {number} durationSeconds - Audio duration in seconds
   * @param {number} fileSizeMB - File size in MB
   * @returns {object} - Processing time estimates
   */
  getProcessingTimeEstimate(durationSeconds, fileSizeMB) {
    // Whisper typically processes at 0.5-2x real-time speed
    const minTime = Math.max(1000, durationSeconds * 500); // Minimum 1 second, or 0.5x real-time
    const maxTime = durationSeconds * 2000; // Up to 2x real-time
    
    // Add overhead for larger files
    const sizeOverhead = Math.max(0, (fileSizeMB - 1) * 200); // 200ms per MB over 1MB
    
    return {
      minMs: minTime + sizeOverhead,
      maxMs: maxTime + sizeOverhead,
      expectedMs: Math.round((minTime + maxTime) / 2 + sizeOverhead)
    };
  }
}

module.exports = WhisperTranscriptionService;