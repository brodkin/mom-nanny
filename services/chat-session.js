require('colors');
const chalk = require('chalk');
const EventEmitter = require('events');
const { GptService } = require('./gpt-service');
const { TranscriptionService } = require('./mock-transcription-service');
const { TextToSpeechService } = require('./mock-tts-service');
const { StreamService } = require('./mock-stream-service');

/**
 * Chat Session Manager for text-based conversation testing
 * Integrates all mock services and tracks conversation state with usage analytics
 */
class ChatSession extends EventEmitter {
  constructor(debugMode = false) {
    super();
    
    // Debug mode flag
    this.debugMode = debugMode;
    
    // Initialize services with debug mode
    this.streamService = new StreamService(this.debugMode);
    this.transcriptionService = new TranscriptionService(this.debugMode);
    this.ttsService = new TextToSpeechService(this.debugMode);
    this.gptService = new GptService(null); // No mark completion service needed for text chat
    
    // Session state
    this.messageCount = 0;
    this.sessionTokens = {
      total: 0,
      prompt: 0,
      completion: 0
    };
    this.conversationHistory = [];
    this.isActive = true;
    this.startTime = Date.now();
    
    // Set up event handlers
    this.setupEventHandlers();
    
    console.log(chalk.cyan('💬 Chat Session initialized'));
    console.log(chalk.gray('Type your messages or use commands: /help, /stats, /context, /debug, /reset, /exit'));
  }

  setupEventHandlers() {
    // Handle transcription events (from user input)
    this.transcriptionService.on('transcript', (data) => {
      if (data.is_final && data.speech_final && data.channel.alternatives[0]) {
        const transcript = data.channel.alternatives[0].transcript;
        if (transcript.trim()) {
          this.handleUserMessage(transcript);
        }
      }
    });

    // Handle GPT replies
    this.gptService.on('gptreply', (gptReply, interactionCount) => {
      this.handleGptReply(gptReply, interactionCount);
    });

    // Handle TTS events
    this.ttsService.on('speech', (audioData, interactionCount) => {
      // TTS processing complete - no additional action needed for text chat
    });

    // Handle stream events
    this.streamService.on('audiosent', (markLabel) => {
      // Audio sent - no additional action needed for text chat
    });
  }

  /**
   * Process user input text
   * @param {string} text - User's input text
   */
  async processUserInput(text) {
    if (!this.isActive) {
      console.log(chalk.red('❌ Session is not active'));
      return;
    }

    const trimmedText = text.trim();
    if (!trimmedText) return;

    // Handle commands
    if (trimmedText.startsWith('/')) {
      this.handleCommand(trimmedText);
      return;
    }

    // Process as regular message
    this.transcriptionService.processTextInput(trimmedText);
  }

  /**
   * Handle user message from transcription
   * @param {string} message - User message
   */
  async handleUserMessage(message) {
    this.messageCount++;
    const timestamp = new Date().toLocaleTimeString();
    
    // Add to conversation history
    this.conversationHistory.push({
      type: 'user',
      message: message,
      timestamp: timestamp,
      messageId: this.messageCount
    });

    // Display user message
    console.log(`\n${chalk.cyan('🗣️ ')} ${chalk.cyan(message)}`);

    try {
      // Get GPT response with usage tracking
      const result = await this.gptService.completion(
        message,
        this.messageCount,
        'user',
        'user',
        true // Enable usage tracking
      );

      if (result && result.usage) {
        this.updateTokenUsage(result.usage);
        this.displayTokenUsage(result.usage);
      }
    } catch (error) {
      console.log(chalk.red(`❌ Error processing message: ${error.message}`));
    }
  }

