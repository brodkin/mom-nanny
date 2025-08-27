const CallRoutingService = require('../services/call-routing-service');
const twilio = require('twilio');

// Mock Twilio
jest.mock('twilio', () => ({
  twiml: {
    VoiceResponse: jest.fn(() => ({
      pause: jest.fn(),
      hangup: jest.fn(),
      connect: jest.fn(() => ({
        stream: jest.fn(() => ({
          parameter: jest.fn()
        }))
      })),
      toString: jest.fn(() => '<Response><Connect><Stream></Stream></Connect></Response>')
    }))
  }
}));

describe('Call Routing Persona Integration', () => {
  let routingService;
  let mockResponse;
  let mockStream;

  beforeEach(() => {
    routingService = new CallRoutingService();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Set up mock chain
    mockStream = {
      parameter: jest.fn()
    };
    
    const mockConnect = {
      stream: jest.fn(() => mockStream)
    };
    
    mockResponse = {
      pause: jest.fn(),
      hangup: jest.fn(),
      connect: jest.fn(() => mockConnect),
      toString: jest.fn(() => '<Response><Connect><Stream></Stream></Connect></Response>')
    };
    
    twilio.twiml.VoiceResponse.mockReturnValue(mockResponse);
  });

  describe('buildTwiMLResponse with persona', () => {
    test('should handle connect routing decision with default jessica persona', () => {
      const routingDecision = {
        type: 'connect',
        delaySeconds: 0
      };

      routingService.buildTwiMLResponse(routingDecision);

      expect(twilio.twiml.VoiceResponse).toHaveBeenCalled();
      expect(mockResponse.connect).toHaveBeenCalled();
      expect(mockStream.parameter).toHaveBeenCalledWith({ name: 'persona', value: 'jessica' });
    });

    test('should handle connect routing decision with custom persona', () => {
      const routingDecision = {
        type: 'connect',
        delaySeconds: 2
      };

      routingService.buildTwiMLResponse(routingDecision, 'sarah');

      expect(mockStream.parameter).toHaveBeenCalledWith({ name: 'persona', value: 'sarah' });
    });

    test('should handle ring_forever routing decision', () => {
      const routingDecision = {
        type: 'ring_forever'
      };

      routingService.buildTwiMLResponse(routingDecision, 'nurse-emily');

      // ring_forever doesn't use persona, so parameter shouldn't be called
      expect(mockStream.parameter).not.toHaveBeenCalled();
    });

    test('should handle fallback routing with persona', () => {
      const routingDecision = {
        type: 'unknown',
        delaySeconds: 1
      };

      routingService.buildTwiMLResponse(routingDecision, 'custom-persona');

      // Should fall back to connect with 3s delay
      expect(mockStream.parameter).toHaveBeenCalledWith({ name: 'persona', value: 'custom-persona' });
    });
  });

  describe('createConnectResponse with persona', () => {
    test('should create connect response with default persona', () => {
      routingService.createConnectResponse(0);

      expect(mockStream.parameter).toHaveBeenCalledWith({ name: 'persona', value: 'jessica' });
      expect(mockResponse.pause).toHaveBeenCalledWith({ length: 0 });
    });

    test('should create connect response with custom persona', () => {
      routingService.createConnectResponse(5, 'dr-williams');

      expect(mockStream.parameter).toHaveBeenCalledWith({ name: 'persona', value: 'dr-williams' });
      expect(mockResponse.pause).toHaveBeenCalledWith({ length: 5 });
    });

    test('should handle zero delay with persona', () => {
      routingService.createConnectResponse(0, 'therapist-anna');

      expect(mockStream.parameter).toHaveBeenCalledWith({ name: 'persona', value: 'therapist-anna' });
      expect(mockResponse.pause).toHaveBeenCalledWith({ length: 0 });
    });

    test('should handle large delays with persona', () => {
      routingService.createConnectResponse(30, 'companion-bot');

      expect(mockStream.parameter).toHaveBeenCalledWith({ name: 'persona', value: 'companion-bot' });
      expect(mockResponse.pause).toHaveBeenCalledWith({ length: 30 });
    });
  });

  describe('createFallbackResponse with persona', () => {
    test('should create fallback response with default persona', () => {
      routingService.createFallbackResponse();

      expect(mockStream.parameter).toHaveBeenCalledWith({ name: 'persona', value: 'jessica' });
      expect(mockResponse.pause).toHaveBeenCalledWith({ length: 3 });
    });

    test('should create fallback response with custom persona', () => {
      routingService.createFallbackResponse('emergency-nurse');

      expect(mockStream.parameter).toHaveBeenCalledWith({ name: 'persona', value: 'emergency-nurse' });
      expect(mockResponse.pause).toHaveBeenCalledWith({ length: 3 });
    });

    test('should always use 3-second delay for fallback regardless of persona', () => {
      routingService.createFallbackResponse('persona1');
      
      // Clear mocks between calls
      jest.clearAllMocks();
      
      routingService.createFallbackResponse('persona2');

      expect(mockResponse.pause).toHaveBeenCalledWith({ length: 3 });
      expect(mockStream.parameter).toHaveBeenCalledWith({ name: 'persona', value: 'persona2' });
    });
  });

  describe('Persona parameter validation', () => {
    test('should handle null persona gracefully', () => {
      const routingDecision = { type: 'connect', delaySeconds: 0 };
      routingService.buildTwiMLResponse(routingDecision, null);

      expect(mockStream.parameter).toHaveBeenCalledWith({ name: 'persona', value: null });
    });

    test('should handle undefined persona gracefully (uses default)', () => {
      const routingDecision = { type: 'connect', delaySeconds: 0 };
      routingService.buildTwiMLResponse(routingDecision, undefined);

      // When undefined is passed, the default parameter 'jessica' should be used
      expect(mockStream.parameter).toHaveBeenCalledWith({ name: 'persona', value: 'jessica' });
    });

    test('should handle empty string persona', () => {
      const routingDecision = { type: 'connect', delaySeconds: 0 };
      routingService.buildTwiMLResponse(routingDecision, '');

      expect(mockStream.parameter).toHaveBeenCalledWith({ name: 'persona', value: '' });
    });

    test('should handle numeric persona', () => {
      const routingDecision = { type: 'connect', delaySeconds: 0 };
      routingService.buildTwiMLResponse(routingDecision, 123);

      expect(mockStream.parameter).toHaveBeenCalledWith({ name: 'persona', value: 123 });
    });

    test('should handle boolean persona', () => {
      const routingDecision = { type: 'connect', delaySeconds: 0 };
      routingService.buildTwiMLResponse(routingDecision, true);

      expect(mockStream.parameter).toHaveBeenCalledWith({ name: 'persona', value: true });
    });

    test('should handle object persona', () => {
      const routingDecision = { type: 'connect', delaySeconds: 0 };
      const personaObject = { name: 'jessica', type: 'nurse' };
      routingService.buildTwiMLResponse(routingDecision, personaObject);

      expect(mockStream.parameter).toHaveBeenCalledWith({ name: 'persona', value: personaObject });
    });
  });

  describe('TwiML Structure Validation', () => {
    test('should generate valid TwiML structure with persona parameter', () => {
      const routingDecision = { type: 'connect', delaySeconds: 2 };
      routingService.buildTwiMLResponse(routingDecision, 'test-persona');

      // Verify TwiML response was created
      expect(twilio.twiml.VoiceResponse).toHaveBeenCalled();
      expect(mockResponse.connect).toHaveBeenCalled();
      expect(mockStream.parameter).toHaveBeenCalledTimes(1); // Only persona parameter is set
      expect(mockStream.parameter).toHaveBeenCalledWith({ name: 'persona', value: 'test-persona' });
    });

    test('should return TwiML response object directly', () => {
      const routingDecision = { type: 'connect', delaySeconds: 1 };
      const result = routingService.buildTwiMLResponse(routingDecision, 'test');

      // Should return the response object, not call toString automatically
      expect(result).toBe(mockResponse);
      expect(mockResponse.toString).not.toHaveBeenCalled();
    });
  });

  describe('Integration with routing decisions', () => {
    test('should preserve persona through all routing decision types', () => {
      const testPersona = 'integration-test-persona';

      // Test connect type
      const connectDecision = { type: 'connect', delaySeconds: 0 };
      routingService.buildTwiMLResponse(connectDecision, testPersona);
      expect(mockStream.parameter).toHaveBeenCalledWith({ name: 'persona', value: testPersona });

      // Clear mocks for next test
      jest.clearAllMocks();

      // Test ring_forever type (doesn't use persona)
      const ringForeverDecision = { type: 'ring_forever' };
      routingService.buildTwiMLResponse(ringForeverDecision, testPersona);
      expect(mockStream.parameter).not.toHaveBeenCalled(); // ring_forever doesn't use persona

      // Clear mocks for next test
      jest.clearAllMocks();

      // Test fallback (unknown type)
      const unknownDecision = { type: 'unknown', delaySeconds: 10 };
      routingService.buildTwiMLResponse(unknownDecision, testPersona);
      expect(mockStream.parameter).toHaveBeenCalledWith({ name: 'persona', value: testPersona });
    });

    test('should handle different delay values with same persona', () => {
      const testPersona = 'delay-test-persona';
      const delays = [0, 1, 3, 5, 10, 30];

      delays.forEach(delay => {
        jest.clearAllMocks();
        
        const decision = { type: 'connect', delaySeconds: delay };
        routingService.buildTwiMLResponse(decision, testPersona);
        
        expect(mockStream.parameter).toHaveBeenCalledWith({ name: 'persona', value: testPersona });
        expect(mockResponse.pause).toHaveBeenCalledWith({ length: delay });
      });
    });
  });

  describe('Service behavior verification', () => {
    test('should call console.log during connect response creation', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      routingService.createConnectResponse(2, 'log-test-persona');

      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('should call console.log during fallback response creation', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      routingService.createFallbackResponse('fallback-test-persona');

      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});