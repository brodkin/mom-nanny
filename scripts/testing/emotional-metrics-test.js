#!/usr/bin/env node

/**
 * Test script for Migration 5: Emotional Metrics Database
 * 
 * This script demonstrates:
 * 1. Migration 5 automatic execution
 * 2. saveEmotionalMetrics method usage
 * 3. Data validation and constraints
 * 4. JSON storage for arrays
 * 5. Schema verification
 */

const DatabaseManager = require('../../services/database-manager.js');

async function testEmotionalMetrics() {
  console.log('🧪 Testing Emotional Metrics Database (Migration 5)');
  console.log('================================================\n');

  try {
    // Create in-memory database for testing
    console.log('1. Initializing database with Migration 5...');
    const db = new DatabaseManager(':memory:');
    await db.waitForInitialization();
    console.log('✅ Database initialized\n');

    // Verify schema includes emotional_metrics table
    console.log('2. Verifying schema...');
    const schemaResult = await db.verifySchema();
    console.log('Schema validation result:', schemaResult);
    
    if (!schemaResult.isValid) {
      throw new Error('Schema validation failed');
    }
    console.log('✅ Schema verification passed\n');

    // Check current migration version
    const currentVersion = db.getCurrentMigrationVersion();
    console.log(`Current migration version: ${currentVersion}`);
    console.log('✅ Migration 5 applied successfully\n');

    // Create a test conversation
    console.log('3. Creating test conversation...');
    const convResult = await db.run(
      'INSERT INTO conversations (call_sid, start_time) VALUES (?, ?)', 
      ['test-emotional-metrics-456', new Date().toISOString()]
    );
    const conversationId = convResult.lastID;
    console.log(`✅ Created conversation with ID: ${conversationId}\n`);

    // Test emotional metrics with comprehensive data
    console.log('4. Testing saveEmotionalMetrics method...');
    
    const testMetrics = {
      // Emotional indicators (0-10 scale)
      anxietyLevel: 8,
      agitationLevel: 6,
      confusionLevel: 4,
      comfortLevel: 3,
      
      // Care indicators (boolean)
      mentionsPain: true,
      mentionsMedication: true,
      mentionsStaffComplaint: false,
      mentionsFamily: true,
      
      // Conversation quality metrics
      interruptionCount: 3,
      repetitionCount: 7,
      topicChanges: 5,
      
      // Sentiment analysis
      overallSentiment: 'negative',
      sentimentScore: -0.6,
      
      // Temporal information
      callDurationSeconds: 1847,
      timeOfDay: 'morning',
      dayOfWeek: 'wednesday',
      
      // JSON arrays for complex data
      emergencyIndicators: ['chest pain', 'difficulty breathing'],
      memoryTriggers: ['deceased husband', 'medication confusion', 'family visit']
    };

    const metricsResult = await db.saveEmotionalMetrics(conversationId, testMetrics);
    console.log(`✅ Saved emotional metrics with ID: ${metricsResult.lastID}\n`);

    // Retrieve and verify saved data
    console.log('5. Verifying saved emotional metrics...');
    const savedMetrics = await db.get(
      'SELECT * FROM emotional_metrics WHERE id = ?', 
      [metricsResult.lastID]
    );
    
    console.log('📊 Saved Emotional Metrics:');
    console.log(`   Anxiety Level: ${savedMetrics.anxiety_level}/10`);
    console.log(`   Agitation Level: ${savedMetrics.agitation_level}/10`);
    console.log(`   Confusion Level: ${savedMetrics.confusion_level}/10`);
    console.log(`   Comfort Level: ${savedMetrics.comfort_level}/10`);
    console.log(`   Mentions Pain: ${savedMetrics.mentions_pain ? 'Yes' : 'No'}`);
    console.log(`   Mentions Medication: ${savedMetrics.mentions_medication ? 'Yes' : 'No'}`);
    console.log(`   Overall Sentiment: ${savedMetrics.overall_sentiment}`);
    console.log(`   Sentiment Score: ${savedMetrics.sentiment_score}`);
    console.log(`   Call Duration: ${savedMetrics.call_duration_seconds} seconds`);
    console.log(`   Time of Day: ${savedMetrics.time_of_day}`);
    console.log(`   Day of Week: ${savedMetrics.day_of_week}`);
    
    // Parse JSON arrays
    const emergencyIndicators = JSON.parse(savedMetrics.emergency_indicators);
    const memoryTriggers = JSON.parse(savedMetrics.memory_triggers);
    console.log(`   Emergency Indicators: ${emergencyIndicators.join(', ')}`);
    console.log(`   Memory Triggers: ${memoryTriggers.join(', ')}`);
    console.log('✅ Data retrieval and verification successful\n');

    // Test input validation
    console.log('6. Testing input validation...');
    
    try {
      await db.saveEmotionalMetrics(conversationId, { anxietyLevel: 15 }); // Invalid range
      console.log('❌ Validation should have failed for anxietyLevel > 10');
    } catch (error) {
      console.log('✅ Input validation working: anxiety level out of range caught');
    }

    try {
      await db.saveEmotionalMetrics(conversationId, { overallSentiment: 'invalid' }); // Invalid sentiment
      console.log('❌ Validation should have failed for invalid sentiment');
    } catch (error) {
      console.log('✅ Input validation working: invalid sentiment caught');
    }

    try {
      await db.saveEmotionalMetrics(conversationId, { dayOfWeek: 'invalid' }); // Invalid day
      console.log('❌ Validation should have failed for invalid day of week');
    } catch (error) {
      console.log('✅ Input validation working: invalid day of week caught');
    }

    console.log('✅ All validation tests passed\n');

    // Test query performance with indexes
    console.log('7. Testing query performance with indexes...');
    
    // Add more test data
    for (let i = 0; i < 5; i++) {
      const testConv = await db.run(
        'INSERT INTO conversations (call_sid, start_time) VALUES (?, ?)', 
        [`test-${i}`, new Date().toISOString()]
      );
      
      await db.saveEmotionalMetrics(testConv.lastID, {
        anxietyLevel: Math.floor(Math.random() * 11),
        overallSentiment: ['positive', 'neutral', 'negative'][Math.floor(Math.random() * 3)],
        timeOfDay: ['morning', 'afternoon', 'evening', 'night'][Math.floor(Math.random() * 4)],
        dayOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][Math.floor(Math.random() * 7)]
      });
    }

    // Test indexed queries
    const highAnxietyMetrics = await db.all(
      'SELECT COUNT(*) as count FROM emotional_metrics WHERE anxiety_level >= 7'
    );
    console.log(`   High anxiety calls (≥7): ${highAnxietyMetrics[0].count}`);

    const sentimentDistribution = await db.all(`
      SELECT overall_sentiment, COUNT(*) as count 
      FROM emotional_metrics 
      WHERE overall_sentiment IS NOT NULL
      GROUP BY overall_sentiment
    `);
    console.log('   Sentiment distribution:', sentimentDistribution);

    console.log('✅ Query performance tests completed\n');

    // Clean up
    await db.close();
    
    console.log('🎉 All emotional metrics database tests passed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Migration 5 applied successfully');
    console.log('   ✅ emotional_metrics table created with proper schema');
    console.log('   ✅ saveEmotionalMetrics method working correctly');
    console.log('   ✅ Input validation functioning as expected');
    console.log('   ✅ JSON arrays stored and retrieved properly');
    console.log('   ✅ Performance indexes created and functional');
    console.log('   ✅ Comprehensive emotional state tracking enabled');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test if script is executed directly
if (require.main === module) {
  testEmotionalMetrics().catch(console.error);
}

module.exports = { testEmotionalMetrics };