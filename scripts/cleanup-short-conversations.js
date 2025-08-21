#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const DatabaseManager = require('../services/database-manager.js');

/**
 * Cleanup script to remove short conversations (< 1 second) and associated data
 * 
 * Usage:
 *   node scripts/cleanup-short-conversations.js [--dry-run]
 * 
 * Options:
 *   --dry-run    Preview what would be deleted without making changes
 * 
 * Environment:
 *   SQLITE_DB_PATH  Path to database (default: './conversation-summaries.db')
 */

class ConversationCleanup {
  constructor(dryRun = false) {
    this.dryRun = dryRun;
    this.dbManager = null;
  }

  async initialize() {
    try {
      console.log('🔧 Initializing database connection...');
      
      // Use DatabaseManager singleton with environment path
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

  async getShortConversations() {
    try {
      const shortConversations = await this.dbManager.all(`
        SELECT id, call_sid, duration, start_time, end_time
        FROM conversations 
        WHERE duration IS NOT NULL AND duration < 1
        ORDER BY start_time DESC
      `);
      
      return shortConversations;
    } catch (error) {
      console.error('❌ Error fetching short conversations:', error.message);
      throw error;
    }
  }

  async getRecordCounts() {
    try {
      const counts = {};
      
      // Get total counts for each table
      const conversationsCount = await this.dbManager.get('SELECT COUNT(*) as count FROM conversations');
      const messagesCount = await this.dbManager.get('SELECT COUNT(*) as count FROM messages');
      const summariesCount = await this.dbManager.get('SELECT COUNT(*) as count FROM summaries');
      const analyticsCount = await this.dbManager.get('SELECT COUNT(*) as count FROM analytics');
      
      counts.conversations = conversationsCount.count;
      counts.messages = messagesCount.count;
      counts.summaries = summariesCount.count;
      counts.analytics = analyticsCount.count;
      
      return counts;
    } catch (error) {
      console.error('❌ Error getting record counts:', error.message);
      throw error;
    }
  }

  async getAssociatedRecordCounts(conversationIds) {
    if (conversationIds.length === 0) {
      return { messages: 0, summaries: 0, analytics: 0 };
    }

    try {
      const placeholders = conversationIds.map(() => '?').join(',');
      
      const messagesCount = await this.dbManager.get(
        `SELECT COUNT(*) as count FROM messages WHERE conversation_id IN (${placeholders})`,
        conversationIds
      );
      
      const summariesCount = await this.dbManager.get(
        `SELECT COUNT(*) as count FROM summaries WHERE conversation_id IN (${placeholders})`,
        conversationIds
      );
      
      const analyticsCount = await this.dbManager.get(
        `SELECT COUNT(*) as count FROM analytics WHERE conversation_id IN (${placeholders})`,
        conversationIds
      );
      
      return {
        messages: messagesCount.count,
        summaries: summariesCount.count,
        analytics: analyticsCount.count
      };
    } catch (error) {
      console.error('❌ Error getting associated record counts:', error.message);
      throw error;
    }
  }

  async deleteShortConversations(conversationIds) {
    if (conversationIds.length === 0) {
      return { conversations: 0, messages: 0, summaries: 0, analytics: 0 };
    }

    try {
      return await this.dbManager.transaction(() => {
        const placeholders = conversationIds.map(() => '?').join(',');
        let deletedCounts = { conversations: 0, messages: 0, summaries: 0, analytics: 0 };
        
        // Delete associated records first (due to foreign key constraints)
        // Delete messages
        const messagesResult = this.dbManager.runSync(
          `DELETE FROM messages WHERE conversation_id IN (${placeholders})`,
          conversationIds
        );
        deletedCounts.messages = messagesResult.changes;
        
        // Delete summaries
        const summariesResult = this.dbManager.runSync(
          `DELETE FROM summaries WHERE conversation_id IN (${placeholders})`,
          conversationIds
        );
        deletedCounts.summaries = summariesResult.changes;
        
        // Delete analytics
        const analyticsResult = this.dbManager.runSync(
          `DELETE FROM analytics WHERE conversation_id IN (${placeholders})`,
          conversationIds
        );
        deletedCounts.analytics = analyticsResult.changes;
        
        // Finally delete conversations
        const conversationsResult = this.dbManager.runSync(
          `DELETE FROM conversations WHERE id IN (${placeholders})`,
          conversationIds
        );
        deletedCounts.conversations = conversationsResult.changes;
        
        return deletedCounts;
      });
      
    } catch (error) {
      console.error('❌ Error deleting short conversations:', error.message);
      throw error;
    }
  }

  async run() {
    try {
      await this.initialize();
      
      console.log('📊 Getting initial record counts...');
      const beforeCounts = await this.getRecordCounts();
      
      console.log('🔍 Finding short conversations (duration < 1 second)...');
      const shortConversations = await this.getShortConversations();
      
      if (shortConversations.length === 0) {
        console.log('✨ No short conversations found! Database is clean.');
        return;
      }
      
      console.log(`📋 Found ${shortConversations.length} short conversations:`);
      console.log('   ID | Call SID | Duration | Start Time');
      console.log('   ---|----------|----------|------------');
      
      shortConversations.slice(0, 10).forEach(conv => {
        const duration = conv.duration || 'null';
        const startTime = new Date(conv.start_time).toISOString().replace('T', ' ').substr(0, 19);
        console.log(`   ${String(conv.id).padStart(3)} | ${conv.call_sid.substring(0, 8)}... | ${String(duration).padStart(8)} | ${startTime}`);
      });
      
      if (shortConversations.length > 10) {
        console.log(`   ... and ${shortConversations.length - 10} more`);
      }
      
      // Get conversation IDs for associated record lookup
      const conversationIds = shortConversations.map(conv => conv.id);
      const associatedCounts = await this.getAssociatedRecordCounts(conversationIds);
      
      console.log('\n📈 Records to be affected:');
      console.log(`   Conversations: ${shortConversations.length}`);
      console.log(`   Messages: ${associatedCounts.messages}`);
      console.log(`   Summaries: ${associatedCounts.summaries}`);
      console.log(`   Analytics: ${associatedCounts.analytics}`);
      console.log(`   Total records: ${shortConversations.length + associatedCounts.messages + associatedCounts.summaries + associatedCounts.analytics}`);
      
      if (this.dryRun) {
        console.log('\n🔍 DRY RUN COMPLETE - No changes were made');
        console.log('Run without --dry-run to perform the cleanup');
        return;
      }
      
      console.log('\n🗑️  Deleting short conversations and associated data...');
      const deletedCounts = await this.deleteShortConversations(conversationIds);
      
      console.log('✅ Deletion completed successfully!');
      console.log(`   Conversations deleted: ${deletedCounts.conversations}`);
      console.log(`   Messages deleted: ${deletedCounts.messages}`);
      console.log(`   Summaries deleted: ${deletedCounts.summaries}`);
      console.log(`   Analytics deleted: ${deletedCounts.analytics}`);
      console.log(`   Total records deleted: ${deletedCounts.conversations + deletedCounts.messages + deletedCounts.summaries + deletedCounts.analytics}`);
      
      console.log('\n📊 Getting final record counts...');
      const afterCounts = await this.getRecordCounts();
      
      console.log('\n📈 Before vs After:');
      console.log(`   Conversations: ${beforeCounts.conversations} → ${afterCounts.conversations} (${beforeCounts.conversations - afterCounts.conversations} removed)`);
      console.log(`   Messages: ${beforeCounts.messages} → ${afterCounts.messages} (${beforeCounts.messages - afterCounts.messages} removed)`);
      console.log(`   Summaries: ${beforeCounts.summaries} → ${afterCounts.summaries} (${beforeCounts.summaries - afterCounts.summaries} removed)`);
      console.log(`   Analytics: ${beforeCounts.analytics} → ${afterCounts.analytics} (${beforeCounts.analytics - afterCounts.analytics} removed)`);
      
      console.log('\n✨ Cleanup completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Cleanup failed:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
      process.exit(1);
    } finally {
      // Close database connection
      if (this.dbManager) {
        await this.dbManager.close();
      }
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Cleanup Short Conversations Script

This script removes conversations with duration < 1 second and all their
associated data (messages, summaries, analytics) from the database.

Usage:
  node scripts/cleanup-short-conversations.js [--dry-run]

Options:
  --dry-run    Preview what would be deleted without making changes
  --help, -h   Show this help message

Environment Variables:
  SQLITE_DB_PATH   Path to SQLite database (default: './conversation-summaries.db')

Examples:
  # Preview cleanup without making changes
  node scripts/cleanup-short-conversations.js --dry-run
  
  # Perform actual cleanup
  node scripts/cleanup-short-conversations.js
  
  # Use custom database path
  SQLITE_DB_PATH=./storage/conversation-summaries.db node scripts/cleanup-short-conversations.js
  `);
  process.exit(0);
}

// Run the cleanup
const cleanup = new ConversationCleanup(dryRun);
cleanup.run();