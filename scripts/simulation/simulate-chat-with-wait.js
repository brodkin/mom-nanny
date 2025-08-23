#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Change to the worktree directory
process.chdir(path.join(__dirname));

console.log('🧪 Starting chat test with emotional analysis wait...\n');

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

// Conversation script with much longer delays to ensure > 30 seconds
const conversation = [
  { message: 'I\'m really anxious about my medication', delay: 2000 },
  { message: 'I can\'t remember if I took it', delay: 10000 }, // 10s delay
  { message: 'What if I get sick?', delay: 10000 }, // 10s delay  
  { message: 'Where is my husband?', delay: 10000 }, // 10s delay
  { message: '/exit', delay: 5000 } // 5s delay
];

let messageIndex = 0;

// Send messages with delays to ensure > 30 second conversation
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
  console.log('\n🎭 Starting conversation that will last > 30 seconds...\n');
  sendNextMessage();
}, 2000);

// Log timing milestones
setTimeout(() => {
  console.log('\n⏰ 15 seconds elapsed...');
}, 15000);

setTimeout(() => {
  console.log('\n⏰ 30 seconds elapsed - emotional analysis threshold reached...');
}, 30000);

setTimeout(() => {
  console.log('\n⏰ 35 seconds elapsed...');
}, 35000);

// Handle exit
chat.on('close', (code) => {
  console.log(`\n✅ Chat process ended with code ${code}`);
  
  // Wait extra time for async emotional analysis to complete
  console.log('\n⏳ Waiting 5 seconds for emotional analysis to complete...');
  
  setTimeout(() => {
    // Check if emotional analysis message appeared
    if (outputBuffer.includes('Analyzing emotional state')) {
      console.log('✅ Emotional analysis was triggered!');
    } else if (outputBuffer.includes('Skipping emotional analysis')) {
      console.log('⚠️ Emotional analysis was skipped');
    } else {
      console.log('❌ No emotional analysis message found');
    }
    
    // Now check the database
    console.log('\n📊 Checking database for emotional metrics...\n');
    
    const checkDb = spawn('node', ['-e', `
      const DatabaseManager = require('./services/database-manager');
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
          console.log('   Created:', recentConv.created_at);
          
          // Check for emotional metrics
          const metrics = await dbManager.get(
            'SELECT * FROM emotional_metrics WHERE conversation_id = ?',
            [recentConv.id]
          );
          
          if (metrics) {
            console.log('\\n✅ EMOTIONAL METRICS FOUND:');
            console.log('   Anxiety Level:', metrics.anxiety_level);
            console.log('   Confusion Level:', metrics.confusion_level);
            console.log('   Agitation Level:', metrics.agitation_level);
            console.log('   Overall Sentiment:', metrics.overall_sentiment);
            console.log('   Created at:', metrics.created_at);
          } else {
            console.log('\\n❌ No emotional metrics found for this conversation');
            console.log('   This might mean:');
            console.log('   - Conversation was < 30 seconds');
            console.log('   - Emotional analysis failed');
            console.log('   - Async process hasn\\'t completed yet');
          }
          
          // Check for messages
          const messageCount = await dbManager.get(
            'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?',
            [recentConv.id]
          );
          
          console.log('\\n📝 Messages saved:', messageCount.count);
          
        } else {
          console.log('❌ No chat conversations found in database');
          console.log('   Chat sessions should have call_sid starting with CHAT_');
        }
        
        process.exit(0);
      })();
    `], { cwd: __dirname });
    
    checkDb.stdout.on('data', (data) => process.stdout.write(data));
    checkDb.stderr.on('data', (data) => process.stderr.write(data));
  }, 5000); // Wait 5 seconds for async emotional analysis
});