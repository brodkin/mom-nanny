#!/usr/bin/env node

/**
 * Test the /storage display functionality
 */

require('dotenv').config();
const chalk = require('chalk');
const SqliteStorageService = require('./services/sqlite-storage-service');
const DatabaseManager = require('./services/database-manager');

async function testStorageDisplay() {
  console.log(chalk.cyan.bold('\n🧪 Testing Storage Display\n'));
  
  // Initialize storage services
  const dbPath = process.env.SQLITE_DB_PATH || './conversation-summaries.db';
  const databaseManager = new DatabaseManager(dbPath);
  const storageService = new SqliteStorageService(databaseManager);
  
  console.log(chalk.blue.bold('📚 Recent Conversation Summaries:'));
  
  try {
    // Get recent summaries from SQLite
    const recentSummaries = await storageService.getRecentSummaries(5);
    
    if (!recentSummaries || recentSummaries.length === 0) {
      console.log(chalk.gray('   No stored summaries found'));
      return;
    }
    
    recentSummaries.forEach((summary, index) => {
      console.log(chalk.cyan(`\n   ${index + 1}. ${summary.call_sid.startsWith('CHAT_') ? '💬 Chat Session' : summary.call_sid.startsWith('TEST_') ? '🧪 Test Call' : '📞 Phone Call'}`));
      console.log(chalk.white(`      Call ID: ${summary.call_sid}`));
      console.log(chalk.gray(`      Time: ${new Date(summary.start_time).toLocaleString()}`));
      console.log(chalk.gray(`      Duration: ${summary.duration ? `${Math.round(summary.duration)}s` : 'N/A'}`));
      
      // Parse and display summary highlights
      if (summary.summary_text) {
        try {
          const summaryData = JSON.parse(summary.summary_text);
          
          // Display mental state indicators
          if (summaryData.mentalStateIndicators) {
            console.log(chalk.yellow(`      Mental State:`));
            console.log(chalk.gray(`        - Anxiety Level: ${summaryData.mentalStateIndicators.anxietyLevel || 0}`));
            console.log(chalk.gray(`        - Agitation: ${summaryData.mentalStateIndicators.agitationLevel || 0}`));
            console.log(chalk.gray(`        - Confusion Events: ${summaryData.mentalStateIndicators.confusionCount || 0}`));
          }
          
          // Display conversation metrics
          if (summaryData.conversationMetrics) {
            console.log(chalk.yellow(`      Conversation Metrics:`));
            console.log(chalk.gray(`        - Total Interactions: ${summaryData.conversationMetrics.totalInteractions || 0}`));
            console.log(chalk.gray(`        - User Utterances: ${summaryData.conversationMetrics.userUtterances || 0}`));
            console.log(chalk.gray(`        - Repetitions: ${summaryData.conversationMetrics.repetitionCount || 0}`));
          }
          
          // Display care indicators
          if (summaryData.careIndicators) {
            const hasIndicators = summaryData.careIndicators.medicationMentions > 0 || 
                                 summaryData.careIndicators.painComplaints > 0 ||
                                 summaryData.careIndicators.staffComplaints > 0;
            if (hasIndicators) {
              console.log(chalk.yellow(`      Care Indicators:`));
              if (summaryData.careIndicators.medicationMentions > 0) {
                console.log(chalk.gray(`        - Medication Mentions: ${summaryData.careIndicators.medicationMentions}`));
              }
              if (summaryData.careIndicators.painComplaints > 0) {
                console.log(chalk.gray(`        - Pain Complaints: ${summaryData.careIndicators.painComplaints}`));
              }
              if (summaryData.careIndicators.staffComplaints > 0) {
                console.log(chalk.gray(`        - Staff Complaints: ${summaryData.careIndicators.staffComplaints}`));
              }
            }
          }
          
          // Display caregiver insights if present
          if (summaryData.caregiverInsights && summaryData.caregiverInsights.length > 0) {
            console.log(chalk.yellow(`      Key Insights:`));
            summaryData.caregiverInsights.slice(0, 2).forEach(insight => {
              console.log(chalk.gray(`        • ${insight}`));
            });
          }
          
        } catch (e) {
          // If summary_text isn't properly formatted, show what we can
          console.log(chalk.gray(`      Note: Summary data format unrecognized`));
        }
      } else {
        console.log(chalk.gray(`      No summary data available`));
      }
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Error loading summaries:'), error.message);
  } finally {
    // Clean up
    await databaseManager.close();
  }
}

// Run the test
testStorageDisplay().catch(console.error);