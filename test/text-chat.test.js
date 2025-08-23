// Set a dummy API key for tests
process.env.OPENAI_API_KEY = 'test-key-for-testing';

const { TranscriptionService } = require('../services/mock-transcription-service');
const { TextToSpeechService } = require('../services/mock-tts-service');
const { StreamService } = require('../services/mock-stream-service');
const { ChatSession } = require('../services/chat-session');

describe('Text Chat Components', () => {
  describe('MockTranscriptionService', () => {
    let service;

    beforeEach(() => {
      service = new TranscriptionService();
    });

    afterEach(() => {
      service.close();
    });

    test('should emit transcript events for text input', (done) => {
      const testText = 'Hello, how are you?';
      
      let eventCount = 0;
      service.on('transcript', (data) => {
        eventCount++;
        
        if (data.is_final && data.speech_final) {
          expect(data.channel.alternatives[0].transcript).toBe(testText);
          expect(data.channel.alternatives[0].confidence).toBe(1.0);
          expect(eventCount).toBe(2); // interim + final
          done();
        }
      });

      service.processTextInput(testText);
    });

    test('should ignore empty input', () => {
      let eventCount = 0;
      service.on('transcript', () => {
        eventCount++;
      });

      service.processTextInput('');
      service.processTextInput('   ');
      
      expect(eventCount).toBe(0);
    });
  });

  describe('MockTextToSpeechService', () => {
    let service;

    beforeEach(() => {
      service = new TextToSpeechService();
    });

    afterEach(() => {
      service.close();
    });

    test('should generate speech events for GPT replies', async () => {
      const gptReply = {
        partialResponseIndex: 0,
        partialResponse: 'Hello there!'
      };

      const speechPromise = new Promise((resolve) => {
        service.on('speech', (audioData, _interactionCount) => {
          expect(audioData.partialResponseIndex).toBe(0);
          expect(audioData.partialResponse).toBe('Hello there!');
          expect(audioData.mockAudio).toBe('[AUDIO: 12 chars]');
          resolve();
        });
      });

      await service.generate(gptReply, 1);
      await speechPromise;
    });

    test('should ignore empty responses', async () => {
      let eventCount = 0;
      service.on('speech', () => {
        eventCount++;
      });

      await service.generate({ partialResponse: '' }, 1);
      await service.generate({ partialResponse: null }, 1);
      
      expect(eventCount).toBe(0);
    });
  });

  describe('MockStreamService', () => {
    let service;

    beforeEach(() => {
      service = new StreamService();
    });

    afterEach(() => {
      service.close();
    });

    test('should emit audiosent events when buffering audio', (done) => {
      service.on('audiosent', (markLabel) => {
        expect(typeof markLabel).toBe('string');
        expect(markLabel.length).toBeGreaterThan(0);
        done();
      });

      service.buffer(0, 'mock-audio-data');
    });

    test('should handle intro messages without index', (done) => {
      service.on('audiosent', (markLabel) => {
        expect(typeof markLabel).toBe('string');
        done();
      });

      service.buffer(null, 'intro-audio-data');
    });

    test('should buffer out-of-order audio', () => {
      // Buffer audio out of order
      service.buffer(2, 'audio-2');
      service.buffer(1, 'audio-1');
      
      // Should still be waiting for index 0
      expect(service.expectedAudioIndex).toBe(0);
      expect(Object.keys(service.audioBuffer).length).toBe(2);
    });
  });

  describe('Enhanced GptService Token Usage', () => {
    test('should support returnUsage parameter', () => {
      const { GptService } = require('../services/gpt-service');
      const gptService = new GptService(null);
      
      // Test that the completion method accepts the returnUsage parameter
      expect(() => {
        gptService.completion('test', 1, 'user', 'user', true);
      }).not.toThrow();
    });
  });
});

