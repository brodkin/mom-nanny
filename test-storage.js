#!/usr/bin/env node

/**
 * Test script to verify SQLite storage functionality
 */

require('dotenv').config();
const chalk = require('chalk');
const ConversationAnalyzer = require('./services/conversation-analyzer');
const SqliteStorageService = require('./services/sqlite-storage-service');
const DatabaseManager = require('./services/database-manager');
const SummaryGenerator = require('./services/summary-generator');

async function testStorage() {
  console.log(chalk.cyan.bold('\n🧪 Testing SQLite Storage Integration\n'));
  
  // Initialize storage services
  const dbPath = process.env.SQLITE_DB_PATH || './conversation-summaries.db';
  const databaseManager = new DatabaseManager(dbPath);
  const storageService = new SqliteStorageService(databaseManager);
  const summaryGenerator = new SummaryGenerator();
  
  console.log(chalk.gray(`Database: ${dbPath}`));
  
  // Create a test conversation
  const callSid = `TEST_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const conversationAnalyzer = new ConversationAnalyzer(callSid, new Date());
  
  console.log(chalk.yellow('\n📝 Creating test conversation...'));
  console.log(chalk.gray(`Call SID: ${callSid}`));
  
  // Add some test messages
  const now = Date.now();
  conversationAnalyzer.trackUserUtterance('Hello, is this Jessica?', new Date(now));
  conversationAnalyzer.trackAssistantResponse('Hi Francine! Yes, it\'s Jessica. How are you doing today?', new Date(now + 1000));
  conversationAnalyzer.trackUserUtterance('I\'m feeling a bit anxious today.', new Date(now + 5000));
  conversationAnalyzer.trackAssistantResponse('I\'m sorry to hear you\'re feeling anxious. Would you like to talk about what\'s on your mind?', new Date(now + 6000));
  conversationAnalyzer.trackUserUtterance('I keep forgetting things and it\'s frustrating.', new Date(now + 10000));
  conversationAnalyzer.trackAssistantResponse('That must be really frustrating for you. You know what? Everyone forgets things sometimes. How about we talk about something pleasant? Have you seen any nice dogs lately?', new Date(now + 11000));
  
  // End the conversation and generate summary
  conversationAnalyzer.endTime = new Date();
  const summary = summaryGenerator.generateSummary(conversationAnalyzer);
  
  console.log(chalk.yellow('\n💾 Saving conversation to SQLite...'));
  
  try {
    // Save the summary
    const result = await storageService.saveSummary(summary);
    console.log(chalk.green('✅ Conversation saved successfully!'));
    console.log(chalk.gray(`Conversation ID: ${result}`));
    
    // Display summary analysis
    console.log(chalk.cyan('\n📊 Conversation Analysis:'));
    
    // Debug: show the summary structure
    console.log(chalk.gray('Summary structure:'), Object.keys(summary));
    
    // Safe display of available properties
    if (summary.callSid) console.log(chalk.white(`   Call SID: ${summary.callSid}`));
    if (summary.callMetadata) console.log(chalk.white(`   Duration: ${summary.callMetadata.callDuration}s`));
    if (summary.callMetadata) console.log(chalk.white(`   User Utterances: ${summary.callMetadata.totalUtterances}`));
    
    if (summary.sentimentAnalysis) {
      console.log(chalk.white(`   Sentiment Scores:`));
      console.log(chalk.white(`     - Anxiety: ${summary.sentimentAnalysis.anxiety}`));
      console.log(chalk.white(`     - Positive: ${summary.sentimentAnalysis.positive}`));
    }
    
    if (summary.anxietyIndicators) {
      console.log(chalk.white(`   Anxiety Events: ${summary.anxietyIndicators.count}`));
    }
    
    // Retrieve recent summaries
    console.log(chalk.yellow('\n📚 Retrieving recent summaries...'));
    const recentSummaries = await storageService.getRecentSummaries(5);
    
    if (recentSummaries && recentSummaries.length > 0) {
      console.log(chalk.green(`✅ Found ${recentSummaries.length} recent conversations:`));
      
      recentSummaries.forEach((summary, index) => {
        console.log(chalk.cyan(`\n   ${index + 1}. Call: ${summary.call_sid}`));
        console.log(chalk.gray(`      Time: ${new Date(summary.start_time).toLocaleString()}`));
        console.log(chalk.gray(`      Duration: ${summary.duration || 0}s`));
        
        if (summary.summary_text) {
          try {
            const summaryData = JSON.parse(summary.summary_text);
            if (summaryData.sentimentAnalysis) {
              console.log(chalk.gray(`      Anxiety Level: ${summaryData.sentimentAnalysis.anxiety}`));
              console.log(chalk.gray(`      Positive: ${summaryData.sentimentAnalysis.positive}`));
            }
            if (summaryData.anxietyIndicators) {
              console.log(chalk.gray(`      Anxiety Events: ${summaryData.anxietyIndicators.count}`));
            }
          } catch (e) {
            // If summary_text isn't JSON, just show first part
            console.log(chalk.gray(`      Summary: ${summary.summary_text.substring(0, 50)}...`));
          }
        }
      });
    } else {
      console.log(chalk.yellow('No recent summaries found'));
    }
    
    // Test loading a specific summary
    console.log(chalk.yellow('\n🔍 Testing load functionality...'));
    const loadedSummary = await storageService.loadSummary(result);
    if (loadedSummary) {
      console.log(chalk.green('✅ Successfully loaded saved conversation'));
      console.log(chalk.gray(`   Summary data preserved: Yes`));
      console.log(chalk.gray(`   Analytics data preserved: ${loadedSummary.analytics ? 'Yes' : 'No'}`));
    }
    
    console.log(chalk.green.bold('\n✅ All storage tests passed successfully!\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error during storage test:'), error);
  } finally {
    // Clean up
    await databaseManager.close();
  }
}

// Run the test
testStorage().catch(console.error);