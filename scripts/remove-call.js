#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const DatabaseManager = require('../services/database-manager.js');
const readline = require('readline');

/**
 * Script to safely remove a specific call and all its associated data from the database.
 * Preserves shared data like memories that are used across multiple calls.
 * 
 * Usage:
 *   node scripts/remove-call.js <call_sid>              # Remove by call_sid
 *   node scripts/remove-call.js --id <conversation_id>  # Remove by conversation ID
 *   node scripts/remove-call.js <call_sid> --dry-run    # Preview without deleting
 *   node scripts/remove-call.js <call_sid> --force      # Skip confirmation
 * 
 * Environment:
 *   SQLITE_DB_PATH  Path to database (default: './storage/conversation-summaries.db')
 */

class CallRemover {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.force = options.force || false;
    this.dbManager = null;
    this.rl = null;
  }

  async initialize() {
    try {
      console.log('🔧 Initializing database connection...');
      
      // Use DatabaseManager singleton
      this.dbManager = DatabaseManager.getInstance();
      await this.dbManager.waitForInitialization();
      
      const dbPath = this.dbManager.dbPath;
      console.log(`📁 Database path: ${dbPath}`);
      
      if (this.dryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be made');
      }
      
      console.log('✅ Database initialized successfully\n');
      
    } catch (error) {
      console.error('❌ Failed to initialize database:', error.message);
      throw error;
    }
  }

  async findCall(identifier, isId = false) {
    try {
      let query, params;
      
      if (isId) {
        // Search by conversation ID
        query = 'SELECT * FROM conversations WHERE id = ?';
        params = [parseInt(identifier)];
      } else {
        // Search by call_sid (exact or partial match)
        query = 'SELECT * FROM conversations WHERE call_sid = ? OR call_sid LIKE ?';
        params = [identifier, `%${identifier}%`];
      }
      
      const calls = await this.dbManager.all(query, params);
      
      if (calls.length === 0) {
        return null;
      }
      
      if (calls.length > 1) {
        console.log('⚠️  Multiple calls found matching your criteria:');
        console.log('   ID | Call SID | Duration | Start Time');
        console.log('   ---|----------|----------|------------');
        
        calls.forEach(call => {
          const duration = call.duration ? `${call.duration}s` : 'null';
          const startTime = new Date(call.start_time).toISOString().replace('T', ' ').substr(0, 19);
          console.log(`   ${String(call.id).padStart(3)} | ${call.call_sid.substring(0, 12)}... | ${String(duration).padStart(8)} | ${startTime}`);
        });
        
        console.log('\nPlease be more specific with your identifier.');
        return 'multiple';
      }
      
      return calls[0];
      
    } catch (error) {
      console.error('❌ Error finding call:', error.message);
      throw error;
    }
  }

  async getAssociatedRecords(conversationId) {
    try {
      const results = {};
      
      // Count emotional_metrics
      const emotionalMetricsCount = await this.dbManager.get(
        'SELECT COUNT(*) as count FROM emotional_metrics WHERE conversation_id = ?',
        [conversationId]
      );
      results.emotionalMetrics = emotionalMetricsCount.count;
      
      // Count analytics
      const analyticsCount = await this.dbManager.get(
        'SELECT COUNT(*) as count FROM analytics WHERE conversation_id = ?',
        [conversationId]
      );
      results.analytics = analyticsCount.count;
      
      // Count messages
      const messagesCount = await this.dbManager.get(
        'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?',
        [conversationId]
      );
      results.messages = messagesCount.count;
      
      // Count summaries
      const summariesCount = await this.dbManager.get(
        'SELECT COUNT(*) as count FROM summaries WHERE conversation_id = ?',
        [conversationId]
      );
      results.summaries = summariesCount.count;
      
      return results;
      
    } catch (error) {
      console.error('❌ Error getting associated records:', error.message);
      throw error;
    }
  }

  async displayCallDetails(call, associatedCounts) {
    console.log('📞 Call Details:');
    console.log(`   Conversation ID: ${call.id}`);
    console.log(`   Call SID: ${call.call_sid}`);
    console.log(`   Duration: ${call.duration ? call.duration + 's' : 'Unknown'}`);
    console.log(`   Start Time: ${new Date(call.start_time).toISOString().replace('T', ' ').substr(0, 19)}`);
    console.log(`   End Time: ${call.end_time ? new Date(call.end_time).toISOString().replace('T', ' ').substr(0, 19) : 'Not recorded'}`);
    console.log(`   Caller Info: ${call.caller_info || 'Not available'}`);
    
    console.log('\n🗂️  Associated Records to be Deleted:');
    console.log(`   Emotional Metrics: ${associatedCounts.emotionalMetrics}`);
    console.log(`   Analytics: ${associatedCounts.analytics}`);
    console.log(`   Messages: ${associatedCounts.messages}`);
    console.log(`   Summaries: ${associatedCounts.summaries}`);
    console.log('   Main Conversation: 1');
    
    const totalRecords = associatedCounts.emotionalMetrics + associatedCounts.analytics + 
                        associatedCounts.messages + associatedCounts.summaries + 1;
    console.log(`   📊 Total Records: ${totalRecords}`);
    
    console.log('\n💾 Data that will NOT be deleted:');
    console.log('   ✅ Memories (shared across all calls)');
    console.log('   ✅ Other conversations');
    console.log('   ✅ System settings');
  }

  async confirmDeletion() {
    if (this.force) {
      return true;
    }
    
    return new Promise((resolve) => {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      this.rl.question('\n⚠️  Are you sure you want to delete this call and all its data? (yes/no): ', (answer) => {
        this.rl.close();
        this.rl = null;
        
        const confirmed = answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y';
        resolve(confirmed);
      });
    });
  }

  async deleteCall(conversationId) {
    try {
      return await this.dbManager.transaction(() => {
        const deletedCounts = {
          emotionalMetrics: 0,
          analytics: 0,
          messages: 0,
          summaries: 0,
          conversation: 0
        };
        
        // Delete in order respecting foreign key constraints
        
        // 1. Delete emotional_metrics
        const emotionalResult = this.dbManager.runSync(
          'DELETE FROM emotional_metrics WHERE conversation_id = ?',
          [conversationId]
        );
        deletedCounts.emotionalMetrics = emotionalResult.changes;
        
        // 2. Delete analytics
        const analyticsResult = this.dbManager.runSync(
          'DELETE FROM analytics WHERE conversation_id = ?',
          [conversationId]
        );
        deletedCounts.analytics = analyticsResult.changes;
        
        // 3. Delete messages
        const messagesResult = this.dbManager.runSync(
          'DELETE FROM messages WHERE conversation_id = ?',
          [conversationId]
        );
        deletedCounts.messages = messagesResult.changes;
        
        // 4. Delete summaries
        const summariesResult = this.dbManager.runSync(
          'DELETE FROM summaries WHERE conversation_id = ?',
          [conversationId]
        );
        deletedCounts.summaries = summariesResult.changes;
        
        // 5. Finally delete the conversation itself
        const conversationResult = this.dbManager.runSync(
          'DELETE FROM conversations WHERE id = ?',
          [conversationId]
        );
        deletedCounts.conversation = conversationResult.changes;
        
        return deletedCounts;
      });
      
    } catch (error) {
      console.error('❌ Error deleting call:', error.message);
      throw error;
    }
  }

  async run(identifier, isId = false) {
    try {
      await this.initialize();
      
      console.log(`🔍 Looking for call: ${identifier}${isId ? ' (by ID)' : ' (by call_sid)'}...\n`);
      
      const call = await this.findCall(identifier, isId);
      
      if (!call) {
        console.log('❌ Call not found!');
        console.log(`No call found matching: ${identifier}`);
        return;
      }
      
      if (call === 'multiple') {
        return; // Error already displayed
      }
      
      // Get associated record counts
      const associatedCounts = await this.getAssociatedRecords(call.id);
      
      // Display call details
      await this.displayCallDetails(call, associatedCounts);
      
      if (this.dryRun) {
        console.log('\n🔍 DRY RUN COMPLETE - No changes were made');
        console.log('Run without --dry-run to perform the deletion');
        return;
      }
      
      // Confirm deletion
      const confirmed = await this.confirmDeletion();
      
      if (!confirmed) {
        console.log('\n❌ Deletion cancelled by user');
        return;
      }
      
      console.log('\n🗑️  Deleting call and all associated data...');
      const deletedCounts = await this.deleteCall(call.id);
      
      console.log('✅ Deletion completed successfully!');
      console.log(`   Emotional Metrics deleted: ${deletedCounts.emotionalMetrics}`);
      console.log(`   Analytics deleted: ${deletedCounts.analytics}`);
      console.log(`   Messages deleted: ${deletedCounts.messages}`);
      console.log(`   Summaries deleted: ${deletedCounts.summaries}`);
      console.log(`   Conversation deleted: ${deletedCounts.conversation}`);
      
      const totalDeleted = deletedCounts.emotionalMetrics + deletedCounts.analytics + 
                          deletedCounts.messages + deletedCounts.summaries + deletedCounts.conversation;
      console.log(`   📊 Total records deleted: ${totalDeleted}`);
      
      console.log('\n✨ Call removal completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Call removal failed:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
      process.exit(1);
    } finally {
      // Close readline interface if open
      if (this.rl) {
        this.rl.close();
      }
      
      // Close database connection
      if (this.dbManager) {
        await this.dbManager.close();
      }
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

// Help text
if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  console.log(`
Remove Call Script

This script safely removes a specific call and all its associated data from the database.
Memories are preserved as they are shared across multiple calls.

Usage:
  node scripts/remove-call.js <call_sid>              # Remove by call_sid
  node scripts/remove-call.js --id <conversation_id>  # Remove by conversation ID
  node scripts/remove-call.js <call_sid> --dry-run    # Preview without deleting
  node scripts/remove-call.js <call_sid> --force      # Skip confirmation

Options:
  --id         Treat the identifier as a conversation ID instead of call_sid
  --dry-run    Preview what would be deleted without making changes
  --force      Skip confirmation prompt (use with caution!)
  --help, -h   Show this help message

Environment Variables:
  SQLITE_DB_PATH   Path to SQLite database (default: './storage/conversation-summaries.db')

Examples:
  # Remove call by call_sid (exact match)
  node scripts/remove-call.js CA1234567890abcdef1234567890abcdef

  # Remove call by partial call_sid match
  node scripts/remove-call.js CA123456

  # Remove call by conversation ID
  node scripts/remove-call.js --id 42

  # Preview deletion without making changes
  node scripts/remove-call.js CA123456 --dry-run

  # Remove without confirmation prompt
  node scripts/remove-call.js CA123456 --force

What gets deleted:
  ✅ The conversation record
  ✅ All messages in the conversation
  ✅ All summaries for the conversation
  ✅ All analytics data for the conversation
  ✅ All emotional metrics for the conversation

What is preserved:
  ✅ Memories (shared across all calls)
  ✅ Other conversations
  ✅ System settings
  `);
  process.exit(0);
}

// Parse arguments
const options = {
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force')
};

const isId = args.includes('--id');
let identifier;

if (isId) {
  const idIndex = args.indexOf('--id');
  if (idIndex === -1 || idIndex + 1 >= args.length) {
    console.error('❌ Error: --id flag requires a conversation ID');
    process.exit(1);
  }
  identifier = args[idIndex + 1];
} else {
  // Get the first non-flag argument as the call_sid
  identifier = args.find(arg => !arg.startsWith('--'));
  
  if (!identifier) {
    console.error('❌ Error: Please provide a call_sid or use --id with a conversation ID');
    console.error('Use --help for usage information');
    process.exit(1);
  }
}

// Run the removal
const remover = new CallRemover(options);
remover.run(identifier, isId);