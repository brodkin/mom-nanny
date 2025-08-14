#!/usr/bin/env node

// Quick test of the chat session without full CLI
require('dotenv').config();
const chalk = require('chalk');
const { ChatSession } = require('./services/chat-session');

async function testChat() {
  console.log(chalk.blue.bold('🧪 Testing Chat Session...'));
  
  // Create session without debug mode
  const session = new ChatSession(false);
  console.log(chalk.green('✅ Session created (debug OFF)'));
  
  // Test user input without debug logs
  console.log(chalk.cyan('\n📝 Test 1: Send message with debug OFF'));
  await session.processUserInput('Hello, how are you?');
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Toggle debug mode
  console.log(chalk.cyan('\n📝 Test 2: Toggle debug mode'));
  session.toggleDebugMode();
  
  // Test with debug mode on
  console.log(chalk.cyan('\n📝 Test 3: Send message with debug ON'));
  await session.processUserInput('Where is Ryan?');
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Show stats
  console.log(chalk.cyan('\n📝 Test 4: Show stats'));
  session.showStats();
  
  // Toggle debug off again
  console.log(chalk.cyan('\n📝 Test 5: Toggle debug OFF'));
  session.toggleDebugMode();
  
  // Clean up
  session.endSession();
  console.log(chalk.green('\n✅ All tests completed!'));
}

testChat().catch(err => {
  console.error(chalk.red('❌ Error:'), err.message);
  process.exit(1);
});