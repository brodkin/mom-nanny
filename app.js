require('dotenv').config();
require('colors');

const express = require('express');
const ExpressWs = require('express-ws');

const { GptService } = require('./services/gpt-service');
const { StreamService } = require('./services/stream-service');
const { TranscriptionService } = require('./services/transcription-service');
const { TextToSpeechService } = require('./services/tts-service');
const { recordingService } = require('./services/recording-service');
const { MarkCompletionService } = require('./services/mark-completion-service');
const ConversationAnalyzer = require('./services/conversation-analyzer');
const SqliteStorageService = require('./services/sqlite-storage-service');
const DatabaseManager = require('./services/database-manager');
const SummaryGenerator = require('./services/summary-generator');
const MemoryService = require('./services/memory-service');
const CallRoutingService = require('./services/call-routing-service');

const VoiceResponse = require('twilio').twiml.VoiceResponse;

const app = express();
ExpressWs(app);

// Admin routes
const adminRouter = require('./routes/admin');
const adminStatsRouter = require('./routes/api/admin-stats');
const adminConfigRouter = require('./routes/api/admin-config');
const adminMemoriesRouter = require('./routes/api/admin-memories');
const adminDashboardRealRouter = require('./routes/api/admin-dashboard-real');
const emotionalMetricsRouter = require('./routes/api/emotional-metrics');
const conversationsRouter = require('./routes/api/conversations');
const searchRouter = require('./routes/api/search');

const PORT = process.env.PORT || 3000;

// Welcome page route - serves the main landing page
app.get('/', (req, res) => {
  try {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nanny - Compassionate AI Companion</title>
        
        <!-- Preload critical resources -->
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
        
        <!-- Meta tags -->
        <meta name="description" content="Compassionate AI companion system providing support for elderly individuals with dementia and anxiety">
        <meta name="theme-color" content="#6366f1">
        
        <!-- Favicon -->
        <link rel="icon" type="image/svg+xml" href="/admin/assets/icons/nanny-logo.svg">
        
        <style>
          /* CSS Variables for consistency */
          :root {
            --color-primary: #6366f1;
            --color-primary-dark: #4f46e5;
            --color-white: #ffffff;
            --color-gray-50: #f9fafb;
            --color-gray-100: #f3f4f6;
            --color-gray-600: #4b5563;
            --color-gray-800: #1f2937;
            --color-gray-900: #111827;
            --font-family-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            --gradient-primary: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
          }
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: var(--font-family-sans);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--color-gray-900);
            line-height: 1.6;
          }
          
          .welcome-container {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            padding: 4rem 3rem;
            max-width: 600px;
            width: 90%;
            text-align: center;
            box-shadow: var(--shadow-xl);
            border: 1px solid rgba(255, 255, 255, 0.2);
          }
          
          .logo {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 2rem;
            gap: 1rem;
          }
          
          .logo-icon {
            width: 48px;
            height: 48px;
            background: var(--gradient-primary);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 16px rgba(99, 102, 241, 0.3);
          }
          
          .logo-text {
            font-size: 2.25rem;
            font-weight: 700;
            background: var(--gradient-primary);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          
          .welcome-title {
            font-size: 2.5rem;
            font-weight: 600;
            margin-bottom: 1.5rem;
            color: var(--color-gray-900);
            line-height: 1.2;
          }
          
          .welcome-subtitle {
            font-size: 1.25rem;
            color: var(--color-gray-600);
            margin-bottom: 1rem;
            font-weight: 400;
          }
          
          .welcome-description {
            font-size: 1.125rem;
            color: var(--color-gray-600);
            margin-bottom: 3rem;
            line-height: 1.7;
            max-width: 500px;
            margin-left: auto;
            margin-right: auto;
          }
          
          .cta-button {
            display: inline-flex;
            align-items: center;
            gap: 0.75rem;
            background: var(--gradient-primary);
            color: var(--color-white);
            padding: 1rem 2rem;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 600;
            font-size: 1.125rem;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
            border: none;
            cursor: pointer;
          }
          
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
          }
          
          .cta-button:active {
            transform: translateY(0);
          }
          
          .features {
            margin-top: 3rem;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 2rem;
            text-align: center;
          }
          
          .feature {
            padding: 1.5rem 1rem;
            background: rgba(255, 255, 255, 0.5);
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.3);
          }
          
          .feature-icon {
            width: 32px;
            height: 32px;
            margin: 0 auto 1rem;
            color: var(--color-primary);
          }
          
          .feature-title {
            font-size: 1rem;
            font-weight: 600;
            color: var(--color-gray-800);
            margin-bottom: 0.5rem;
          }
          
          .feature-description {
            font-size: 0.875rem;
            color: var(--color-gray-600);
            line-height: 1.5;
          }
          
          @media (max-width: 768px) {
            .welcome-container {
              padding: 2.5rem 2rem;
            }
            
            .welcome-title {
              font-size: 2rem;
            }
            
            .welcome-subtitle {
              font-size: 1.125rem;
            }
            
            .features {
              grid-template-columns: 1fr;
              gap: 1.5rem;
            }
          }
          
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .welcome-container {
            animation: fadeInUp 0.8s ease-out;
          }
        </style>
      </head>
      <body>
        <div class="welcome-container">
          <div class="logo">
            <div class="logo-icon">
              <img src="/admin/assets/icons/nanny-logo.svg" alt="Nanny Logo" style="width: 90%; height: 90%; filter: brightness(0) invert(1);" />
            </div>
            <div class="logo-text">Nanny</div>
          </div>
          
          <h1 class="welcome-title">Welcome to Nanny</h1>
          <p class="welcome-subtitle">Compassionate AI Companion System</p>
          <p class="welcome-description">
            Providing caring, patient support for elderly individuals with dementia and anxiety. 
            Our AI companion is designed to offer comfort, companionship, and assistance when 
            family members cannot be immediately available.
          </p>
          
          <a href="/admin" class="cta-button">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
            Go to Dashboard
          </a>
          
          <div class="features">
            <div class="feature">
              <div class="feature-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
              </div>
              <h3 class="feature-title">Compassionate Care</h3>
              <p class="feature-description">Patient, understanding responses designed for dementia care</p>
            </div>
            
            <div class="feature">
              <div class="feature-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                </svg>
              </div>
              <h3 class="feature-title">Adaptive Learning</h3>
              <p class="feature-description">Remembers preferences and adapts to individual needs</p>
            </div>
            
            <div class="feature">
              <div class="feature-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
              </div>
              <h3 class="feature-title">Safe & Secure</h3>
              <p class="feature-description">HIPAA-compliant with privacy-first design principles</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error serving welcome page:', error);
    res.status(500).json({ error: 'Failed to load welcome page' });
  }
});

