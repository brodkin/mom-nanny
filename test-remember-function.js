#!/usr/bin/env node

/**
 * Test the rememberInformation function specifically
 */

const DatabaseManager = require('./services/database-manager');
const MemoryService = require('./services/memory-service');
const { GptService } = require('./services/gpt-service');
const rememberInformation = require('./functions/rememberInformation');

async function testRememberFunction() {
  console.log('🧪 Testing rememberInformation Function');
  console.log('======================================');
  
  try {
    // Initialize services
    const dbManager = DatabaseManager.getInstance();
    await dbManager.waitForInitialization();
    
    // Create GPT service for key generation
    const gptService = new GptService(null, null, null, dbManager);
    
    // Create memory service with GPT service
    const memoryService = new MemoryService(dbManager, gptService);
    
    // Set memory service reference in GPT service
    gptService.memoryService = memoryService;
    
    // Set global memory service for function to access
    global.memoryService = memoryService;
    
    await memoryService.initialize();
    
    console.log('✅ Services initialized successfully');
    
    // Test 1: Call rememberInformation without memory_key (new signature)
    console.log('\n📝 Test 1: Remember family information');
    const result1 = await rememberInformation({
      content: 'My son John is a teacher and lives in Portland with his wife Sarah',
      category: 'family'
    });
    
    const parsedResult1 = JSON.parse(result1);
    console.log(`   Success: ${parsedResult1.success}`);
    console.log(`   Generated key: "${parsedResult1.key}"`);
    
    // Test 2: Remember health information
    console.log('\n📝 Test 2: Remember health information');
    const result2 = await rememberInformation({
      content: 'Has allergies to shellfish and peanuts, carries EpiPen',
      category: 'health'
    });
    
    const parsedResult2 = JSON.parse(result2);
    console.log(`   Success: ${parsedResult2.success}`);
    console.log(`   Generated key: "${parsedResult2.key}"`);
    
    // Test 3: Remember preferences
    console.log('\n📝 Test 3: Remember preferences');
    const result3 = await rememberInformation({
      content: 'Loves gardening, especially roses and tulips. Dislikes loud noises.',
      category: 'preferences'
    });
    
    const parsedResult3 = JSON.parse(result3);
    console.log(`   Success: ${parsedResult3.success}`);
    console.log(`   Generated key: "${parsedResult3.key}"`);
    
    // Verify memories were stored
    console.log('\n📋 Verification - All stored memories:');
    const allKeys = await memoryService.getAllMemoryKeys();
    console.log(`   Total memories: ${allKeys.memories.length + allKeys.facts.length}`);
    console.log(`   Latest memories: [${allKeys.memories.slice(-3).join(', ')}]`);
    
    console.log('\n✅ rememberInformation function tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testRememberFunction();