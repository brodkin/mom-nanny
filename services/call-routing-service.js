const VoiceResponse = require('twilio').twiml.VoiceResponse;

/**
 * Call Routing Service
 * 
 * Handles routing decisions for incoming calls based on various conditions
 * Each routing outcome is implemented in its own method for maintainability
 */
class CallRoutingService {
  
  /**
   * Determine the appropriate routing for an incoming call
   * @param {Object} callStats - Today's call statistics from database
   * @param {number} callStats.callsToday - Number of calls today
   * @param {string} callStats.lastCallTime - Last call timestamp
   * @returns {Object} Routing decision object
   */
  determineRoute(callStats) {
    const callsToday = callStats?.callsToday || 1;
    
    console.log(`📞 Call routing: ${callsToday} calls today`.cyan);
    
    // If more than 10 calls today, ring forever
    if (callsToday > 10) {
      console.log(`🚫 Call limit exceeded (${callsToday} > 10) - routing to ring forever`.yellow);
      return {
        type: 'ring_forever',
        reason: `Call limit exceeded: ${callsToday} calls today`,
        callsToday
      };
    }
    
    // Default: connect with progressive delay
    const delaySeconds = Math.max(3, callsToday * 3);
    console.log(`✅ Normal routing - ${delaySeconds}s delay (call #${callsToday})`.green);
    
    return {
      type: 'connect',
      delaySeconds,
      reason: 'Normal connect with progressive delay',
      callsToday
    };
  }
  
  /**
   * Build TwiML response based on routing decision
   * @param {Object} routingDecision - Decision from determineRoute()
   * @returns {VoiceResponse} TwiML response object
   */
  buildTwiMLResponse(routingDecision, persona = 'jessica') {
    switch (routingDecision.type) {
    case 'connect':
      return this.createConnectResponse(routingDecision.delaySeconds, persona);
      
    case 'ring_forever':
      return this.createRingForeverResponse();
      
    default:
      console.log(`⚠️  Unknown routing type: ${routingDecision.type}, falling back to connect`.yellow);
      return this.createConnectResponse(3, persona); // Fallback to minimum delay
    }
  }
  
  /**
   * Create TwiML response for normal connection with progressive delay
   * This is the default behavior that was previously in the /incoming endpoint
   * @param {number} delaySeconds - Seconds to pause before connecting
   * @returns {VoiceResponse} TwiML response for connection
   */
  createConnectResponse(delaySeconds, persona = 'jessica') {
    console.log(`🔗 Creating connect response with ${delaySeconds}s delay, persona: ${persona}`.magenta);
    
    const response = new VoiceResponse();
    response.pause({ length: delaySeconds });
    const connect = response.connect();
    const stream = connect.stream({ url: `wss://${process.env.SERVER}/connection` });
    
    // Pass persona as custom parameter to WebSocket connection
    stream.parameter({ name: 'persona', value: persona });
    
    return response;
  }
  
  /**
   * Create TwiML response that rings "forever" then hangs up
   * Uses maximum practical pause duration (600s = 10 minutes) followed by hangup
   * @returns {VoiceResponse} TwiML response for ring forever
   */
  createRingForeverResponse() {
    console.log('☎️  Creating ring forever response (600s pause)'.red);
    
    const response = new VoiceResponse();
    // Ring for 10 minutes (600 seconds) then hang up
    response.pause({ length: 600 });
    response.hangup();
    
    return response;
  }
  
  /**
   * Create fallback TwiML response for error conditions
   * Always provides minimum viable connection to prevent complete failure
   * @returns {VoiceResponse} Fallback TwiML response
   */
  createFallbackResponse(persona = 'jessica') {
    console.log(`🆘 Creating fallback response (3s delay + connect), persona: ${persona}`.yellow);
    
    const response = new VoiceResponse();
    response.pause({ length: 3 });
    const connect = response.connect();
    const stream = connect.stream({ url: `wss://${process.env.SERVER}/connection` });
    
    // Pass persona as custom parameter to WebSocket connection
    stream.parameter({ name: 'persona', value: persona });
    
    return response;
  }
}

module.exports = CallRoutingService;