// Add JSON parsing middleware for admin API routes
app.use('/admin', express.json());
app.use('/api/admin', express.json());


// Mount admin routes
app.use('/admin', adminRouter);
app.use('/api/admin/stats', adminStatsRouter);
app.use('/api/admin/config', adminConfigRouter);
app.use('/api/admin/memories', adminMemoriesRouter);
app.use('/api/admin/dashboard', adminDashboardRealRouter);

// Mount emotional metrics API routes
app.use('/api/emotional-metrics', emotionalMetricsRouter);

// Mount conversations API routes
app.use('/api/conversations', conversationsRouter);

// Mount search API routes
app.use('/api/search', searchRouter);

// System heartbeat endpoint (directly on admin API)
app.get('/api/admin/heartbeat', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test database connectivity using existing connection pattern
    let dbStatus = 'healthy';
    let dbResponseTime = 0;
    try {
      const dbStartTime = Date.now();
      
      // Use singleton instance for database health check
      const dbManager = DatabaseManager.getInstance();
      const fs = require('fs');
      
      // Check if database file exists and is accessible
      if (!fs.existsSync(dbManager.dbPath)) {
        throw new Error('Database file does not exist');
      }
      
      // Verify database is healthy using built-in health check
      const dbHealthy = await dbManager.isHealthy();
      if (!dbHealthy) {
        throw new Error('Database health check failed');
      }
      
      dbResponseTime = Date.now() - dbStartTime;
    } catch (error) {
      console.warn('Database health check failed:', error);
      dbStatus = 'unhealthy';
      dbResponseTime = Date.now() - startTime;
    }

    // Check system metrics
    const systemStatus = {
      status: 'healthy',
      uptime: Math.floor(process.uptime()),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      cpu: process.cpuUsage()
    };

    // Determine overall health status
    let overallStatus = 'healthy';
    if (dbStatus === 'unhealthy') {
      overallStatus = 'degraded';
    }
    if (systemStatus.memory.used > systemStatus.memory.total * 0.9) {
      overallStatus = overallStatus === 'healthy' ? 'degraded' : 'unhealthy';
    }

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        responseTime,
        services: {
          database: {
            status: dbStatus,
            responseTime: dbResponseTime
          },
          system: systemStatus
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    // HIPAA COMPLIANCE: Never log full error object as it may contain database information
    console.error('Heartbeat check failed:', error.message);
    res.json({
      success: true,
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          database: { status: 'unknown', responseTime: 0 },
          system: { status: 'error', uptime: Math.floor(process.uptime()), memory: {} }
        },
        error: process.env.NODE_ENV === 'development' ? error.message : 'Health check failed'
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Handle incoming calls with routing logic (voicemail behavior)
 * Uses CallRoutingService to determine routing based on call frequency
 */
async function handleIncomingWithRouting(req, res, endpointName = '/incoming', persona = 'jessica') {
  try {
    // Initialize routing service and get call statistics
    const routingService = new CallRoutingService();
    const dbManager = DatabaseManager.getInstance();
    await dbManager.waitForInitialization();
    const callStats = await dbManager.getTodayCallStats();
    
    // Determine routing based on call conditions
    const routingDecision = routingService.determineRoute(callStats);
    console.log(`📋 Routing decision for ${endpointName}: ${routingDecision.type} - ${routingDecision.reason}`.cyan);
    
    // Build and send TwiML response with persona parameter
    const response = routingService.buildTwiMLResponse(routingDecision, persona);
    res.type('text/xml');
    res.end(response.toString());
    
  } catch (err) {
    console.log(`Error in ${endpointName} endpoint:`, err);
    
    // Fallback to routing service's error response
    try {
      const routingService = new CallRoutingService();
      const response = routingService.createFallbackResponse(persona);
      res.type('text/xml');
      res.end(response.toString());
    } catch (fallbackErr) {
      console.log('Error in fallback response:', fallbackErr);
      
      // Ultimate fallback - inline minimal response with persona
      const response = new VoiceResponse();
      response.pause({ length: 3 });
      const connect = response.connect();
      const stream = connect.stream({ url: `wss://${process.env.SERVER}/connection` });
      stream.parameter({ name: 'persona', value: persona });
      res.type('text/xml');
      res.end(response.toString());
    }
  }
}

/**
 * Handle incoming calls with direct connection (persona behavior)
 * Skips routing logic and connects immediately to GPT
 */
async function handleIncomingDirectConnect(req, res, personaName = 'jessica') {
  try {
    console.log(`🎭 Direct connect to persona: ${personaName}`.magenta);
    
    // Create immediate connection response (no routing delays)
    const response = new VoiceResponse();
    const connect = response.connect();
    const stream = connect.stream({ url: `wss://${process.env.SERVER}/connection` });
    
    // Pass persona as custom parameter to WebSocket connection
    stream.parameter({ name: 'persona', value: personaName });
    
    res.type('text/xml');
    res.end(response.toString());
    
  } catch (err) {
    console.log(`Error in /incoming/persona/${personaName} endpoint:`, err);
    
    // Fallback - still connect immediately but log the error
    const response = new VoiceResponse();
    const connect = response.connect();
    const stream = connect.stream({ url: `wss://${process.env.SERVER}/connection` });
    // Include persona parameter in fallback too
    stream.parameter({ name: 'persona', value: personaName });
    res.type('text/xml');
    res.end(response.toString());
  }
}

// DEPRECATED: Original /incoming endpoint - will be replaced by /incoming/voicemail
app.post('/incoming', async (req, res) => {
  console.log('⚠️  DEPRECATED: /incoming endpoint used. Consider migrating to /incoming/voicemail'.yellow);
  await handleIncomingWithRouting(req, res, '/incoming');
});

// NEW: Voicemail behavior (same as original /incoming)
app.post('/incoming/voicemail', async (req, res) => {
  await handleIncomingWithRouting(req, res, '/incoming/voicemail');
});

// NEW: Direct connection to Jessica persona (no routing delays)
app.post('/incoming/persona/jessica', async (req, res) => {
  await handleIncomingDirectConnect(req, res, 'jessica');
});

app.ws('/connection', async (ws) => {
  try {
    ws.on('error', console.error);
    // Filled in from start message
    let streamSid;
    let callSid;

    const markCompletionService = new MarkCompletionService();
    // Initialize SQLite storage using singleton pattern
    // This ensures SQLITE_DB_PATH is honored consistently across all services
    const databaseManager = DatabaseManager.getInstance();
    
    // Wait for database to be initialized
    await databaseManager.waitForInitialization();
    
    const storageService = new SqliteStorageService(databaseManager);
    const summaryGenerator = new SummaryGenerator();
    
    // Create GptService first (without memory service) - persona will be set after start message
    let gptService;
    
    // Create MemoryService (will be linked to GptService after start message)
    let memoryService;
    let conversationAnalyzer; // Will be initialized after callSid is available
    
    // Services will be initialized after start message with persona information
    const streamService = new StreamService(ws);
    const transcriptionService = new TranscriptionService();
    const ttsService = new TextToSpeechService({});

    let marks = [];
    let interactionCount = 0;
    
    // Silence detection variables
    let silenceTimer = null;
    let isWaitingForResponse = false;
    let hasAskedIfPresent = false;

    // Helper functions for silence detection
    const clearSilenceTimer = () => {
      if (silenceTimer) {
        console.log('Clearing silence timer - user is responsive'.cyan);
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
      isWaitingForResponse = false;
    };

    const startSilenceDetection = () => {
      // Don't start if we're already waiting or if there are still active marks
      if (isWaitingForResponse || markCompletionService.getActiveMarkCount() > 0) {
        console.log(`Skipping silence detection: waiting=${isWaitingForResponse}, activeMarks=${markCompletionService.getActiveMarkCount()}`.gray);
        return;
      }
      
      console.log('Starting 5-second silence timer'.cyan);
      isWaitingForResponse = true;
      silenceTimer = setTimeout(() => {
        console.log('5-second silence timeout reached'.yellow);
        if (!isWaitingForResponse) {
          console.log('Timer fired but no longer waiting for response - ignoring'.gray);
          return;
        }
        if (!hasAskedIfPresent) {
          // First silence timeout - ask if user is still there
          hasAskedIfPresent = true;
          console.log('Silence detected - asking if user is still there'.yellow);
          
          const checkMessages = [
            'Hello? Are you still there?',
            'I\'m still here if you need me.',
            'Is everything okay?',
            'Are you still with me?'
          ];
          
          const randomMessage = checkMessages[Math.floor(Math.random() * checkMessages.length)];
          
          // Directly generate TTS for the check message
          ttsService.generate({
            partialResponseIndex: null,
            partialResponse: randomMessage,
            isFinal: true
          }, interactionCount);
          
          // Track this message in the conversation analyzer
          if (conversationAnalyzer) {
            conversationAnalyzer.trackAssistantResponse(randomMessage, new Date());
          }
          
          interactionCount += 1;
          
          // Start another timer for final timeout
          silenceTimer = setTimeout(() => {
            console.log('Final 5-second timeout reached'.yellow);
            if (isWaitingForResponse) {
              console.log('No response received - ending call gracefully'.yellow);
              
              const goodbyeMessages = [
                'I\'ll let you go for now. Take care!',
                'Goodbye for now. I\'m here whenever you need me.',
                'Have a wonderful day. Call me anytime!',
                'Take care, and don\'t hesitate to call if you need anything.'
              ];
              
              const randomGoodbye = goodbyeMessages[Math.floor(Math.random() * goodbyeMessages.length)];
              
              // Send goodbye message
              ttsService.generate({
                partialResponseIndex: null,
                partialResponse: randomGoodbye,
                isFinal: true
              }, interactionCount);
              
              // Track goodbye in conversation analyzer
              if (conversationAnalyzer) {
                conversationAnalyzer.trackAssistantResponse(randomGoodbye, new Date());
              }
              
              interactionCount += 1;
              
              // End the call after the goodbye message completes
              // Wait for the goodbye audio to finish playing, then close the connection
              setTimeout(() => {
                if (ws.readyState === ws.OPEN) {
                  console.log('Closing call due to unresponsive user'.yellow);
                  ws.close();
                }
              }, 3000); // Give time for the goodbye message to play
            }
          }, 5000); // 5 second final timeout
        }
      }, 5000); // 5 second initial timeout
    };

    // Incoming from MediaStream
    ws.on('message', async function message(data) {
      const msg = JSON.parse(data);
      if (msg.event === 'start') {
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;

        // Extract persona from custom parameters (default to 'jessica')
        let persona = 'jessica';
        if (msg.start.customParameters && msg.start.customParameters.persona) {
          persona = msg.start.customParameters.persona;
        }
        console.log(`🎭 Using persona: ${persona}`.magenta);

        // Now create GptService with persona information
        gptService = new GptService(markCompletionService, null, null, databaseManager, persona);
        
        // Create MemoryService with GptService for key generation
        memoryService = new MemoryService(databaseManager, gptService);
        
        // Initialize memory service
        try {
          await memoryService.initialize();
          console.log('Memory service initialized successfully'.cyan);
        } catch (error) {
          // HIPAA COMPLIANCE: Never log full error object as it may contain patient memory data (PHI)
          console.error('Error initializing memory service:', error.message);
          // Continue anyway - memory service will be unavailable but the call should still work
        }
        
        // Set memory service reference in GPT service after initialization
        gptService.memoryService = memoryService;
        if (memoryService) {
          global.memoryService = memoryService;
        }

        streamService.setStreamSid(streamSid);
        gptService.setCallSid(callSid);
        
        // Initialize conversation analyzer
        conversationAnalyzer = new ConversationAnalyzer(callSid, new Date());
        gptService.setConversationAnalyzer(conversationAnalyzer);

        // Initialize GPT service with memory keys
        gptService.initialize().then(() => {
          // Silent initialization - no console output that might leak to chat
        }).catch(error => {
          // HIPAA COMPLIANCE: Never log full error object as it may contain patient data (PHI)
          console.error('Error initializing GPT service:', error.message);
        });

        // Set up service event handlers after services are created
        gptService.on('gptreply', async (gptReply, icount) => {
          console.log(`Interaction ${icount}: GPT -> TTS: ${gptReply.partialResponse}`.green );
          
          // Track assistant response in analyzer
          if (conversationAnalyzer && gptReply.partialResponse) {
            conversationAnalyzer.trackAssistantResponse(gptReply.partialResponse, new Date());
          }
          
          ttsService.generate(gptReply, icount);
        });

        ttsService.on('speech', (responseIndex, audio, label, icount) => {
          console.log(`Interaction ${icount}: TTS -> TWILIO: ${label}`.blue);

          streamService.buffer(responseIndex, audio);
        });

        streamService.on('audiosent', (markLabel) => {
          marks.push(markLabel);
          markCompletionService.addMark(markLabel);
        });

        // Listen for when all audio has completed playing
        markCompletionService.on('all-marks-complete', () => {
          console.log('All audio completed - starting silence detection'.cyan);
          // Small delay to ensure marks array is updated
          setTimeout(() => {
            startSilenceDetection();
          }, 100);
        });

        // Set RECORDING_ENABLED='true' in .env to record calls
        recordingService(ttsService, callSid).then(() => {
          console.log(`Twilio -> Starting Media Stream for ${streamSid}`.underline.red);

          // Variety of natural greetings - like a real person answering
          const greetings = [
            'Hello?',
            'Hi Francine!',
            'Hello Francine!',
            'Hi there!',
            'Hello!',
            'Hi!',
            'Hey there!',
            'Hi Francine, how are you?',
            'Hello Francine, how are you doing?',
            'Hi, how are you?'
          ];

          // Send greeting immediately - delay is now handled by TwiML at /incoming
          const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
          ttsService.generate({partialResponseIndex: null, partialResponse: randomGreeting}, 0);
        });
      } else if (msg.event === 'media') {
        transcriptionService.send(msg.media.payload);
      } else if (msg.event === 'mark') {
        const label = msg.mark.name;
        console.log(`Twilio -> Audio completed mark (${msg.sequenceNumber}): ${label}`.red);
        marks = marks.filter(m => m !== msg.mark.name);
        markCompletionService.removeMark(label);
      } else if (msg.event === 'stop') {
        console.log(`Twilio -> Media stream ${streamSid} ended.`.underline.red);
        // Clean up the transcription service when call ends
        transcriptionService.close();
      }
    });

    transcriptionService.on('utterance', async (text) => {
      // NOTE: Do NOT clear silence timer here - utterance events can be triggered by 
      // audio processing artifacts or background noise, not actual user speech.
      // Only clear on actual transcription events.
      
      // This is a bit of a hack to filter out empty utterances
      if(marks.length > 0 && text?.length > 5) {
        console.log('Twilio -> Interruption, Clearing stream'.red);
        
        // Track interruption in analyzer
        if (conversationAnalyzer) {
          conversationAnalyzer.trackInterruption(new Date());
        }
        
        ws.send(
          JSON.stringify({
            streamSid,
            event: 'clear',
          })
        );
        // Clear transcription buffers on interruption
        transcriptionService.clearBuffers();
      }
    });

    transcriptionService.on('transcription', async (text) => {
      if (!text) { return; }
      console.log(`Interaction ${interactionCount} – STT -> GPT: ${text}`.yellow);
      
      // User provided input - clear silence detection only if we're waiting for response to silence
      if (isWaitingForResponse) {
        console.log('User provided transcription response to silence - clearing timer'.green);
        clearSilenceTimer();
        hasAskedIfPresent = false; // Reset since user is responsive
      }
      
      // Track user utterance in analyzer
      if (conversationAnalyzer) {
        conversationAnalyzer.trackUserUtterance(text, new Date());
      }
      
      gptService.completion(text, interactionCount);
      interactionCount += 1;
    });

    // Clean up when WebSocket closes
    ws.on('close', async () => {
      console.log('WebSocket closed, cleaning up services'.cyan);
      
      // Clear silence detection timer
      clearSilenceTimer();
      
      // Generate and save conversation summary and messages
      if (conversationAnalyzer) {
        try {
          conversationAnalyzer.endTime = new Date();
          
          // Calculate duration and skip save for test calls under 2 seconds
          const duration = (conversationAnalyzer.endTime - conversationAnalyzer.startTime) / 1000;
          if (duration < 2) {
            console.log(`Skipping save: test call under 2 seconds (${duration}s)`.yellow);
            return;
          }
          
          const summary = summaryGenerator.generateSummary(conversationAnalyzer);
          
          const result = await storageService.saveSummary(summary);
          const conversationId = result.conversationId; // String conversation ID
          const numericId = result.numericId; // Numeric ID for messages
          
          console.log(`Conversation summary saved to: ${conversationId}`.green);
          
          // Extract and save conversation messages
          const messages = [];
          
          // Add user utterances
          conversationAnalyzer.userUtterances.forEach(utterance => {
            messages.push({
              role: 'user',
              content: utterance.text,
              timestamp: utterance.timestamp.toISOString()
            });
          });
          
          // Add assistant responses
          conversationAnalyzer.assistantResponses.forEach(response => {
            messages.push({
              role: 'assistant',
              content: response.text,
              timestamp: response.timestamp.toISOString()
            });
          });
          
          // Sort messages by timestamp
          messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          
          // Save messages to database
          if (messages.length > 0) {
            await storageService.saveMessages(numericId, messages);
            console.log(`${messages.length} conversation messages saved to database`.green);
            
            // Analyze emotional state asynchronously to prevent WebSocket cleanup delays
            // HIPAA COMPLIANCE: Process async emotional analysis in background without blocking
            setImmediate(async () => {
              try {
                // Convert messages to the format expected by analyzeEmotionalState
                const interactions = messages.map(msg => ({
                  type: msg.role === 'user' ? 'user_utterance' : 'assistant_response',
                  text: msg.content,
                  timestamp: msg.timestamp
                }));
                
                const emotionalMetrics = await gptService.analyzeEmotionalState(interactions);
                
                // Get database manager instance for emotional metrics
                const dbManager = DatabaseManager.getInstance();
                await dbManager.waitForInitialization();
                await dbManager.saveEmotionalMetrics(numericId, emotionalMetrics);
                
                console.log(`Emotional metrics saved for conversation ${conversationId}`.green);
              } catch (error) {
                // HIPAA COMPLIANCE: Never log emotional metrics data in error messages
                console.error('Error analyzing or saving emotional state:', error.message);
                console.error('Failed to process emotional analysis for conversation:', conversationId);
              }
            });
          }
          
        } catch (error) {
          // HIPAA COMPLIANCE: Never log full error object as it may contain conversation data (PHI)
          console.error('Error saving conversation summary or messages:', error.message);
        }
      }
      
      transcriptionService.close();
      markCompletionService.clearAll();
    });
  } catch (err) {
    console.log(err);
  }
});

// 404 handler for admin routes
app.use('/admin/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Admin endpoint not found',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/admin/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Admin API endpoint not found',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware for admin routes
app.use('/admin', (error, req, res, _next) => {
  // HIPAA COMPLIANCE: Never log full error object as it may contain request data with PHI
  console.error('Admin route error:', error.message);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/admin', (error, req, res, _next) => {
  // HIPAA COMPLIANCE: Never log full error object as it may contain request data with PHI
  console.error('Admin API error:', error.message);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT);
  console.log(`Server running on port ${PORT}`);
}

module.exports = app;
