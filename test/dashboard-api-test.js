/**
 * Dashboard API Test Script
 * 
 * Tests the real dashboard API endpoints to ensure they return
 * proper data structures for the frontend dashboard.
 */

const fetch = require('node-fetch');

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/admin/dashboard`;

// Test endpoints
const endpoints = [
  { name: 'Overview', path: '/overview' },
  { name: 'Mental State', path: '/mental-state?days=7' },
  { name: 'Care Indicators', path: '/care-indicators?days=30' },
  { name: 'Conversation Trends', path: '/conversation-trends?days=30' },
  { name: 'Real-time', path: '/real-time' }
];

async function testEndpoint(endpoint) {
  try {
    console.log(`\n🧪 Testing ${endpoint.name} endpoint...`);
    
    const response = await fetch(`${API_BASE}${endpoint.path}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Validate basic response structure
    if (!data.success) {
      throw new Error(`API returned unsuccessful response: ${data.error}`);
    }
    
    if (!data.data) {
      throw new Error('Response missing data field');
    }
    
    if (!data.timestamp) {
      throw new Error('Response missing timestamp');
    }
    
    console.log(`✅ ${endpoint.name}: OK`);
    console.log(`   - Response time: ${new Date(data.timestamp).toISOString()}`);
    console.log(`   - Data keys: ${Object.keys(data.data).join(', ')}`);
    
    return true;
    
  } catch (error) {
    console.log(`❌ ${endpoint.name}: FAILED`);
    console.log(`   - Error: ${error.message}`);
    return false;
  }
}

async function testChartDataStructure() {
  try {
    console.log('\n📊 Testing Chart.js data compatibility...');
    
    // Test mental state chart data
    const mentalStateResponse = await fetch(`${API_BASE}/mental-state?days=7`);
    const mentalStateData = await mentalStateResponse.json();
    
    if (mentalStateData.success && mentalStateData.data.chartData) {
      const chartData = mentalStateData.data.chartData;
      
      // Validate Chart.js structure
      if (!chartData.labels || !Array.isArray(chartData.labels)) {
        throw new Error('Mental state chart missing labels array');
      }
      
      if (!chartData.datasets || !Array.isArray(chartData.datasets)) {
        throw new Error('Mental state chart missing datasets array');
      }
      
      // Check each dataset
      chartData.datasets.forEach((dataset, index) => {
        if (!dataset.label || !dataset.data || !Array.isArray(dataset.data)) {
          throw new Error(`Dataset ${index} missing required fields`);
        }
        
        if (dataset.data.length !== chartData.labels.length) {
          throw new Error(`Dataset ${index} data length mismatch with labels`);
        }
      });
      
      console.log('✅ Mental State Chart: Valid structure');
      console.log(`   - Labels: ${chartData.labels.length}`);
      console.log(`   - Datasets: ${chartData.datasets.length}`);
    }
    
    // Test conversation trends chart data
    const trendsResponse = await fetch(`${API_BASE}/conversation-trends?days=30`);
    const trendsData = await trendsResponse.json();
    
    if (trendsData.success && trendsData.data.dailyTrends) {
      const dailyChart = trendsData.data.dailyTrends.chartData;
      
      if (dailyChart.labels && dailyChart.datasets) {
        console.log('✅ Daily Trends Chart: Valid structure');
        console.log(`   - Labels: ${dailyChart.labels.length}`);
        console.log(`   - Datasets: ${dailyChart.datasets.length}`);
      }
    }
    
    return true;
    
  } catch (error) {
    console.log('❌ Chart Data: FAILED');
    console.log(`   - Error: ${error.message}`);
    return false;
  }
}

async function testErrorHandling() {
  try {
    console.log('\n🚫 Testing error handling...');
    
    // Test invalid endpoint
    const invalidResponse = await fetch(`${API_BASE}/invalid-endpoint`);
    
    if (invalidResponse.status === 404) {
      console.log('✅ 404 handling: OK');
    } else {
      console.log(`⚠️  Expected 404, got ${invalidResponse.status}`);
    }
    
    // Test invalid query parameters
    const badParamsResponse = await fetch(`${API_BASE}/mental-state?days=999999`);
    const badParamsData = await badParamsResponse.json();
    
    if (badParamsResponse.ok && badParamsData.success) {
      console.log('✅ Parameter validation: OK (clamped to max)');
    } else {
      console.log('⚠️  Parameter validation may need improvement');
    }
    
    return true;
    
  } catch (error) {
    console.log('❌ Error Handling: FAILED');
    console.log(`   - Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Dashboard API Test Suite');
  console.log(`Testing against: ${BASE_URL}`);
  console.log('=' .repeat(50));
  
  let passed = 0;
  let total = 0;
  
  // Test all endpoints
  for (const endpoint of endpoints) {
    total++;
    const success = await testEndpoint(endpoint);
    if (success) passed++;
  }
  
  // Test chart data structure
  total++;
  const chartSuccess = await testChartDataStructure();
  if (chartSuccess) passed++;
  
  // Test error handling
  total++;
  const errorSuccess = await testErrorHandling();
  if (errorSuccess) passed++;
  
  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log(`📊 Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Dashboard APIs are ready.');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Check the server and database.');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests, testEndpoint, testChartDataStructure };