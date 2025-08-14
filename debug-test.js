#!/usr/bin/env node

const readline = require('readline');

console.log('Creating readline interface...');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'Test: '
});

console.log('Setting up event handlers...');

// Handle SIGINT
rl.on('SIGINT', () => {
  console.log('\nReceived SIGINT - simulating graceful exit');
  rl.close();
  process.exit(0);
});

// Handle line input
rl.on('line', (input) => {
  console.log(`You said: ${input}`);
  rl.prompt();
});

// Handle close
rl.on('close', () => {
  console.log('Readline closed');
});

console.log('Starting prompt...');
console.log('Type something or press Ctrl+C to exit');
rl.prompt();

// Keep the process alive
const interval = setInterval(() => {
  // Just keep the event loop alive
}, 1000);

// Clean up interval on exit
process.on('exit', () => {
  clearInterval(interval);
});