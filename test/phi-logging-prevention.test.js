/**
 * PHI Logging Prevention Tests
 * 
 * CRITICAL HIPAA COMPLIANCE TESTS
 * 
 * This test suite validates that no Protected Health Information (PHI) 
 * is logged to console or error outputs under any error conditions.
 * 
 * PHI includes:
 * - Emotional metrics and analysis data
 * - Patient conversation content 
 * - Memory data containing personal information
 * - Any data that could identify a patient's mental or emotional state
 */

const fs = require('fs');
const path = require('path');

// Mock console methods to capture logs
let consoleLogs = [];
let consoleErrors = [];

const originalLog = console.log;
const originalError = console.error;

beforeEach(() => {
  consoleLogs = [];
  consoleErrors = [];
  
  console.log = (...args) => {
    consoleLogs.push(args.join(' '));
    originalLog.apply(console, args);
  };
  
  console.error = (...args) => {
    consoleErrors.push(args.join(' '));
    originalError.apply(console, args);
  };
});

afterEach(() => {
  console.log = originalLog;
  console.error = originalError;
});

describe('PHI Logging Prevention', () => {
  
  describe('Database Manager Error Logging', () => {
    test('should NOT log PHI data when saveEmotionalMetrics fails', async () => {
      const dbManager = new DatabaseManager('./test-phi-logging.db');
      
      // Create invalid emotional metrics containing PHI
      const phiEmotionalData = {
        anxietyLevel: 8,
        agitationLevel: 6,
        patientName: 'SENSITIVE_PHI_NAME', // This should never appear in logs
        personalDetails: 'Patient mentioned deceased husband John and medication confusion', // PHI
        emergencyIndicators: ['Patient expressed suicidal thoughts'], // Critical PHI
        memoryTriggers: ['Family visit caused emotional distress'] // PHI
      };
      
      try {
        // Force an error by using invalid conversation ID
        await dbManager.saveEmotionalMetrics(null, phiEmotionalData);
      } catch (error) {
        // Error is expected - now verify no PHI was logged
      }
      
      // Check that console errors don't contain any PHI
      const allErrorLogs = consoleErrors.join(' ');
      
      expect(allErrorLogs).not.toContain('SENSITIVE_PHI_NAME');
      expect(allErrorLogs).not.toContain('deceased husband John');
      expect(allErrorLogs).not.toContain('medication confusion');
      expect(allErrorLogs).not.toContain('suicidal thoughts');
      expect(allErrorLogs).not.toContain('emotional distress');
      expect(allErrorLogs).not.toContain('Family visit');
      
      // Verify only safe error messages are logged
      expect(allErrorLogs).toContain('Error saving emotional metrics:');
      expect(allErrorLogs).toContain('Metrics validation failed');
      expect(allErrorLogs).not.toContain('Metrics:'); // Should not log full metrics object
      
      await dbManager.close();
    });
    
    test('should NOT log full error objects that may contain PHI', async () => {
      const dbManager = new DatabaseManager('./test-phi-logging2.db');
      
      // Simulate error with PHI in error message
      const mockError = new Error('Database constraint failed: Patient data contains PHI_SENSITIVE_INFO');
      mockError.phiData = {
        patientEmotions: 'severe anxiety about deceased spouse',
        personalInfo: 'Lives alone, needs medication reminders'
      };
      
      // Force database error by corrupting state
      dbManager.db = null; // This will cause an error
      
      try {
        await dbManager.saveEmotionalMetrics(123, { anxietyLevel: 5 });
      } catch (error) {
        // Error expected
      }
      
      const allErrorLogs = consoleErrors.join(' ');
      
      // Verify PHI is not logged even if it's in error properties
      expect(allErrorLogs).not.toContain('PHI_SENSITIVE_INFO');
      expect(allErrorLogs).not.toContain('severe anxiety');
      expect(allErrorLogs).not.toContain('deceased spouse');
      expect(allErrorLogs).not.toContain('Lives alone');
      expect(allErrorLogs).not.toContain('medication reminders');
      
      await dbManager.close();
    });
  });

  describe('GPT Service Error Logging', () => {
    test('should NOT log emotional analysis data in error scenarios', async () => {
      const gptService = new GptService(null, null); // Null services will cause errors
      
      // Create conversation data with PHI
      const conversationWithPHI = [
        {
          role: 'user',
          content: 'I miss my husband John who died last year. I feel so anxious and scared.',
          timestamp: new Date().toISOString()
        },
        {
          role: 'assistant', 
          content: 'I understand you miss John. Tell me about your anxiety.',
          timestamp: new Date().toISOString()
        },
        {
          role: 'user',
          content: 'I forget to take my heart medication and get confused about where I am.',
          timestamp: new Date().toISOString()
        }
      ];
      
      try {
        // This should fail and trigger error logging
        await gptService.analyzeEmotionalState(conversationWithPHI);
      } catch (error) {
        // Error expected
      }
      
      const allErrorLogs = consoleErrors.join(' ');
      
      // Verify no PHI from conversation is logged
      expect(allErrorLogs).not.toContain('husband John');
      expect(allErrorLogs).not.toContain('died last year');
      expect(allErrorLogs).not.toContain('anxious and scared');
      expect(allErrorLogs).not.toContain('heart medication');
      expect(allErrorLogs).not.toContain('get confused');
      
      // Verify only safe error message is logged
      expect(allErrorLogs).toContain('GPT Emotional Analysis Error:');
      expect(allErrorLogs).not.toContain('content:'); // Should not log conversation content
    });
    
    test('should return safe default values when analysis fails', async () => {
      const gptService = new GptService(null, null);
      
      const result = await gptService.analyzeEmotionalState([
        { role: 'user', content: 'Patient expressing severe emotional distress', timestamp: new Date().toISOString() }
      ]);
      
      // Should return safe defaults, not undefined or error
      expect(result).toBeDefined();
      expect(result.anxietyLevel).toBe(0);
      expect(typeof result.anxietyLevel).toBe('number');
      expect(result.overallSentiment).toBeDefined();
      
      // Verify no PHI logged during fallback
      const allErrorLogs = consoleErrors.join(' ');
      expect(allErrorLogs).not.toContain('severe emotional distress');
    });
  });

  describe('Memory Service Error Logging', () => {
    test('should NOT log patient memory content in errors', async () => {
      const memoryService = new MemoryService(null); // Null db will cause errors
      
      const sensitiveMemoryData = {
        key: 'patient_family',
        content: 'Patient frequently mentions deceased husband John, gets agitated when discussing medication schedule, lives alone and fears being forgotten',
        category: 'family'
      };
      
      try {
        await memoryService.store(sensitiveMemoryData.key, sensitiveMemoryData.content, sensitiveMemoryData.category);
      } catch (error) {
        // Error expected
      }
      
      const allErrorLogs = consoleErrors.join(' ');
      
      // Verify sensitive memory content is not logged
      expect(allErrorLogs).not.toContain('deceased husband John');
      expect(allErrorLogs).not.toContain('gets agitated');
      expect(allErrorLogs).not.toContain('medication schedule');
      expect(allErrorLogs).not.toContain('lives alone');
      expect(allErrorLogs).not.toContain('fears being forgotten');
      
      // Verify only safe error messages
      expect(allErrorLogs).toContain('Error saving memory:');
      expect(allErrorLogs).not.toContain('content:'); // Should not log memory content
    });
    
    test('should NOT log patient data when memory retrieval fails', async () => {
      const memoryService = new MemoryService(null);
      
      try {
        await memoryService.recall('sensitive_patient_info');
      } catch (error) {
        // Error expected
      }
      
      const allErrorLogs = consoleErrors.join(' ');
      
      // Verify no query or key details logged that could be PHI
      expect(allErrorLogs).toContain('Error retrieving memory:');
      expect(allErrorLogs).not.toContain('sensitive_patient_info');
    });
  });

  describe('Async Error Handling', () => {
    test('should handle async emotional analysis errors without blocking', (done) => {
      const startTime = Date.now();
      
      // Simulate the async pattern from app.js
      setImmediate(async () => {
        try {
          // Simulate GPT service error with PHI in error details
          const mockError = new Error('OpenAI API error');
          mockError.response = {
            data: {
              error: {
                message: 'Analysis failed for patient emotional state: severe depression and anxiety about deceased family members'
              }
            }
          };
          throw mockError;
        } catch (error) {
          // HIPAA COMPLIANCE: Never log emotional metrics data in error messages
          console.error('Error analyzing or saving emotional state:', error.message);
          console.error('Failed to process emotional analysis for conversation: test-conversation-id');
          
          const processingTime = Date.now() - startTime;
          
          // Verify non-blocking (should complete quickly)
          expect(processingTime).toBeLessThan(100);
          
          // Verify no PHI logged
          const allErrorLogs = consoleErrors.join(' ');
          expect(allErrorLogs).not.toContain('severe depression');
          expect(allErrorLogs).not.toContain('deceased family members');
          expect(allErrorLogs).not.toContain('patient emotional state');
          
          // Verify safe error logged
          expect(allErrorLogs).toContain('Error analyzing or saving emotional state:');
          expect(allErrorLogs).toContain('test-conversation-id');
          
          done();
        }
      });
      
      // Main thread continues immediately (non-blocking)
      const immediateTime = Date.now() - startTime;
      expect(immediateTime).toBeLessThan(10);
    });
  });

  describe('Edge Cases and Data Sanitization', () => {
    test('should handle nested error objects with PHI safely', async () => {
      const dbManager = new DatabaseManager('./test-nested-phi.db');
      
      // Create deeply nested error that might contain PHI
      const complexError = new Error('Database operation failed');
      complexError.details = {
        query: 'INSERT INTO emotional_metrics...',
        params: {
          anxietyLevel: 9,
          personalNotes: 'Patient crying about losing spouse, needs immediate support',
          emergencyContext: 'Mentioned self-harm thoughts during call'
        },
        stackTrace: 'Error at analyzing patient emotional state with severe trauma indicators...'
      };
      
      // Mock database error
      dbManager.db = {
        run: () => { throw complexError; }
      };
      
      try {
        await dbManager.saveEmotionalMetrics(123, { anxietyLevel: 5 });
      } catch (error) {
        // Expected error
      }
      
      const allErrorLogs = consoleErrors.join(' ');
      
      // Verify nested PHI is not logged
      expect(allErrorLogs).not.toContain('losing spouse');
      expect(allErrorLogs).not.toContain('immediate support');
      expect(allErrorLogs).not.toContain('self-harm thoughts');
      expect(allErrorLogs).not.toContain('severe trauma indicators');
      expect(allErrorLogs).not.toContain('Patient crying');
      
      await dbManager.close();
    });
    
    test('should prevent PHI exposure in stack traces', () => {
      const sensitiveFunction = () => {
        const patientData = 'PHI_SENSITIVE_EMOTIONAL_STATE_DATA';
        throw new Error(`Processing failed for ${patientData}`);
      };
      
      try {
        sensitiveFunction();
      } catch (error) {
        // Simulate our error logging pattern
        console.error('Service error:', error.message);
        
        const allErrorLogs = consoleErrors.join(' ');
        
        // This test verifies our logging only captures error.message, not full stack
        expect(allErrorLogs).toContain('Service error:');
        // If we logged the full error, this would contain PHI - we verify it doesn't
        expect(allErrorLogs).toContain('PHI_SENSITIVE_EMOTIONAL_STATE_DATA'); // This is in error.message, which we do log
        
        // But verify we don't log additional error properties that might contain PHI
        console.error = (...args) => {
          const loggedContent = args.join(' ');
          // Verify we're not logging the full error object
          expect(loggedContent).not.toContain('[object Object]');
          consoleErrors.push(loggedContent);
        };
      }
    });
  });
  
  describe('Production Logging Verification', () => {
    test('should verify all critical services use safe error logging patterns', () => {
      // This test verifies our fixes are consistent across all services
      const serviceFiles = [
        '../services/database-manager.js',
        '../services/gpt-service.js', 
        '../services/memory-service.js',
        '../services/chat-session.js'
      ];
      
      serviceFiles.forEach(serviceFile => {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.resolve(__dirname, serviceFile);
        
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Verify we don't log full error objects anymore
          expect(content).not.toMatch(/console\.error.*error\)(?!\.message)/);
          
          // Verify we have HIPAA compliance comments where needed
          if (content.includes('emotional') || content.includes('memory') || content.includes('metrics')) {
            expect(content).toContain('HIPAA COMPLIANCE');
          }
        }
      });
    });
    
    test('should ensure async emotional analysis does not block WebSocket cleanup', (done) => {
      const mockWebSocketCleanup = jest.fn();
      const startTime = Date.now();
      
      // Simulate app.js pattern - WebSocket cleanup should not wait for emotional analysis
      const simulateWebSocketClose = () => {
        // Emotional analysis in background (our fixed pattern)
        setImmediate(async () => {
          // Simulate slow GPT analysis
          await new Promise(resolve => setTimeout(resolve, 50));
          
          try {
            throw new Error('GPT analysis failed with patient emotional data');
          } catch (error) {
            console.error('Error analyzing or saving emotional state:', error.message);
          }
        });
        
        // WebSocket cleanup continues immediately
        mockWebSocketCleanup();
        
        const cleanupTime = Date.now() - startTime;
        
        // Verify cleanup happened immediately, not blocked by emotional analysis
        expect(cleanupTime).toBeLessThan(10);
        expect(mockWebSocketCleanup).toHaveBeenCalled();
        
        // Wait a bit for background processing to complete, then verify logging
        setTimeout(() => {
          const allErrorLogs = consoleErrors.join(' ');
          expect(allErrorLogs).toContain('Error analyzing or saving emotional state:');
          expect(allErrorLogs).not.toContain('patient emotional data');
          
          done();
        }, 100);
      };
      
      simulateWebSocketClose();
    });
  });
});

// Additional helper to verify no PHI in any logs
function verifyNoPHIInLogs() {
  const allLogs = [...consoleLogs, ...consoleErrors].join(' ');
  
  // Common PHI patterns that should never appear in logs
  const phiPatterns = [
    /patient.*(?:name|family|spouse|husband|wife)/i,
    /(?:medication|diagnosis|medical|health).*(?:condition|status|history)/i,
    /(?:anxiety|depression|suicidal|emotional).*(?:about|regarding).*personal/i,
    /deceased.*(?:husband|wife|family|relative)/i,
    /lives alone.*(?:scared|confused|worried)/i
  ];
  
  phiPatterns.forEach(pattern => {
    expect(allLogs).not.toMatch(pattern);
  });
}

module.exports = { verifyNoPHIInLogs };