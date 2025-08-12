/**
 * Mock data generator for testing conversation analysis and storage
 * Generates realistic conversation patterns for dementia care scenarios
 */

function generateMockConversation() {
  return {
    callSid: 'mock-' + Math.random().toString(36).substr(2, 9),
    startTime: Date.now() - 300000, // 5 minutes ago
    interactions: [
      { type: 'user', text: "Hello? Who is this?", timestamp: Date.now() - 290000 },
      { type: 'assistant', text: "Hi Francine! It's Jessica. How are you today?", timestamp: Date.now() - 285000 },
      { type: 'user', text: "I need my medicine. They won't give it to me.", timestamp: Date.now() - 280000 },
      { type: 'assistant', text: "I understand that's frustrating. The nurses will help with that. Did you have lunch today?", timestamp: Date.now() - 275000 },
      { type: 'user', text: "I don't know. Where is Ryan?", timestamp: Date.now() - 270000 },
      { type: 'assistant', text: "Ryan is at work right now. He asked me to call and check on you. Tell me about your dog.", timestamp: Date.now() - 265000 },
      { type: 'user', text: "I had a dog. A golden retriever. So beautiful.", timestamp: Date.now() - 260000 },
      { type: 'interruption', timestamp: Date.now() - 255000 },
      { type: 'user', text: "Where is Ryan? I need to talk to Ryan.", timestamp: Date.now() - 250000 }
    ]
  };
}

function generateAnxietyConversation() {
  return {
    callSid: 'anxiety-' + Math.random().toString(36).substr(2, 9),
    startTime: Date.now() - 600000, // 10 minutes ago
    interactions: [
      { type: 'user', text: "I'm scared. Something is wrong.", timestamp: Date.now() - 590000 },
      { type: 'assistant', text: "I hear that you're feeling scared. You're safe. Tell me what's worrying you.", timestamp: Date.now() - 585000 },
      { type: 'user', text: "The people here are mean to me. I want to go home.", timestamp: Date.now() - 580000 },
      { type: 'assistant', text: "That sounds really hard. Everyone at your place is trying to help you. Would you like to talk about something nice? How about Hawaii?", timestamp: Date.now() - 575000 },
      { type: 'user', text: "Hawaii was beautiful. The beaches...", timestamp: Date.now() - 570000 },
      { type: 'assistant', text: "That sounds wonderful! What was your favorite part about the beaches?", timestamp: Date.now() - 565000 },
      { type: 'user', text: "I'm still scared though. When will Ryan come?", timestamp: Date.now() - 560000 },
      { type: 'assistant', text: "Ryan loves you very much. He'll visit when he can. You're safe right now. The sun in Hawaii must have felt so warm.", timestamp: Date.now() - 555000 }
    ]
  };
}

function generateRepetitiveConversation() {
  return {
    callSid: 'repetitive-' + Math.random().toString(36).substr(2, 9),
    startTime: Date.now() - 480000, // 8 minutes ago
    interactions: [
      { type: 'user', text: "Where is Ryan?", timestamp: Date.now() - 470000 },
      { type: 'assistant', text: "Ryan is at work today. How are you feeling?", timestamp: Date.now() - 465000 },
      { type: 'user', text: "Where is Ryan? I need him.", timestamp: Date.now() - 460000 },
      { type: 'assistant', text: "I know you miss Ryan. He's working but thinking of you. Did you eat breakfast?", timestamp: Date.now() - 455000 },
      { type: 'user', text: "Where is Ryan?", timestamp: Date.now() - 450000 },
      { type: 'assistant', text: "Ryan will call you later. Would you like to talk about your dog instead?", timestamp: Date.now() - 445000 },
      { type: 'user', text: "I had a beautiful dog. But where is Ryan?", timestamp: Date.now() - 440000 },
      { type: 'assistant', text: "Your dog sounds lovely! Ryan is safe at work. Tell me more about your dog.", timestamp: Date.now() - 435000 }
    ]
  };
}

function generateMedicationConversation() {
  return {
    callSid: 'medication-' + Math.random().toString(36).substr(2, 9),
    startTime: Date.now() - 420000, // 7 minutes ago
    interactions: [
      { type: 'user', text: "I need my pills. They're hiding my medicine.", timestamp: Date.now() - 410000 },
      { type: 'assistant', text: "That sounds frustrating. The nurses will help make sure you get your medicine on schedule.", timestamp: Date.now() - 405000 },
      { type: 'user', text: "But I need them now. My head hurts.", timestamp: Date.now() - 400000 },
      { type: 'assistant', text: "I understand you're not feeling well. Let's call a nurse to help you. While we wait, would you like to talk about something pleasant?", timestamp: Date.now() - 395000 },
      { type: 'user', text: "I used to grow roses. Beautiful roses.", timestamp: Date.now() - 390000 },
      { type: 'assistant', text: "Roses sound beautiful! What colors did you grow?", timestamp: Date.now() - 385000 },
      { type: 'user', text: "Red ones. Pink ones. But I still need my medicine.", timestamp: Date.now() - 380000 },
      { type: 'assistant', text: "Those roses must have been gorgeous. A nurse will help you with your medicine. Tell me more about your garden.", timestamp: Date.now() - 375000 }
    ]
  };
}

