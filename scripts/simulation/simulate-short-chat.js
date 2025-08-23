#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Change to the worktree directory
process.chdir(path.join(__dirname));

console.log('🧪 Starting SHORT chat test (< 30 seconds)...\n');

// Start the chat process
const chat = spawn('npm', ['run', 'chat'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'development' }
});

let outputBuffer = '';

// Capture all output
chat.stdout.on('data', (data) => {
  const output = data.toString();
  outputBuffer += output;
  process.stdout.write(output);
});

chat.stderr.on('data', (data) => {
  const output = data.toString();
  outputBuffer += output;
  process.stderr.write(data);
});

// Short conversation script (< 30 seconds)
const conversation = [
  { message: "Hello", delay: 1000 },
  { message: "How are you?", delay: 2000 },
  { message: "/exit", delay: 2000 }
];

let messageIndex = 0;

// Send messages with delays
function sendNextMessage() {
  if (messageIndex < conversation.length) {
    const { message, delay } = conversation[messageIndex];
    
    console.log(`\n📝 Sending: "${message}"`);
    chat.stdin.write(message + '\n');
    messageIndex++;
    
    // Schedule next message after delay
    setTimeout(sendNextMessage, delay);
  }
}

// Wait for chat to initialize, then start conversation
setTimeout(() => {
  console.log('\n🎭 Starting SHORT conversation (should be < 30 seconds)...\n');
  sendNextMessage();
}, 2000);

// Handle exit
chat.on('close', (code) => {
  console.log(`\n✅ Chat process ended with code ${code}`);
  
  // Check if emotional analysis was skipped
  if (outputBuffer.includes('Skipping emotional analysis')) {
    console.log('✅ Correctly skipped emotional analysis for short conversation');
  } else if (outputBuffer.includes('Analyzing emotional state')) {
    console.log('❌ ERROR: Emotional analysis ran for short conversation!');
  } else {
    console.log('⚠️ Could not determine if emotional analysis was skipped');
  }
  
  // Check the database
  setTimeout(() => {
    console.log('\n📊 Checking database...\n');
    
    const checkDb = spawn('node', ['-e', `
      const DatabaseManager = require('${path.join(__dirname, '../../services/database-manager')}');
      const dbManager = DatabaseManager.getInstance();
      
      (async () => {
        await dbManager.waitForInitialization();
        
        // Get the most recent conversation
        const recentConv = await dbManager.get(
          "SELECT * FROM conversations WHERE call_sid LIKE 'CHAT_%' ORDER BY id DESC LIMIT 1"
        );
        
        if (recentConv) {
          console.log('📌 Most recent chat conversation:');
          console.log('   ID:', recentConv.id);
          console.log('   Call SID:', recentConv.call_sid);
          console.log('   Duration:', recentConv.duration, 'seconds');
          
          if (recentConv.duration < 30) {
            console.log('   ✅ Duration < 30 seconds (as expected)');
          } else {
            console.log('   ❌ Duration >= 30 seconds (unexpected!)');
          }
          
          // Check for emotional metrics
          const metrics = await dbManager.get(
            'SELECT * FROM emotional_metrics WHERE conversation_id = ?',
            [recentConv.id]
          );
          
          if (metrics) {
            console.log('\\n❌ ERROR: Emotional metrics found for short conversation!');
          } else {
            console.log('\\n✅ No emotional metrics (correct for < 30s session)');
          }
        } else {
          console.log('❌ No chat conversations found');
        }
        
        process.exit(0);
      })();
    `], { 
      cwd: path.join(__dirname, '../..'),
      env: { ...process.env, SQLITE_DB_PATH: './storage/conversation-summaries.db' }
    });
    
    checkDb.stdout.on('data', (data) => process.stdout.write(data));
    checkDb.stderr.on('data', (data) => process.stderr.write(data));
  }, 2000);
});