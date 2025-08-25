#!/usr/bin/env node

/**
 * Test script to verify GPT response chunking behavior and TTS mock data reception
 * This script simulates chat interactions and monitors how responses are chunked
 */

const { ChatSession } = require('../services/chat-session.js');

class ChunkingTestSession extends ChatSession {
  constructor() {
    super();
    this.testResults = {
      testName: '',
      gptResponseChunks: [],
      ttsGenerateRequests: [],
      startTime: null,
      endTime: null
    };
  }

  setupTestTracking(testName) {
    this.testResults.testName = testName;
    this.testResults.gptResponseChunks = [];
    this.testResults.ttsGenerateRequests = [];
    this.testResults.startTime = Date.now();

    // Override handleGptReply to track GPT responses
    this.originalHandleGptReply = this.handleGptReply.bind(this);
    this.handleGptReply = (gptReply, interactionCount) => {
      // Track the response
      if (gptReply.partialResponse && gptReply.partialResponse.trim()) {
        this.testResults.gptResponseChunks.push({
          index: gptReply.partialResponseIndex,
          content: gptReply.partialResponse,
          isFinal: gptReply.isFinal,
          timestamp: Date.now() - this.testResults.startTime
        });
        
        console.log(`📝 GPT Chunk ${gptReply.partialResponseIndex}: "${gptReply.partialResponse}"`);
      }

      // Call original handler
      this.originalHandleGptReply(gptReply, interactionCount);
    };

    // Override TTS service to track generate requests
    this.originalTtsGenerate = this.ttsService.generate.bind(this.ttsService);
    this.ttsService.generate = (gptReply, interactionCount) => {
      if (gptReply.partialResponse && gptReply.partialResponse.trim()) {
        this.testResults.ttsGenerateRequests.push({
          index: gptReply.partialResponseIndex,
          content: gptReply.partialResponse,
          isFinal: gptReply.isFinal,
          timestamp: Date.now() - this.testResults.startTime
        });
        
        console.log(`🔊 TTS Request ${gptReply.partialResponseIndex}: "${gptReply.partialResponse}"`);
      }

      // Call original TTS generate
      return this.originalTtsGenerate(gptReply, interactionCount);
    };
  }

  async runTest(testName, input) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Test: ${testName}`);
    console.log(`💬 Input: "${input}"`);
    console.log(`${'='.repeat(60)}`);

    this.setupTestTracking(testName);

    return new Promise((resolve) => {
      // Set up completion handler
      this.once('responseComplete', () => {
        this.testResults.endTime = Date.now();
        const duration = this.testResults.endTime - this.testResults.startTime;
        
        console.log(`\n📊 Test Results for: ${testName}`);
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`📝 GPT Response Chunks: ${this.testResults.gptResponseChunks.length}`);
        console.log(`🔊 TTS Generate Requests: ${this.testResults.ttsGenerateRequests.length}`);
        
        // Verify chunks match TTS requests
        const chunksMatch = this.testResults.gptResponseChunks.length === this.testResults.ttsGenerateRequests.length;
        console.log(`✅ GPT chunks match TTS requests: ${chunksMatch ? 'PASS' : 'FAIL'}`);
        
        // Show detailed breakdown
        console.log('\n📋 Detailed Breakdown:');
        this.testResults.gptResponseChunks.forEach((chunk, i) => {
          const ttsRequest = this.testResults.ttsGenerateRequests[i];
          const matches = ttsRequest && ttsRequest.content === chunk.content;
          console.log(`  ${i + 1}. GPT: "${chunk.content}"`);
          console.log(`     TTS: "${ttsRequest ? ttsRequest.content : 'MISSING'}" ${matches ? '✅' : '❌'}`);
        });

        resolve(this.testResults);
      });

      // Handle the user message
      this.handleUserMessage(input);
      
      // Timeout safety
      setTimeout(() => {
        console.log('⚠️  Test timed out');
        resolve(this.testResults);
      }, 15000);
    });
  }
}

async function runChunkingTests() {
  console.log('🚀 Starting GPT Response Chunking Tests\n');

  const session = new ChunkingTestSession();
  await session.initializeAsync();

  const testCases = [
    {
      name: 'Pain complaint with bullet points',
      input: 'Everything hurts'
    },
    {
      name: 'Simple greeting',
      input: 'Hello'
    },
    {
      name: 'Feeling terrible',
      input: 'I feel terrible'
    },
    {
      name: 'Anxiety expression',
      input: 'I am so worried'
    },
    {
      name: 'Single word input',
      input: 'Help'
    }
  ];

  const results = [];

  for (const testCase of testCases) {
    const result = await session.runTest(testCase.name, testCase.input);
    results.push(result);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 FINAL SUMMARY');
  console.log(`${'='.repeat(60)}`);
  
  let totalTests = results.length;
  let passedTests = 0;
  
  results.forEach((result, i) => {
    const chunksMatch = result.gptResponseChunks.length === result.ttsGenerateRequests.length;
    if (chunksMatch) passedTests++;
    
    console.log(`${i + 1}. ${result.testName}`);
    console.log(`   GPT Chunks: ${result.gptResponseChunks.length} | TTS Requests: ${result.ttsGenerateRequests.length} | ${chunksMatch ? '✅ PASS' : '❌ FAIL'}`);
  });
  
  console.log(`\n🎯 Overall Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All chunking tests PASSED! The fix is working correctly.');
  } else {
    console.log('⚠️  Some tests FAILED. Review the chunking logic.');
  }

  process.exit(0);
}

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the tests
runChunkingTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});