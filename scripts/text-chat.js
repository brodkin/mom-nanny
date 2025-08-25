#!/usr/bin/env node

/**
 * Text-based Conversation Testing CLI Tool
 * Interactive interface for testing the mom-nanny voice assistant
 */

require('dotenv').config();
require('colors');
const chalk = require('chalk');
const readline = require('readline');
const { ChatSession } = require('../services/chat-session');

class TextChatCLI {
  constructor() {
    this.chatSession = null;
    this.rl = null;
    this.isRunning = false;
  }

  /**
   * Initialize and start the CLI
   */
  async start() {
    console.clear();
    this.showWelcome();
    
    // Check environment
    if (!this.checkEnvironment()) {
      process.exit(1);
    }

    // Initialize readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('You: ')
    });

    // Initialize chat session and wait for it to complete
    this.chatSession = new ChatSession();
    await this.chatSession.initializeAsync();
    
    this.setupEventHandlers();
    
    this.isRunning = true;
    this.showInitialGreeting();
    this.rl.prompt();
  }

  /**
   * Show welcome banner
   */
  showWelcome() {
    console.log(chalk.blue.bold('┌─────────────────────────────────────────────────────────────┐'));
    console.log(chalk.blue.bold('│                    🤖 Mom-Nanny Chat CLI                    │'));
    console.log(chalk.blue.bold('│                Text-based Testing Interface                │'));
    console.log(chalk.blue.bold('└─────────────────────────────────────────────────────────────┘'));
    console.log();
    console.log(chalk.gray('This tool lets you test conversations with Jessica,'));
    console.log(chalk.gray('the AI assistant designed to help Francine.'));
    console.log();
  }

  /**
   * Check required environment variables
   */
  checkEnvironment() {
    const required = ['OPENAI_API_KEY'];
    const missing = [];

    for (const envVar of required) {
      if (!process.env[envVar]) {
        missing.push(envVar);
      }
    }

    if (missing.length > 0) {
      console.log(chalk.red.bold('❌ Missing required environment variables:'));
      missing.forEach(envVar => {
        console.log(chalk.red(`   - ${envVar}`));
      });
      console.log();
      console.log(chalk.yellow('Please set these variables in your .env file'));
      return false;
    }

    console.log(chalk.green('✅ Environment variables configured'));
    return true;
  }

  /**
   * Show initial AI greeting with TwiML delay information
   * Shows what the delay would be in production without actually waiting
   */
  showInitialGreeting() {
    // Get call frequency stats to show what delay would occur in production
    const callStats = this.chatSession.gptService.getCallStats();
    const callsToday = callStats?.callsToday || 1;
    const delayMs = Math.max(3000, callsToday * 3000); // Minimum 3s, 3s per call

    console.log(chalk.magenta(`⏱️  TwiML delay would be: ${delayMs/1000}s (call #${callsToday} today)`));
    console.log(chalk.green('🤖 Hi Francine! How are you doing today?'));
    console.log();
    console.log(chalk.gray('💡 Tip: Type /help for commands, or just start chatting!'));
    console.log();
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Handle user input
    this.rl.on('line', async (input) => {
      const trimmedInput = input.trim();
      
      if (!trimmedInput) {
        this.rl.prompt();
        return;
      }

      // Process user input through chat session
      await this.chatSession.processUserInput(trimmedInput);
      
      // Don't show prompt immediately - let GPT response complete first
    });

    // Handle Ctrl+C
    this.rl.on('SIGINT', () => {
      this.gracefulExit();
    });

    // Handle session end
    this.chatSession.on('sessionEnded', () => {
      this.isRunning = false;
      this.rl.close();
      process.exit(0);
    });

    // Handle response complete - show prompt again
    this.chatSession.on('responseComplete', () => {
      if (this.isRunning) {
        console.log(); // Add some spacing
        this.rl.prompt();
      }
    });

    // Handle readline close
    this.rl.on('close', () => {
      if (this.isRunning) {
        this.gracefulExit();
      }
    });
  }

  /**
   * Handle graceful exit
   */
  gracefulExit() {
    if (!this.isRunning) return;
    
    console.log();
    console.log(chalk.yellow('🔄 Shutting down...'));
    
    this.isRunning = false;
    
    if (this.chatSession) {
      this.chatSession.endSession();
    }
    
    setTimeout(() => {
      console.log(chalk.green('👋 Goodbye!'));
      process.exit(0);
    }, 500);
  }
}

// Handle uncaught exceptions gracefully
process.on('uncaughtException', (error) => {
  console.log();
  
  // Safely use chalk with fallback to plain console
  try {
    console.log(chalk.red.bold('❌ Fatal Error:'));
    console.log(chalk.red(error.message));
    console.log();
    console.log(chalk.gray('Please check your environment configuration and try again.'));
  } catch (chalkError) {
    // Fallback to plain console if chalk fails
    console.log('❌ Fatal Error:');
    console.log(error.message);
    console.log();
    console.log('Please check your environment configuration and try again.');
  }
  
  process.exit(1);
});

process.on('unhandledRejection', (reason, _promise) => {
  console.log();
  
  // Safely use chalk with fallback to plain console
  try {
    console.log(chalk.red.bold('❌ Unhandled Promise Rejection:'));
    console.log(chalk.red(reason));
    console.log();
    console.log(chalk.gray('Please check your API keys and network connection.'));
  } catch (chalkError) {
    // Fallback to plain console if chalk fails
    console.log('❌ Unhandled Promise Rejection:');
    console.log(reason);
    console.log();
    console.log('Please check your API keys and network connection.');
  }
  
  process.exit(1);
});

// Show usage information if --help flag is provided
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log();
  console.log(chalk.blue.bold('Mom-Nanny Text Chat CLI'));
  console.log();
  console.log(chalk.white('Usage:'));
  console.log(chalk.gray('  npm run chat'));
  console.log(chalk.gray('  node scripts/text-chat.js'));
  console.log();
  console.log(chalk.white('Interactive Commands:'));
  console.log(chalk.gray('  /help     - Show help information'));
  console.log(chalk.gray('  /stats    - Show session statistics'));
  console.log(chalk.gray('  /context  - Show conversation context'));
  console.log(chalk.gray('  /debug    - Show debug information'));
  console.log(chalk.gray('  /reset    - Reset the conversation'));
  console.log(chalk.gray('  /exit     - End the session'));
  console.log();
  console.log(chalk.white('Features:'));
  console.log(chalk.gray('  • Real-time conversation with AI assistant'));
  console.log(chalk.gray('  • Token usage tracking and statistics'));
  console.log(chalk.gray('  • Function call visualization'));
  console.log(chalk.gray('  • Context size monitoring'));
  console.log(chalk.gray('  • Color-coded message types'));
  console.log();
  console.log(chalk.white('Environment Variables Required:'));
  console.log(chalk.gray('  OPENAI_API_KEY     - Your OpenAI API key'));
  console.log();
  process.exit(0);
}

// Start the CLI
const cli = new TextChatCLI();
cli.start().catch((error) => {
  console.log();
  
  // Safely use chalk with fallback to plain console
  try {
    console.log(chalk.red.bold('❌ Failed to start CLI:'));
    console.log(chalk.red(error.message));
  } catch (chalkError) {
    // Fallback to plain console if chalk fails
    console.log('❌ Failed to start CLI:');
    console.log(error.message);
  }
  
  process.exit(1);
});