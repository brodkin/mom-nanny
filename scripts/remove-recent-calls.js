#!/usr/bin/env node

/**
 * Script to remove the most recent 25 calls from the database
 * This will remove conversations, their messages, summaries, analytics, and emotional metrics
 */

const DatabaseManager = require('../services/database-manager');

async function removeRecentCalls() {
  // Create a new instance pointing to the storage database
  const dbManager = new DatabaseManager('./storage/conversation-summaries.db');
  
  try {
    await dbManager.waitForInitialization();
    console.log('🔗 Database connection established');
    
    // First, let's see what we're about to delete
    console.log('\n📋 Finding the 25 most recent conversations...');
    
    const recentCalls = await dbManager.all(`
      SELECT id, call_sid, start_time, end_time, duration, created_at
      FROM conversations 
      ORDER BY created_at DESC 
      LIMIT 25
    `);
    
    if (recentCalls.length === 0) {
      console.log('✅ No conversations found in database');
      return;
    }
    
    console.log(`\n📞 Found ${recentCalls.length} conversations to remove:`);
    console.log('─'.repeat(80));
    
    recentCalls.forEach((call, index) => {
      const startTime = new Date(call.start_time).toLocaleString();
      const callType = call.call_sid.startsWith('CHAT_') ? '💬 Chat' : '📞 Call';
      const duration = call.duration ? `${call.duration}s` : 'N/A';
      
      console.log(`${String(index + 1).padStart(2, ' ')}. ${callType} | ${call.call_sid} | ${startTime} | ${duration}`);
    });
    
    // Get the conversation IDs
    const conversationIds = recentCalls.map(call => call.id);
    const placeholders = conversationIds.map(() => '?').join(',');
    
    // Show what related data will be deleted
    console.log('\n🔍 checking related data...');
    
    const messageCount = await dbManager.get(`
      SELECT COUNT(*) as count 
      FROM messages 
      WHERE conversation_id IN (${placeholders})
    `, conversationIds);
    
    const summaryCount = await dbManager.get(`
      SELECT COUNT(*) as count 
      FROM summaries 
      WHERE conversation_id IN (${placeholders})
    `, conversationIds);
    
    const analyticsCount = await dbManager.get(`
      SELECT COUNT(*) as count 
      FROM analytics 
      WHERE conversation_id IN (${placeholders})
    `, conversationIds);
    
    const emotionalMetricsCount = await dbManager.get(`
      SELECT COUNT(*) as count 
      FROM emotional_metrics 
      WHERE conversation_id IN (${placeholders})
    `, conversationIds);
    
    console.log(`📝 Messages: ${messageCount.count}`);
    console.log(`📄 Summaries: ${summaryCount.count}`);
    console.log(`📊 Analytics: ${analyticsCount.count}`);
    console.log(`🧠 Emotional Metrics: ${emotionalMetricsCount.count}`);
    
    // Confirmation prompt
    console.log('\n⚠️  WARNING: This action cannot be undone!');
    console.log('This will permanently delete:');
    console.log(`   • ${recentCalls.length} conversations`);
    console.log(`   • ${messageCount.count} messages`);
    console.log(`   • ${summaryCount.count} summaries`);
    console.log(`   • ${analyticsCount.count} analytics records`);
    console.log(`   • ${emotionalMetricsCount.count} emotional metrics records`);
    
    // For safety, require explicit confirmation via environment variable
    const forceDelete = process.env.FORCE_DELETE === 'true';
    
    if (!forceDelete) {
      console.log('\n❌ Deletion cancelled for safety.');
      console.log('To actually delete these records, run:');
      console.log('FORCE_DELETE=true node scripts/remove-recent-calls.js');
      return;
    }
    
    console.log('\n🗑️  Proceeding with deletion...');
    
    // Begin transaction for atomic deletion
    await dbManager.run('BEGIN TRANSACTION');
    
    try {
      // Delete in correct order (foreign key dependencies)
      
      // 1. Delete emotional metrics
      if (emotionalMetricsCount.count > 0) {
        await dbManager.run(`
          DELETE FROM emotional_metrics 
          WHERE conversation_id IN (${placeholders})
        `, conversationIds);
        console.log(`✅ Deleted ${emotionalMetricsCount.count} emotional metrics records`);
      }
      
      // 2. Delete analytics
      if (analyticsCount.count > 0) {
        await dbManager.run(`
          DELETE FROM analytics 
          WHERE conversation_id IN (${placeholders})
        `, conversationIds);
        console.log(`✅ Deleted ${analyticsCount.count} analytics records`);
      }
      
      // 3. Delete messages
      if (messageCount.count > 0) {
        await dbManager.run(`
          DELETE FROM messages 
          WHERE conversation_id IN (${placeholders})
        `, conversationIds);
        console.log(`✅ Deleted ${messageCount.count} message records`);
      }
      
      // 4. Delete summaries
      if (summaryCount.count > 0) {
        await dbManager.run(`
          DELETE FROM summaries 
          WHERE conversation_id IN (${placeholders})
        `, conversationIds);
        console.log(`✅ Deleted ${summaryCount.count} summary records`);
      }
      
      // 5. Finally delete conversations
      await dbManager.run(`
        DELETE FROM conversations 
        WHERE id IN (${placeholders})
      `, conversationIds);
      console.log(`✅ Deleted ${recentCalls.length} conversation records`);
      
      // Commit transaction
      await dbManager.run('COMMIT');
      
      console.log('\n🎉 Successfully deleted all records!');
      
      // Show remaining count
      const remainingCount = await dbManager.get('SELECT COUNT(*) as count FROM conversations');
      console.log(`📊 Remaining conversations in database: ${remainingCount.count}`);
      
    } catch (error) {
      // Rollback on error
      await dbManager.run('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error removing calls:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the script
removeRecentCalls().then(() => {
  console.log('\n✅ Script completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});