  /**
   * Handle GPT reply events
   * @param {Object} gptReply - GPT reply data
   * @param {number} interactionCount - Current interaction number
   */
  handleGptReply(gptReply, interactionCount) {
    const { partialResponseIndex, partialResponse } = gptReply;
    
    if (!partialResponse) return;

    const timestamp = new Date().toLocaleTimeString();

    // Check if this is a function call message
    const isFunctionCall = this.isFunctionCallMessage(partialResponse);
    
    if (isFunctionCall) {
      console.log(`${chalk.yellow('🔧')} ${chalk.yellow(partialResponse)}`);
      
      this.conversationHistory.push({
        type: 'function',
        message: partialResponse,
        timestamp: timestamp,
        interactionId: interactionCount,
        partialIndex: partialResponseIndex
      });
    } else {
      console.log(`${chalk.green('🤖')} ${chalk.green(partialResponse)}`);
      
      // Add to conversation history
      const lastEntry = this.conversationHistory[this.conversationHistory.length - 1];
      if (lastEntry && lastEntry.type === 'assistant' && lastEntry.interactionId === interactionCount) {
        // Append to existing assistant message
        lastEntry.message += partialResponse;
      } else {
        // New assistant message
        this.conversationHistory.push({
          type: 'assistant',
          message: partialResponse,
          timestamp: timestamp,
          interactionId: interactionCount,
          partialIndex: partialResponseIndex
        });
      }
    }

    // Generate TTS (which will just log for mock service)
    this.ttsService.generate(gptReply, interactionCount);
  }

  /**
   * Check if a message is a function call
   * @param {string} message - Message to check
   * @returns {boolean} True if message appears to be a function call
   */
  isFunctionCallMessage(message) {
    const functionMessages = [
      "I don't know if he can answer, but let's try calling him.",
      "Let me check what's happening in the news today.",
      "Okay, it was nice talking with you. Take care!"
    ];
    return functionMessages.includes(message);
  }

  /**
   * Update session token usage
   * @param {Object} usage - Token usage data from OpenAI
   */
  updateTokenUsage(usage) {
    if (!usage) return;
    
    this.sessionTokens.prompt += usage.prompt_tokens || 0;
    this.sessionTokens.completion += usage.completion_tokens || 0;
    this.sessionTokens.total += usage.total_tokens || 0;
  }

  /**
   * Display token usage statistics
   * @param {Object} turnUsage - Usage for current turn
   */
  displayTokenUsage(turnUsage) {
    if (!turnUsage) return;

    const contextSize = this.gptService.userContext.length;
    const maxContext = 128000; // GPT-4 context limit
    const contextPercent = ((contextSize / maxContext) * 100).toFixed(1);

    console.log(chalk.white.bold('\n📈 Token Usage:'));
    console.log(chalk.white(`   ├─ This Turn: ${turnUsage.prompt_tokens || 0} prompt + ${turnUsage.completion_tokens || 0} completion = ${turnUsage.total_tokens || 0} total`));
    console.log(chalk.white(`   ├─ Session Total: ${this.sessionTokens.total} tokens`));
    console.log(chalk.white(`   └─ Context: ${contextSize} messages / ${maxContext} (${contextPercent}%)`));
  }

  /**
   * Handle CLI commands
   * @param {string} command - Command to execute
   */
  handleCommand(command) {
    const cmd = command.toLowerCase().split(' ')[0];
    
    switch (cmd) {
      case '/help':
        this.showHelp();
        break;
      case '/stats':
        this.showStats();
        break;
      case '/context':
        this.showContext();
        break;
      case '/debug':
        this.toggleDebugMode();
        break;
      case '/reset':
        this.resetSession();
        break;
      case '/exit':
        this.endSession();
        break;
      default:
        console.log(chalk.red(`❓ Unknown command: ${command}`));
        console.log(chalk.gray('Type /help for available commands'));
    }
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log(chalk.blue.bold('\n💡 Available Commands:'));
    console.log(chalk.blue('   /help     - Show this help message'));
    console.log(chalk.blue('   /stats    - Show session statistics'));
    console.log(chalk.blue('   /context  - Show conversation context'));
    console.log(chalk.blue('   /debug    - Toggle debug mode (show/hide mock service logs)'));
    console.log(chalk.blue('   /reset    - Reset the conversation'));
    console.log(chalk.blue('   /exit     - End the chat session'));
    console.log(chalk.gray('\n💬 Just type your message to chat with Jessica!'));
  }

