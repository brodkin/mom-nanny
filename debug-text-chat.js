#!/usr/bin/env node

require('dotenv').config();
require('colors');
const chalk = require('chalk');
const readline = require('readline');
const { ChatSession } = require('./services/chat-session');

console.log('Step 1: Clear and welcome');
console.clear();

console.log(chalk.blue.bold('┌─────────────────────────────────────────────────────────────┐'));
console.log(chalk.blue.bold('│                    🤖 Mom-Nanny Chat CLI                    │'));
console.log(chalk.blue.bold('│                Text-based Testing Interface                │'));
console.log(chalk.blue.bold('└─────────────────────────────────────────────────────────────┘'));

console.log('Step 2: Creating readline interface');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: chalk.cyan('You: ')
});

console.log('Step 3: Creating ChatSession');
const chatSession = new ChatSession();

console.log('Step 4: Setting up event handlers');

// Handle user input
rl.on('line', async (input) => {
  console.log('Received input:', input);
  const trimmedInput = input.trim();
  
  if (!trimmedInput) {
    rl.prompt();
    return;
  }

  // Process user input through chat session
  await chatSession.processUserInput(trimmedInput);
  rl.prompt();
});

// Handle Ctrl+C
rl.on('SIGINT', () => {
  console.log('\nReceived SIGINT - shutting down gracefully');
  rl.close();
  process.exit(0);
});

// Handle session end
chatSession.on('sessionEnded', () => {
  console.log('Session ended event received');
  rl.close();
  process.exit(0);
});

// Handle readline close
rl.on('close', () => {
  console.log('Readline close event received');
  process.exit(0);
});

console.log('Step 5: Starting prompt');
console.log(chalk.green('🤖 Hi Francine! How are you doing today?'));
console.log(chalk.gray('💡 Tip: Type /help for commands, or just start chatting!'));
rl.prompt();

console.log('Step 6: Script initialization complete');

// Keep alive
const keepAlive = setInterval(() => {
  // Keep event loop active
}, 10000);