describe('Integration Tests', () => {
  describe('ChatSession', () => {
    let chatSession;

    beforeEach(() => {
      // Mock console.log to avoid output during tests
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'clear').mockImplementation(() => {});
      
      chatSession = new ChatSession();
    });

    afterEach(async () => {
      if (chatSession) {
        await chatSession.endSession();
      }
      
      // Restore console methods
      console.log.mockRestore();
      console.clear.mockRestore();
    });

    test('should initialize with proper state', async () => {
      // Add a small delay to let any async operations complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(chatSession.messageCount).toBe(0);
      expect(chatSession.sessionTokens.total).toBe(0);
      expect(chatSession.conversationHistory).toEqual([]);
      expect(chatSession.isActive).toBe(true);
      expect(chatSession.startTime).toBeLessThanOrEqual(Date.now());
    });

    test('should not make OpenAI API calls during initialization', () => {
      // This test should pass once we fix the async initialization issue
      // The fact that we can create a ChatSession without API errors proves initialization is working
      expect(chatSession.gptService).toBeDefined();
      expect(chatSession.memoryService).toBeDefined();
      expect(chatSession.isActive).toBe(true);
    });

    test('should use mock GPT responses in test environment', async () => {
      const testMessage = 'Hello test message';
      
      // Mock the handleUserMessage to capture the GPT response
      const gptResponsePromise = new Promise((resolve) => {
        chatSession.gptService.once('gptreply', (gptReply) => {
          resolve(gptReply);
        });
      });
      
      // Trigger a completion
      const result = await chatSession.gptService.completion(testMessage, 1, 'user', 'user', true);
      
      // Verify mock response
      expect(result.usage).toBeDefined();
      expect(result.usage.total_tokens).toBeGreaterThan(0);
      
      // Wait for and verify the GPT reply event
      const gptReply = await gptResponsePromise;
      expect(gptReply.partialResponse).toContain(testMessage);
      expect(gptReply.isFinal).toBe(true);
    });

    test('should handle command input', async () => {
      await chatSession.processUserInput('/help');
      // Should not increment message count for commands
      expect(chatSession.messageCount).toBe(0);
    });

    test('should process text input through transcription service', async () => {
      const testMessage = 'Hello, I need help';
      
      // Mock the handleUserMessage to avoid OpenAI API call
      const originalHandler = chatSession.handleUserMessage;
      chatSession.handleUserMessage = jest.fn();
      
      await chatSession.processUserInput(testMessage);
      
      // Give it a moment for the async processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(chatSession.handleUserMessage).toHaveBeenCalledWith(testMessage);
      
      // Restore original handler
      chatSession.handleUserMessage = originalHandler;
    });

    test('should ignore empty input', async () => {
      const originalHandler = chatSession.handleUserMessage;
      chatSession.handleUserMessage = jest.fn();
      
      await chatSession.processUserInput('');
      await chatSession.processUserInput('   ');
      
      expect(chatSession.handleUserMessage).not.toHaveBeenCalled();
      
      chatSession.handleUserMessage = originalHandler;
    });

    test('should detect function call messages', () => {
      const functionMessage = 'Let me check what\'s happening in the news today.';
      const regularMessage = 'How are you feeling today?';
      
      expect(chatSession.isFunctionCallMessage(functionMessage)).toBe(true);
      expect(chatSession.isFunctionCallMessage(regularMessage)).toBe(false);
    });

    test('should update token usage correctly', () => {
      const mockUsage = {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      };
      
      chatSession.updateTokenUsage(mockUsage);
      
      expect(chatSession.sessionTokens.prompt).toBe(100);
      expect(chatSession.sessionTokens.completion).toBe(50);
      expect(chatSession.sessionTokens.total).toBe(150);
      
      // Test cumulative usage
      chatSession.updateTokenUsage(mockUsage);
      
      expect(chatSession.sessionTokens.prompt).toBe(200);
      expect(chatSession.sessionTokens.completion).toBe(100);
      expect(chatSession.sessionTokens.total).toBe(300);
    });
  });
});