  /**
   * Show session statistics
   */
  showStats() {
    const duration = Math.floor((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    
    console.log(chalk.blue.bold('\n📊 Session Statistics:'));
    console.log(chalk.blue(`   ├─ Messages: ${this.messageCount}`));
    console.log(chalk.blue(`   ├─ Duration: ${minutes}m ${seconds}s`));
    console.log(chalk.blue(`   ├─ Total Tokens: ${this.sessionTokens.total}`));
    console.log(chalk.blue(`   ├─ Prompt Tokens: ${this.sessionTokens.prompt}`));
    console.log(chalk.blue(`   ├─ Completion Tokens: ${this.sessionTokens.completion}`));
    console.log(chalk.blue(`   └─ Context Size: ${this.gptService.userContext.length} messages`));
  }

  /**
   * Show conversation context
   */
  showContext() {
    console.log(chalk.blue.bold('\n📝 Conversation Context:'));
    
    this.gptService.userContext.forEach((msg, index) => {
      const role = msg.role;
      const content = msg.content?.substring(0, 100) + (msg.content?.length > 100 ? '...' : '');
      
      let roleColor = chalk.white;
      let prefix = '├─';
      
      if (role === 'system') {
        roleColor = chalk.gray;
        prefix = '🔧';
      } else if (role === 'user') {
        roleColor = chalk.cyan;
        prefix = '🗣️';
      } else if (role === 'assistant') {
        roleColor = chalk.green;
        prefix = '🤖';
      } else if (role === 'function') {
        roleColor = chalk.yellow;
        prefix = '⚙️';
      }
      
      console.log(`   ${prefix} ${roleColor(role)}: ${content}`);
    });
  }

  /**
   * Toggle debug mode for mock service logging
   */
  toggleDebugMode() {
    this.debugMode = !this.debugMode;
    
    // Update all services
    this.streamService.debugMode = this.debugMode;
    this.transcriptionService.debugMode = this.debugMode;
    this.ttsService.debugMode = this.debugMode;
    
    const status = this.debugMode ? 'ON' : 'OFF';
    const color = this.debugMode ? chalk.green : chalk.gray;
    console.log(color.bold(`\n🔍 Debug Mode: ${status}`));
    
    if (this.debugMode) {
      console.log(chalk.gray('Mock service logs will now be displayed'));
      console.log(chalk.blue.bold('\n📊 Current Debug Information:'));
      console.log(chalk.blue(`   ├─ Active: ${this.isActive}`));
      console.log(chalk.blue(`   ├─ Message Count: ${this.messageCount}`));
      console.log(chalk.blue(`   ├─ History Length: ${this.conversationHistory.length}`));
      console.log(chalk.blue(`   ├─ GPT Context Length: ${this.gptService.userContext.length}`));
      console.log(chalk.blue(`   ├─ TTS Buffer Length: ${Object.keys(this.ttsService.speechBuffer).length}`));
      console.log(chalk.blue(`   └─ Stream Buffer Length: ${Object.keys(this.streamService.audioBuffer).length}`));
    } else {
      console.log(chalk.gray('Mock service logs are now hidden'));
    }
  }

  /**
   * Reset the session
   */
  resetSession() {
    console.log(chalk.yellow('🔄 Resetting session...'));
    
    // Reset counters
    this.messageCount = 0;
    this.sessionTokens = { total: 0, prompt: 0, completion: 0 };
    this.conversationHistory = [];
    this.startTime = Date.now();
    
    // Reset services
    this.ttsService.reset();
    this.streamService.clear();
    
    // Reset GPT context (keeping system message and initial greeting)
    const systemMessage = this.gptService.userContext[0];
    const initialGreeting = this.gptService.userContext[1];
    this.gptService.userContext = [systemMessage, initialGreeting];
    this.gptService.partialResponseIndex = 0;
    
    console.log(chalk.green('✅ Session reset complete'));
    console.log(chalk.green('🤖 Hi Francine! How are you doing today?'));
  }

  /**
   * End the chat session
   */
  endSession() {
    console.log(chalk.yellow('\n👋 Ending chat session...'));
    
    this.isActive = false;
    
    // Close services
    this.transcriptionService.close();
    this.ttsService.close();
    this.streamService.close();
    
    // Show final stats
    this.showStats();
    
    console.log(chalk.green('\n✅ Chat session ended. Goodbye!'));
    this.emit('sessionEnded');
  }
}

module.exports = { ChatSession };