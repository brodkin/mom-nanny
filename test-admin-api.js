#!/usr/bin/env node

/**
 * Test the admin API endpoint for auto-generated keys
 */

const fetch = require('cross-fetch'); // For older Node versions that might not have fetch
const http = require('http');

async function testAdminAPI() {
  console.log('🧪 Testing Admin API Auto-Generated Keys');
  console.log('========================================');
  
  const baseURL = 'http://localhost:3000';
  
  try {
    // Test 1: Create memory without key (should auto-generate)
    console.log('\n📝 Test 1: POST memory without key');
    const response1 = await fetch(`${baseURL}/api/admin/memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: 'My grandson Tommy loves dinosaurs and wants to be a paleontologist',
        category: 'family'
      })
    });
    
    if (!response1.ok) {
      throw new Error(`HTTP ${response1.status}: ${response1.statusText}`);
    }
    
    const result1 = await response1.json();
    console.log(`   Success: ${result1.success}`);
    console.log(`   Generated key: "${result1.data.key}"`);
    console.log(`   Key was auto-generated: ${result1.data.keyGenerated}`);
    console.log(`   Action: ${result1.data.action}`);
    
    // Test 2: Create memory with manual key (should use provided key)
    console.log('\n📝 Test 2: POST memory with manual key');
    const response2 = await fetch(`${baseURL}/api/admin/memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: 'manual-api-test',
        content: 'This memory has a manually provided key',
        category: 'general'
      })
    });
    
    if (!response2.ok) {
      throw new Error(`HTTP ${response2.status}: ${response2.statusText}`);
    }
    
    const result2 = await response2.json();
    console.log(`   Success: ${result2.success}`);
    console.log(`   Used key: "${result2.data.key}"`);
    console.log(`   Key was auto-generated: ${result2.data.keyGenerated}`);
    console.log(`   Action: ${result2.data.action}`);
    
    // Test 3: Get all memories to verify
    console.log('\n📝 Test 3: GET all memories');
    const response3 = await fetch(`${baseURL}/api/admin/memories?limit=100`);
    
    if (!response3.ok) {
      throw new Error(`HTTP ${response3.status}: ${response3.statusText}`);
    }
    
    const result3 = await response3.json();
    console.log(`   Total memories: ${result3.data.memories.length}`);
    const recentMemories = result3.data.memories.slice(0, 3);
    console.log('   Recent memories:');
    recentMemories.forEach(memory => {
      console.log(`     - "${memory.key}": ${memory.content.substring(0, 50)}...`);
    });
    
    console.log('\n✅ Admin API tests completed successfully!');
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Server not running on port 3000. Please start the server with: npm run dev');
    } else {
      console.error('❌ API test failed:', error.message);
    }
    process.exit(1);
  }
}

testAdminAPI();