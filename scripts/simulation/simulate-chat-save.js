#!/usr/bin/env node

const { ChatSession } = require('./services/chat-session');
const DatabaseManager = require('./services/database-manager');

async function testChatSave() {
  console.log('🧪 Testing chat session save functionality...\n');
  
  // Create a chat session
  const session = new ChatSession();
  
  console.log('📌 Chat session created:');
  console.log('   Call SID:', session.callSid);
  console.log('   Start time:', new Date(session.conversationAnalyzer.startTime).toISOString());
  
  // Simulate some conversation
  console.log('\n📝 Simulating conversation...');
  
  // Track user utterance
  session.conversationAnalyzer.trackUserUtterance('Hello, I need help', new Date());
  
  // Track assistant response
  session.conversationAnalyzer.trackAssistantResponse('Hello! How can I help you today?', new Date());
  
  // Track another exchange
  session.conversationAnalyzer.trackUserUtterance('I feel anxious', new Date());
  session.conversationAnalyzer.trackAssistantResponse('I understand you are feeling anxious. Would you like to talk about it?', new Date());
  
  // Wait 3 seconds to ensure duration > 2 seconds
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('   Added', session.conversationAnalyzer.userUtterances.length, 'user utterances');
  console.log('   Added', session.conversationAnalyzer.assistantResponses.length, 'assistant responses');
  
  // End the session
  console.log('\n🏁 Ending session...');
  await session.endSession();
  
  // Wait for async operations to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Check the database
  console.log('\n📊 Checking database...');
  const dbManager = DatabaseManager.getInstance();
  await dbManager.waitForInitialization();
  
  // Look for chat conversations
  const chatConversations = await dbManager.all(
    'SELECT * FROM conversations WHERE call_sid LIKE \'CHAT_%\' ORDER BY id DESC LIMIT 5'
  );
  
  console.log('\n📌 Chat conversations in database:');
  if (chatConversations.length === 0) {
    console.log('   ❌ No chat conversations found');
  } else {
    chatConversations.forEach(conv => {
      console.log(`   ID: ${conv.id}`);
      console.log(`   Call SID: ${conv.call_sid}`);
      console.log(`   Duration: ${conv.duration} seconds`);
      console.log(`   Created: ${conv.created_at}`);
      console.log('   ---');
    });
  }
  
  // Look for our specific session
  const ourSession = await dbManager.get(
    'SELECT * FROM conversations WHERE call_sid = ?',
    [session.callSid]
  );
  
  if (ourSession) {
    console.log('\n✅ Our test session was saved!');
    console.log('   Database ID:', ourSession.id);
    
    // Check for messages
    const messages = await dbManager.all(
      'SELECT * FROM messages WHERE conversation_id = ?',
      [ourSession.id]
    );
    console.log('   Messages saved:', messages.length);
    
    // Check for emotional metrics
    const metrics = await dbManager.get(
      'SELECT * FROM emotional_metrics WHERE conversation_id = ?',
      [ourSession.id]
    );
    
    if (metrics) {
      console.log('   ✅ Emotional metrics found (but shouldn\'t be for < 30s session)');
    } else {
      console.log('   ✅ No emotional metrics (correct for < 30s session)');
    }
  } else {
    console.log('\n❌ Our test session was NOT saved!');
    console.log('   Looking for Call SID:', session.callSid);
  }
  
  process.exit(0);
}

testChatSave().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});