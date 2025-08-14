require('colors');
const chalk = require('chalk');
const EventEmitter = require('events');
const { GptService } = require('./gpt-service');
const { TranscriptionService } = require('./mock-transcription-service');
const { TextToSpeechService } = require('./mock-tts-service');
const { StreamService } = require('./mock-stream-service');
const ConversationAnalyzer = require('./conversation-analyzer');
const SqliteStorageService = require('./sqlite-storage-service');
const DatabaseManager = require('./database-manager');
const SummaryGenerator = require('./summary-generator');

/**
 * Chat Session Manager for text-based conversation testing
 * Integrates all mock services and tracks conversation state with usage analytics
 */
class ChatSession extends EventEmitter {
  constructor(debugMode = false) {
    super();
    
    // Debug mode flag
    this.debugMode = debugMode;
    
    // Generate a simulated call SID for the chat session
    this.callSid = `CHAT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize SQLite storage (following app.js pattern)
    const dbPath = process.env.SQLITE_DB_PATH || './conversation-summaries.db';
    this.databaseManager = new DatabaseManager(dbPath);
    this.storageService = new SqliteStorageService(this.databaseManager);
    this.summaryGenerator = new SummaryGenerator();
    
    // Initialize conversation analyzer (following app.js pattern)
    this.conversationAnalyzer = new ConversationAnalyzer(this.callSid, new Date());
    
    // Initialize services with debug mode
    this.streamService = new StreamService(this.debugMode);
    this.transcriptionService = new TranscriptionService(this.debugMode);
    this.ttsService = new TextToSpeechService(this.debugMode);
    this.gptService = new GptService(null); // No mark completion service needed for text chat
    
    // Set the conversation analyzer in GPT service (following app.js pattern)
    this.gptService.setCallSid(this.callSid);
    this.gptService.setConversationAnalyzer(this.conversationAnalyzer);
    
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
    this.loadingInterval = null;
    this.firstResponseReceived = false;
    this.lastUsage = null;
    
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
      await this.handleCommand(trimmedText);
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
    const fullTimestamp = new Date(); // Use full Date object for conversation analyzer
    
    // Track user utterance in analyzer
    if (this.conversationAnalyzer) {
      this.conversationAnalyzer.trackUserUtterance(message, fullTimestamp);
    }
    
    // Add to conversation history
    this.conversationHistory.push({
      type: 'user',
      message: message,
      timestamp: timestamp,
      messageId: this.messageCount
    });

    // User message already displayed by readline prompt, no need to repeat

    try {
      // Reset flag for new response
      this.firstResponseReceived = false;
      
      // Show loading animation
      this.showLoadingAnimation();
      
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
        // Store usage for display with response
        this.lastUsage = result.usage;
      }
    } catch (error) {
      console.log(chalk.red(`❌ Error processing message: ${error.message}`));
    }
  }

  /**
   * Show loading animation while waiting for GPT response
   */
  showLoadingAnimation() {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let frameIndex = 0;
    
    process.stdout.write('\n🤖 ');
    this.loadingInterval = setInterval(() => {
      process.stdout.write(`\r🤖 ${chalk.gray(frames[frameIndex])} Thinking...`);
      frameIndex = (frameIndex + 1) % frames.length;
    }, 80);
  }

  /**
   * Stop loading animation
   */
  stopLoadingAnimation() {
    if (this.loadingInterval) {
      clearInterval(this.loadingInterval);
      this.loadingInterval = null;
      // Clear the loading line completely
      process.stdout.write('\r\x1b[K');
    }
  }

  /**
   * Handle GPT reply events
   * @param {Object} gptReply - GPT reply data
   * @param {number} interactionCount - Current interaction number
   */
  handleGptReply(gptReply, interactionCount) {
    const { partialResponseIndex, partialResponse, isFinal } = gptReply;
    
    if (!partialResponse) return;

    // Stop loading animation on first response
    if (!this.firstResponseReceived) {
      this.stopLoadingAnimation();
      this.firstResponseReceived = true;
    }

    const timestamp = new Date().toLocaleTimeString();
    const fullTimestamp = new Date(); // Use full Date object for conversation analyzer

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
      
      // Track assistant response in analyzer
      if (this.conversationAnalyzer) {
        this.conversationAnalyzer.trackAssistantResponse(partialResponse, fullTimestamp);
      }
      
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
    
    // If this is the final response, show stats and emit event to show prompt again
    if (isFinal) {
      // Show compact stats after final response
      if (this.lastUsage) {
        const statsString = this.getStatsString(this.lastUsage);
        if (statsString) {
          console.log(`\n${statsString.trim()}`);
        }
      }
      this.emit('responseComplete');
    }
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
   * Get stats string for message display
   * @param {Object} turnUsage - Usage for current turn
   * @returns {string} Compact stats string
   */
  getStatsString(turnUsage = null) {
    if (!this.debugMode && turnUsage) {
      const contextSize = this.gptService.userContext.length;
      const maxContext = 128000; // GPT-4 context limit
      const contextPercent = ((contextSize / maxContext) * 100).toFixed(0);
      return chalk.gray(`[${turnUsage.total_tokens || 0}/${contextPercent}%] `);
    }
    return '';
  }

  /**
   * Display token usage statistics (legacy method for debug mode)
   * @param {Object} turnUsage - Usage for current turn
   */
  displayTokenUsage(turnUsage) {
    if (!turnUsage) return;

    if (this.debugMode) {
      const contextSize = this.gptService.userContext.length;
      const maxContext = 128000; // GPT-4 context limit
      const contextPercent = ((contextSize / maxContext) * 100).toFixed(1);

      // Full debug stats
      console.log(chalk.gray(`\n[${turnUsage.total_tokens || 0} tokens (${turnUsage.prompt_tokens || 0}p+${turnUsage.completion_tokens || 0}c) | ${contextSize} msgs | ${contextPercent}% context]`));
    }
    // In non-debug mode, stats are shown inline with messages
  }

  /**
   * Handle CLI commands
   * @param {string} command - Command to execute
   */
  async handleCommand(command) {
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
      case '/storage':
        await this.showStoredSummaries();
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
    console.log(chalk.blue('   /storage  - Show recent stored conversation summaries'));
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
   * Show recent stored conversation summaries
   */
  async showStoredSummaries() {
    console.log(chalk.blue.bold('\n📚 Recent Conversation Summaries:'));
    
    try {
      // Get recent summaries from SQLite
      const recentSummaries = await this.storageService.getRecentSummaries(5);
      
      if (!recentSummaries || recentSummaries.length === 0) {
        console.log(chalk.gray('   No stored summaries found'));
        return;
      }
      
      recentSummaries.forEach((summary, index) => {
        console.log(chalk.cyan(`\n   ${index + 1}. ${summary.call_sid.startsWith('CHAT_') ? '💬 Chat Session' : '📞 Phone Call'}`));
        console.log(chalk.white(`      Call ID: ${summary.call_sid}`));
        console.log(chalk.gray(`      Time: ${new Date(summary.start_time).toLocaleString()}`));
        console.log(chalk.gray(`      Duration: ${summary.duration ? `${Math.round(summary.duration)}s` : 'N/A'}`));
        
        // Parse and display summary highlights
        if (summary.summary_text) {
          try {
            const summaryData = JSON.parse(summary.summary_text);
            
            // Display mental state indicators
            if (summaryData.mentalStateIndicators) {
              console.log(chalk.yellow(`      Mental State:`));
              console.log(chalk.gray(`        - Anxiety Level: ${summaryData.mentalStateIndicators.anxietyLevel || 0}`));
              console.log(chalk.gray(`        - Agitation: ${summaryData.mentalStateIndicators.agitationLevel || 0}`));
              console.log(chalk.gray(`        - Confusion Events: ${summaryData.mentalStateIndicators.confusionCount || 0}`));
            }
            
            // Display conversation metrics
            if (summaryData.conversationMetrics) {
              console.log(chalk.yellow(`      Conversation Metrics:`));
              console.log(chalk.gray(`        - Total Interactions: ${summaryData.conversationMetrics.totalInteractions || 0}`));
              console.log(chalk.gray(`        - User Utterances: ${summaryData.conversationMetrics.userUtterances || 0}`));
              console.log(chalk.gray(`        - Repetitions: ${summaryData.conversationMetrics.repetitionCount || 0}`));
            }
            
            // Display care indicators
            if (summaryData.careIndicators) {
              const hasIndicators = summaryData.careIndicators.medicationMentions > 0 || 
                                   summaryData.careIndicators.painComplaints > 0 ||
                                   summaryData.careIndicators.staffComplaints > 0;
              if (hasIndicators) {
                console.log(chalk.yellow(`      Care Indicators:`));
                if (summaryData.careIndicators.medicationMentions > 0) {
                  console.log(chalk.gray(`        - Medication Mentions: ${summaryData.careIndicators.medicationMentions}`));
                }
                if (summaryData.careIndicators.painComplaints > 0) {
                  console.log(chalk.gray(`        - Pain Complaints: ${summaryData.careIndicators.painComplaints}`));
                }
                if (summaryData.careIndicators.staffComplaints > 0) {
                  console.log(chalk.gray(`        - Staff Complaints: ${summaryData.careIndicators.staffComplaints}`));
                }
              }
            }
            
            // Display caregiver insights if present
            if (summaryData.caregiverInsights && summaryData.caregiverInsights.length > 0) {
              console.log(chalk.yellow(`      Key Insights:`));
              summaryData.caregiverInsights.slice(0, 2).forEach(insight => {
                console.log(chalk.gray(`        • ${insight}`));
              });
            }
            
          } catch (e) {
            // If summary_text isn't properly formatted, show what we can
            console.log(chalk.gray(`      Note: Summary data format unrecognized`));
          }
        } else {
          console.log(chalk.gray(`      No summary data available`));
        }
      });
      
      // Only show database path in debug mode
      if (this.debugMode) {
        console.log(chalk.gray(`\n   Database: ${process.env.SQLITE_DB_PATH || './conversation-summaries.db'}`));
      }
    } catch (error) {
      console.error(chalk.red('❌ Error loading summaries:'), error.message);
    }
  }

  /**
   * End the chat session
   */
  async endSession() {
    console.log(chalk.yellow('\n👋 Ending chat session...'));
    
    this.isActive = false;
    
    // Generate and save conversation summary and messages (following app.js pattern)
    if (this.conversationAnalyzer) {
      try {
        this.conversationAnalyzer.endTime = new Date();
        const summary = this.summaryGenerator.generateSummary(this.conversationAnalyzer);
        
        const result = await this.storageService.saveSummary(summary);
        const conversationId = result.conversationId; // String conversation ID
        const numericId = result.numericId; // Numeric ID for messages
        
        console.log(chalk.green(`\n📝 Conversation summary saved to SQLite database`));
        console.log(chalk.gray(`   Call SID: ${this.callSid}`));
        console.log(chalk.gray(`   Database: ${process.env.SQLITE_DB_PATH || './conversation-summaries.db'}`));
        
        // Extract and save conversation messages
        const messages = [];
        
        // Add user utterances
        this.conversationAnalyzer.userUtterances.forEach(utterance => {
          messages.push({
            role: 'user',
            content: utterance.text,
            timestamp: utterance.timestamp.toISOString()
          });
        });
        
        // Add assistant responses
        this.conversationAnalyzer.assistantResponses.forEach(response => {
          messages.push({
            role: 'assistant',
            content: response.text,
            timestamp: response.timestamp.toISOString()
          });
        });
        
        // Sort messages by timestamp
        messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Save messages to database
        if (messages.length > 0) {
          await this.storageService.saveMessages(numericId, messages);
          console.log(chalk.green(`💬 ${messages.length} conversation messages saved to database`));
        }
        
      } catch (error) {
        console.error(chalk.red('❌ Error saving conversation summary or messages:'), error);
      }
    }
    
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