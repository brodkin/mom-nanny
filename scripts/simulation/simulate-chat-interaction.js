#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Change to the worktree directory
process.chdir(path.join(__dirname));

console.log('🧪 Starting automated chat test with emotional content...\n');

// Start the chat process
const chat = spawn('npm', ['run', 'chat'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'development' }
});

let outputBuffer = '';

// Capture output
chat.stdout.on('data', (data) => {
  const output = data.toString();
  outputBuffer += output;
  process.stdout.write(output);
});

chat.stderr.on('data', (data) => {
  process.stderr.write(data);
});

// Conversation script with emotional content
const conversation = [
  { message: "I can't find my medication and I'm really scared", delay: 3000 },
  { message: "What if something bad happens to me?", delay: 5000 },
  { message: "I think I might be dying, my chest feels tight", delay: 4000 },
  { message: "Where is my husband? He usually helps me", delay: 4000 },
  { message: "I'm so confused about everything", delay: 3000 },
  { message: "Maybe I should call for help", delay: 3000 },
  { message: "/exit", delay: 2000 }
];

let messageIndex = 0;

// Send messages with delays
function sendNextMessage() {
  if (messageIndex < conversation.length) {
    const { message, delay } = conversation[messageIndex];
    
    setTimeout(() => {
      console.log(`\n📝 Sending: "${message}"`);
      chat.stdin.write(message + '\n');
      messageIndex++;
      
      // Schedule next message
      setTimeout(sendNextMessage, delay);
    }, delay);
  }
}

// Wait for chat to initialize, then start conversation
setTimeout(() => {
  console.log('\n🎭 Starting conversation with emotional content...\n');
  sendNextMessage();
}, 2000);

// Handle exit
chat.on('close', (code) => {
  console.log(`\n✅ Chat process ended with code ${code}`);
  
  // Now check the database for the saved conversation
  setTimeout(() => {
    console.log('\n📊 Checking database for saved conversation...\n');
    
    const checkDb = spawn('node', ['-e', `
      const DatabaseManager = require('./services/database-manager');
      const dbManager = DatabaseManager.getInstance();
      
      (async () => {
        await dbManager.waitForInitialization();
        
        // Get the most recent conversation
        const recentConv = await dbManager.get(
          'SELECT * FROM conversations ORDER BY id DESC LIMIT 1'
        );
        
        if (recentConv) {
          console.log('📌 Most recent conversation:');
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
            console.log('\\n✅ Emotional metrics found:');
            console.log('   Anxiety Level:', metrics.anxiety_level);
            console.log('   Confusion Level:', metrics.confusion_level);
            console.log('   Agitation Level:', metrics.agitation_level);
            console.log('   Overall Sentiment:', metrics.overall_sentiment);
          } else {
            console.log('\\n⚠️  No emotional metrics found for this conversation');
          }
          
          // Check for messages
          const messageCount = await dbManager.get(
            'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?',
            [recentConv.id]
          );
          
          console.log('\\n📝 Messages saved:', messageCount.count);
          
        } else {
          console.log('❌ No conversations found in database');
        }
        
        process.exit(0);
      })();
    `], { cwd: __dirname });
    
    checkDb.stdout.on('data', (data) => process.stdout.write(data));
    checkDb.stderr.on('data', (data) => process.stderr.write(data));
  }, 2000);
});