function generateConfusionConversation() {
  return {
    callSid: 'confusion-' + Math.random().toString(36).substr(2, 9),
    startTime: Date.now() - 360000, // 6 minutes ago
    interactions: [
      { type: 'user', text: "I don't know where I am. This isn't my house.", timestamp: Date.now() - 350000 },
      { type: 'assistant', text: "It's okay to feel confused sometimes. You're in a safe place where people care about you.", timestamp: Date.now() - 345000 },
      { type: 'user', text: "But where are my things? Where is my car?", timestamp: Date.now() - 340000 },
      { type: 'assistant', text: "Your important things are being taken care of. Would you like to talk about a happy memory?", timestamp: Date.now() - 335000 },
      { type: 'user', text: "I remember dancing with my husband.", timestamp: Date.now() - 330000 },
      { type: 'assistant', text: "That sounds like a wonderful memory! What kind of dancing did you do?", timestamp: Date.now() - 325000 },
      { type: 'user', text: "Swing dancing. But I'm still confused about where I am.", timestamp: Date.now() - 320000 },
      { type: 'assistant', text: "Swing dancing must have been so much fun! You're somewhere safe now, and that's what matters most.", timestamp: Date.now() - 315000 }
    ]
  };
}

function generateSummaryData() {
  return {
    callSid: 'summary-' + Math.random().toString(36).substr(2, 9),
    phoneNumber: '+1234567890',
    startTime: new Date('2024-01-15T14:30:00').toISOString(),
    endTime: new Date('2024-01-15T14:37:00').toISOString(),
    duration: 420, // 7 minutes
    analysisResults: {
      totalInteractions: 12,
      averageResponseTime: 2.3,
      topics: {
        'medication': { sentiment: -0.4, count: 3 },
        'ryan': { sentiment: 0.1, count: 5 },
        'dogs': { sentiment: 0.8, count: 2 },
        'anxiety': { sentiment: -0.7, count: 2 }
      },
      emotionalState: {
        overall: 'anxious',
        patterns: ['repetitive_questions', 'medication_concerns', 'family_seeking']
      },
      repetitions: [
        { phrase: 'Where is Ryan?', count: 4, timestamps: [Date.now() - 250000, Date.now() - 200000, Date.now() - 150000, Date.now() - 100000] }
      ],
      successfulRedirections: [
        { strategy: 'Asked about her dog', fromTopic: 'anxiety', toTopic: 'dogs' },
        { strategy: 'Mentioned Hawaii memories', fromTopic: 'medication', toTopic: 'travel' }
      ],
      caregiverInsights: {
        recommendedConversationStarters: [
          'Ask about her golden retriever - always brings joy',
          'Hawaii memories are very positive',
          'She enjoys talking about gardening and roses'
        ],
        topicsToAvoid: [
          'Detailed health discussions - increases anxiety',
          'Complex scheduling or time-related topics'
        ],
        notes: 'Francine responds well to gentle redirection to pleasant memories. Medication concerns are frequent but can be acknowledged and redirected.'
      }
    }
  };
}

// Test data for edge cases
function generateEmptyConversation() {
  return {
    callSid: 'empty-' + Math.random().toString(36).substr(2, 9),
    startTime: Date.now() - 60000,
    interactions: []
  };
}

function generateLongConversation() {
  const interactions = [];
  const phrases = [
    "Where is Ryan?",
    "I need my medicine",
    "I'm scared",
    "Tell me about your dog",
    "Hawaii was beautiful",
    "I don't understand",
    "The nurses are nice",
    "I want to go home"
  ];
  
  for (let i = 0; i < 50; i++) {
    const isUser = i % 2 === 0;
    const phraseIndex = Math.floor(Math.random() * phrases.length);
    interactions.push({
      type: isUser ? 'user' : 'assistant',
      text: phrases[phraseIndex],
      timestamp: Date.now() - (50 - i) * 10000
    });
  }
  
  return {
    callSid: 'long-' + Math.random().toString(36).substr(2, 9),
    startTime: Date.now() - 500000,
    interactions
  };
}

module.exports = {
  generateMockConversation,
  generateAnxietyConversation,
  generateRepetitiveConversation,
  generateMedicationConversation,
  generateConfusionConversation,
  generateSummaryData,
  generateEmptyConversation,
  generateLongConversation
};