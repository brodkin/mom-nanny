#!/usr/bin/env node

/**
 * Test script for the emotional analysis implementation
 * This tests the new analyzeEmotionalState method in isolation
 */

// Set test environment to use mock responses
process.env.NODE_ENV = 'test';
// Set a dummy API key to prevent initialization errors
process.env.OPENAI_API_KEY = 'test-key-for-mock';

const { GptService } = require('./services/gpt-service');

async function testEmotionalAnalysis() {
  console.log('🧪 Testing Emotional Analysis Implementation...\n');

  // Create a mock GPT service instance
  const mockMarkService = {
    waitForAllMarksCompleted: () => Promise.resolve()
  };
  
  const gptService = new GptService(mockMarkService);

  // Test with sample conversation data (array format like conversationAnalyzer.interactions)
  const sampleConversation = [
    {
      type: 'user_utterance',
      text: 'I think I forgot to take my medicine again',
      timestamp: new Date('2025-08-21T10:00:00Z')
    },
    {
      type: 'assistant_response', 
      text: 'It\'s okay, Francine. Let\'s check together. Can you see your pill organizer?',
      timestamp: new Date('2025-08-21T10:00:30Z')
    },
    {
      type: 'user_utterance',
      text: 'I\'m so worried about everything. Where are my children?',
      timestamp: new Date('2025-08-21T10:01:00Z')
    },
    {
      type: 'assistant_response',
      text: 'I understand you\'re feeling worried. Your family loves you very much.',
      timestamp: new Date('2025-08-21T10:01:30Z')
    }
  ];

  try {
    console.log('📋 Sample conversation:');
    sampleConversation.forEach(item => {
      const time = new Date(item.timestamp).toLocaleTimeString();
      console.log(`[${time}] ${item.type === 'user_utterance' ? 'User' : 'Assistant'}: ${item.text}`);
    });
    console.log();

    console.log('🔍 Analyzing emotional state...');
    const result = await gptService.analyzeEmotionalState(sampleConversation);

    console.log('✅ Analysis completed successfully!\n');
    console.log('📊 Emotional Analysis Results:');
    console.log('================================');
    console.log(`Anxiety Level: ${result.anxietyLevel} (Peak: ${result.anxietyPeak}) - Trend: ${result.anxietyTrend}`);
    console.log(`Confusion Level: ${result.confusionLevel} (Peak: ${result.confusionPeak}) - Trend: ${result.confusionTrend}`);
    console.log(`Agitation Level: ${result.agitationLevel} (Peak: ${result.agitationPeak}) - Trend: ${result.agitationTrend}`);
    console.log(`Overall Mood: ${result.overallMood} - Trend: ${result.moodTrend}`);
    console.log(`Analysis Confidence: ${result.analysisConfidence}`);
    console.log(`Key Observations: ${result.keyObservations.join(', ')}`);

    // Verify the structure matches the tasks.md specification
    console.log('\n✅ Structure Validation:');
    const requiredFields = [
      'anxietyLevel', 'anxietyPeak', 'anxietyTrend',
      'confusionLevel', 'confusionPeak', 'confusionTrend',
      'agitationLevel', 'agitationPeak', 'agitationTrend',
      'overallMood', 'moodTrend', 'analysisConfidence', 'keyObservations'
    ];

    let validationPassed = true;
    requiredFields.forEach(field => {
      if (result[field] === undefined || result[field] === null) {
        console.log(`❌ Missing required field: ${field}`);
        validationPassed = false;
      } else {
        console.log(`✅ ${field}: ${typeof result[field]} = ${result[field]}`);
      }
    });

    // Verify numeric types
    const numericFields = [
      'anxietyLevel', 'anxietyPeak', 'confusionLevel', 'confusionPeak',
      'agitationLevel', 'agitationPeak', 'overallMood', 'analysisConfidence'
    ];

    console.log('\n📏 Numeric Type Validation:');
    numericFields.forEach(field => {
      const value = result[field];
      const isNumber = typeof value === 'number' && !isNaN(value);
      console.log(`${isNumber ? '✅' : '❌'} ${field}: ${typeof value} = ${value}`);
      if (!isNumber) validationPassed = false;
    });

    console.log(`\n${validationPassed ? '🎉' : '❌'} Overall Validation: ${validationPassed ? 'PASSED' : 'FAILED'}`);
    
    if (validationPassed) {
      console.log('\n✅ Implementation meets all requirements from tasks.md');
      console.log('✅ Ready for integration with database storage');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Test with string format as well
async function testStringFormat() {
  console.log('\n🔤 Testing string format input...');
  
  const mockMarkService = {
    waitForAllMarksCompleted: () => Promise.resolve()
  };
  
  const gptService = new GptService(mockMarkService);
  
  const conversationString = `[10:00:00] User: I think I forgot to take my medicine again
[10:00:30] Assistant: It's okay, Francine. Let's check together.
[10:01:00] User: I'm so worried about everything.`;

  try {
    const result = await gptService.analyzeEmotionalState(conversationString);
    console.log('✅ String format works correctly');
    console.log(`📊 Anxiety Level: ${result.anxietyLevel}, Confidence: ${result.analysisConfidence}`);
  } catch (error) {
    console.error('❌ String format test failed:', error);
  }
}

// Run tests
if (require.main === module) {
  (async () => {
    await testEmotionalAnalysis();
    await testStringFormat();
    console.log('\n🎯 All tests completed!');
  })();
}

module.exports = { testEmotionalAnalysis };