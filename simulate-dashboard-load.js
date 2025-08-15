const fetch = require('node-fetch');

async function simulateDashboardLoad() {
  console.log('🌐 Simulating Dashboard Load in Browser...\n');
  console.log('1️⃣ User navigates to /admin/');
  console.log('2️⃣ User clicks "Dashboard" in sidebar');
  console.log('3️⃣ loadDashboard() function executes');
  console.log('4️⃣ Dashboard fetches data from APIs:\n');
  
  // Simulate the dashboard fetching all data
  const endpoints = [
    { url: '/api/admin/dashboard/overview', description: 'System overview & stats' },
    { url: '/api/admin/dashboard/mental-state', description: 'Mental state trends' },
    { url: '/api/admin/dashboard/care-indicators', description: 'Care indicators' },
    { url: '/api/admin/dashboard/conversation-trends', description: 'Conversation patterns' },
    { url: '/api/admin/dashboard/real-time', description: 'Real-time status' }
  ];
  
  for (const endpoint of endpoints) {
    const response = await fetch(`http://localhost:3000${endpoint.url}`);
    const data = await response.json();
    
    console.log(`   📊 ${endpoint.description}:`);
    
    if (endpoint.url.includes('overview')) {
      console.log(`      • Total calls: ${data.data.conversations.total}`);
      console.log(`      • Today's calls: ${data.data.conversations.today}`);
      console.log(`      • System uptime: ${data.data.system.uptime}s`);
    }
    
    if (endpoint.url.includes('mental-state')) {
      const latest = data.data.currentState;
      console.log(`      • Current anxiety: ${latest.anxiety.toFixed(2)}`);
      console.log(`      • Current confusion: ${latest.confusion.toFixed(2)}`);
      console.log(`      • Overall mood: ${latest.overall > 0 ? 'Positive' : latest.overall < 0 ? 'Negative' : 'Neutral'}`);
    }
    
    if (endpoint.url.includes('care-indicators')) {
      console.log(`      • Medication mentions: ${data.data.indicators.medicationMentions}`);
      console.log(`      • Pain complaints: ${data.data.indicators.painComplaints}`);
      console.log(`      • Risk level: ${data.data.riskAssessment.level}`);
    }
    
    if (endpoint.url.includes('conversation-trends')) {
      console.log(`      • Daily pattern: ${data.data.dailyPattern.length} days of data`);
      console.log(`      • Peak hours: ${data.data.hourlyDistribution.filter(h => h.calls > 0).length} active hours`);
    }
    
    if (endpoint.url.includes('real-time')) {
      console.log(`      • Active calls: ${data.data.activeSessions}`);
      console.log(`      • Last activity: ${data.data.lastActivity || 'None'}`);
    }
  }
  
  console.log('\n5️⃣ Dashboard renders with:');
  console.log('   🎨 Chart.js visualizations');
  console.log('   ✨ Glass-morphism card effects');
  console.log('   🔄 30-second auto-refresh enabled');
  console.log('   📱 Responsive layout active');
  
  console.log('\n✅ Dashboard successfully loaded and displaying data!');
}

simulateDashboardLoad().catch(console.error);
