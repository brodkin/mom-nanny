#!/usr/bin/env node

/**
 * Demo script showing the message persistence functionality
 */

const SqliteStorageService = require('./services/sqlite-storage-service');
const DatabaseManager = require('./services/database-manager');
const chalk = require('chalk');

async function demo() {
  console.log(chalk.blue.bold('\n🧪 Message Persistence Demo'));
  console.log(chalk.gray('This demo shows how conversation messages are now saved and retrieved from the database.\n'));

  // Initialize storage
  const dbPath = './demo-message-persistence.db';
  const dbManager = new DatabaseManager(dbPath);
  const storageService = new SqliteStorageService(dbManager);

  try {
    // Step 1: Create a conversation summary
    console.log(chalk.yellow('📋 Step 1: Creating conversation summary...'));
    const summary = {
      callSid: 'DEMO_CALL_2024_08_14',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes later
      callMetadata: {
        duration: 600,
        dayOfWeek: 'Wednesday',
        timeOfDay: 'afternoon'
      },
      conversationMetrics: {
        totalInteractions: 8,
        userUtterances: 4,
        assistantResponses: 4,
        repetitionCount: 1
      },
      mentalStateIndicators: {
        anxietyLevel: 2,
        confusionIndicators: 0,
        agitationLevel: 1,
        overallMoodTrend: 'improving'
      },
      careIndicators: {
        medicationConcerns: ['confusion_about_timing'],
        painComplaints: [],
        staffComplaints: 0
      },
      behavioralPatterns: {
        responseLatency: 1200,
        coherenceLevel: 0.85,
        memoryIndicators: ['recent_event_confusion']
      },
      clinicalObservations: {
        hypochondriaEvents: 0
      },
      supportEffectiveness: {
        comfortingSuccess: ['pet_topic_redirection', 'positive_memories']
      },
      caregiverInsights: [
        'Patient responded very well to talking about her dog',
        'Medication timing confusion is a recurring concern',
        'Mood improved significantly when discussing positive memories'
      ]
    };

    const result = await storageService.saveSummary(summary);
    console.log(chalk.green(`   ✅ Summary saved with ID: ${result.conversationId}`));
    console.log(chalk.gray(`   🔢 Numeric ID for messages: ${result.numericId}`));

    // Step 2: Save conversation messages
    console.log(chalk.yellow('\n💬 Step 2: Saving conversation messages...'));
    const messages = [
      {
        role: 'user',
        content: 'Hi Jessica, I\'m feeling confused about my pills today.',
        timestamp: '2024-08-14T14:30:15Z'
      },
      {
        role: 'assistant',
        content: 'Hi Francine! I understand that can be worrying. Tell me what\'s concerning you about your medication.',
        timestamp: '2024-08-14T14:30:20Z'
      },
      {
        role: 'user',
        content: 'I can\'t remember if I took my morning pills. Did I already take them?',
        timestamp: '2024-08-14T14:31:00Z'
      },
      {
        role: 'assistant',
        content: 'That\'s a common concern, and it\'s completely understandable to feel worried about that. You know what might help? Let\'s talk about your sweet dog - how is she doing today?',
        timestamp: '2024-08-14T14:31:10Z'
      },
      {
        role: 'user',
        content: 'Oh, she\'s wonderful! She was playing with her favorite toy this morning.',
        timestamp: '2024-08-14T14:32:00Z'
      },
      {
        role: 'assistant',
        content: 'That sounds absolutely delightful! It must bring you so much joy to see her happy and playful. What\'s her favorite toy?',
        timestamp: '2024-08-14T14:32:10Z'
      },
      {
        role: 'user',
        content: 'It\'s this little squeaky ball that she\'s had for years. She carries it everywhere.',
        timestamp: '2024-08-14T14:33:00Z'
      },
      {
        role: 'assistant',
        content: 'That\'s so sweet! Dogs often have that one special toy they treasure. It sounds like she brings you a lot of happiness.',
        timestamp: '2024-08-14T14:33:15Z'
      }
    ];

    await storageService.saveMessages(result.numericId, messages);
    console.log(chalk.green(`   ✅ ${messages.length} messages saved successfully`));

    // Step 3: Retrieve and display the saved data
    console.log(chalk.yellow('\n📖 Step 3: Retrieving saved conversation...'));
    
    const loadedSummary = await storageService.loadSummary(result.conversationId);
    console.log(chalk.green('   ✅ Summary retrieved successfully'));
    console.log(chalk.gray(`   📞 Call SID: ${loadedSummary.callSid}`));
    console.log(chalk.gray(`   ⏱️  Duration: ${loadedSummary.callMetadata.duration} seconds`));
    console.log(chalk.gray(`   🧠 Anxiety Level: ${loadedSummary.mentalStateIndicators.anxietyLevel}/5`));
    console.log(chalk.gray(`   💡 Key Insight: ${loadedSummary.caregiverInsights[0]}`));

    const loadedMessages = await storageService.loadMessages(result.conversationId);
    console.log(chalk.green(`   ✅ ${loadedMessages.length} messages retrieved successfully`));

    // Step 4: Display conversation flow
    console.log(chalk.yellow('\n🗣️  Step 4: Conversation Flow Analysis'));
    
    let userMessages = 0;
    let assistantMessages = 0;
    let medicationMentions = 0;
    let dogMentions = 0;

    loadedMessages.forEach((msg, index) => {
      const timestamp = new Date(msg.timestamp).toLocaleTimeString();
      const role = msg.role === 'user' ? '🗣️ Francine' : '🤖 Jessica';
      const roleColor = msg.role === 'user' ? chalk.cyan : chalk.green;
      
      console.log(`   ${roleColor(role)} (${timestamp}): ${msg.content}`);
      
      if (msg.role === 'user') userMessages++;
      else assistantMessages++;
      
      if (msg.content.toLowerCase().includes('medication') || msg.content.toLowerCase().includes('pills')) {
        medicationMentions++;
      }
      if (msg.content.toLowerCase().includes('dog') || msg.content.toLowerCase().includes('toy')) {
        dogMentions++;
      }
    });

    // Step 5: Analysis results
    console.log(chalk.yellow('\n📊 Step 5: Conversation Analysis'));
    console.log(chalk.white(`   👤 User messages: ${userMessages}`));
    console.log(chalk.white(`   🤖 Assistant messages: ${assistantMessages}`));
    console.log(chalk.white(`   💊 Medication concerns: ${medicationMentions} mentions`));
    console.log(chalk.white(`   🐕 Successful pet redirection: ${dogMentions} mentions`));
    
    const redirectionSuccess = dogMentions > 0 && medicationMentions > 0;
    if (redirectionSuccess) {
      console.log(chalk.green('   ✅ Successful anxiety redirection: Medication worry → Happy pet topic'));
    }

    // Step 6: Demonstrate data persistence
    console.log(chalk.yellow('\n💾 Step 6: Data Persistence Verification'));
    
    // Close and reopen database connection
    await dbManager.close();
    
    const newDbManager = new DatabaseManager(dbPath);
    const newStorageService = new SqliteStorageService(newDbManager);
    
    const persistedMessages = await newStorageService.loadMessages(result.conversationId);
    const persistedSummary = await newStorageService.loadSummary(result.conversationId);
    
    console.log(chalk.green(`   ✅ Data persisted: ${persistedMessages.length} messages and summary survived database restart`));
    console.log(chalk.gray(`   🗂️  Database location: ${dbPath}`));
    
    await newDbManager.close();

    console.log(chalk.blue.bold('\n🎉 Demo completed successfully!'));
    console.log(chalk.gray('The message persistence system is now fully functional.'));
    console.log(chalk.gray('All conversation messages are saved alongside summaries and can be retrieved at any time.'));

  } catch (error) {
    console.error(chalk.red('❌ Demo failed:'), error);
  } finally {
    try {
      await dbManager.close();
    } catch (e) {
      // Ignore close errors
    }
  }
}

// Run demo if called directly
if (require.main === module) {
  demo().catch(console.error);
}

module.exports = { demo };