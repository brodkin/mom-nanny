#!/usr/bin/env node

require('dotenv').config();
require('colors');
const chalk = require('chalk');
const readline = require('readline');
const { ChatSession } = require('./services/chat-session');

class TextChatCLI {
  constructor() {
    this.chatSession = null;
    this.rl = null;
    this.isRunning = false;
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
   * Show welcome banner
   */
  showWelcome() {
    console.log(chalk.blue.bold('┌─────────────────────────────────────────────────────────────┐'));
    console.log(chalk.blue.bold('│                    🤖 Mom-Nanny Chat CLI                    │'));
    console.log(chalk.blue.bold('│                Text-based Testing Interface                │'));
    console.log(chalk.blue.bold('└─────────────────────────────────────────────────────────────┘'));
    console.log();
  }

  /**
   * Show initial AI greeting
   */
  showInitialGreeting() {
    console.log(chalk.green('🤖 Hi Francine! How are you doing today?'));
    console.log();
    console.log(chalk.gray('💡 Tip: Type /help for commands, or just start chatting!'));
    console.log();
  }

  setupEventHandlers() {
    console.log('Setting up event handlers...');
    
    // Handle user input
    this.rl.on('line', async (input) => {
      console.log('Line event received:', input);
      const trimmedInput = input.trim();
      
      if (!trimmedInput) {
        this.rl.prompt();
        return;
      }

      try {
        // Process user input through chat session
        await this.chatSession.processUserInput(trimmedInput);
      } catch (error) {
        console.log('Error in processUserInput:', error.message);
      }
      
      if (this.isRunning) {
        console.log(); // Add some spacing
        this.rl.prompt();
      }
    });

    // Handle Ctrl+C
    this.rl.on('SIGINT', () => {
      console.log('SIGINT received');
      this.gracefulExit();
    });

    // Handle session end
    this.chatSession.on('sessionEnded', () => {
      console.log('SessionEnded event received');
      this.isRunning = false;
      this.rl.close();
      process.exit(0);
    });

    // Handle readline close
    this.rl.on('close', () => {
      console.log('Readline close event received');
      if (this.isRunning) {
        this.gracefulExit();
      }
    });
    
    console.log('Event handlers setup complete');
  }

  gracefulExit() {
    console.log('gracefulExit() called');
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

  async start() {
    console.log('start() method called');
    
    console.log('Clearing console...');
    console.clear();
    
    console.log('Showing welcome...');
    this.showWelcome();
    
    console.log('Checking environment...');
    // Check environment
    if (!this.checkEnvironment()) {
      console.log('Environment check failed - exiting');
      process.exit(1);
    }
    console.log('Environment check passed');

    console.log('Creating readline interface...');
    // Initialize readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('You: ')
    });
    console.log('Readline interface created');

    console.log('Creating ChatSession...');
    // Initialize chat session
    this.chatSession = new ChatSession();
    console.log('ChatSession created');
    
    console.log('Setting up event handlers...');
    this.setupEventHandlers();
    console.log('Event handlers complete');
    
    console.log('Setting isRunning to true...');
    this.isRunning = true;
    
    console.log('Showing initial greeting...');
    this.showInitialGreeting();
    
    console.log('Starting prompt...');
    this.rl.prompt();
    
    console.log('start() method complete');
  }
}

console.log('Script starting...');

// Start the CLI
const cli = new TextChatCLI();
console.log('CLI instance created');

console.log('Calling cli.start()...');
cli.start().catch((error) => {
  console.log();
  console.log('❌ CAUGHT ERROR IN START:');
  console.log('Error message:', error.message);
  console.log('Error stack:', error.stack);
  console.log('Error details:', error);
  
  process.exit(1);
});

console.log('After cli.start() call');