const fetch = require('node-fetch');

async function testDashboard() {
  console.log('🧪 Testing Dashboard Functionality...\n');
  
  const endpoints = [
    '/api/admin/dashboard/overview',
    '/api/admin/dashboard/mental-state', 
    '/api/admin/dashboard/care-indicators',
    '/api/admin/dashboard/conversation-trends',
    '/api/admin/dashboard/real-time'
  ];
  
  let allPassed = true;
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`http://localhost:3000${endpoint}`);
      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ ${endpoint} - Working`);
        
        // Check for expected data structure
        if (endpoint.includes('overview') && data.data.system) {
          console.log(`   → System status: ${data.data.system.status}`);
        }
        if (endpoint.includes('mental-state') && data.data.mentalStateHistory) {
          console.log(`   → Mental state data points: ${data.data.mentalStateHistory.length}`);
        }
        if (endpoint.includes('care-indicators') && data.data.indicators) {
          console.log(`   → Care indicators tracked`);
        }
      } else {
        console.log(`❌ ${endpoint} - Failed: ${data.error}`);
        allPassed = false;
      }
    } catch (error) {
      console.log(`❌ ${endpoint} - Error: ${error.message}`);
      allPassed = false;
    }
  }
  
  // Test admin page loads
  try {
    const adminResponse = await fetch('http://localhost:3000/admin/');
    const adminHtml = await adminResponse.text();
    
    if (adminHtml.includes('loadDashboard') && adminHtml.includes('dashboard-real.js')) {
      console.log('\n✅ Admin page has dashboard integration');
    } else {
      console.log('\n❌ Admin page missing dashboard integration');
      allPassed = false;
    }
  } catch (error) {
    console.log(`\n❌ Admin page error: ${error.message}`);
    allPassed = false;
  }
  
  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('🎉 All dashboard tests passed!');
  } else {
    console.log('⚠️ Some tests failed - check above for details');
  }
}

testDashboard().catch(console.error);
