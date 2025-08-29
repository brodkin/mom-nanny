require('dotenv').config();
require('colors');

const express = require('express');
const ExpressWs = require('express-ws');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const path = require('path');

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
const VoicemailRecordingService = require('./services/voicemail-recording-service');
const VoicemailTranscriptionCache = require('./services/voicemail-transcription-cache');
const AudioDownloadService = require('./services/audio-download-service');
const WhisperTranscriptionService = require('./services/whisper-transcription-service');

const VoiceResponse = require('twilio').twiml.VoiceResponse;

const app = express();
ExpressWs(app);

// Trust Fly.io proxy for proper HTTPS detection and cookie handling
app.set('trust proxy', true);

// Session configuration for authentication
app.use(session({
  secret: process.env.SESSION_SECRET || 'compassionate-ai-companion-secret-' + Date.now(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevents XSS attacks
    domain: process.env.COOKIE_DOMAIN || undefined, // Configure domain if needed
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours explicit expiration
    sameSite: 'lax' // CSRF protection with better compatibility for proxies
  },
  name: 'companion.sid' // Custom session cookie name
}));

// General rate limiting for the application
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs (~1 per second sustained)
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalRateLimit);

// Admin routes
const adminRouter = require('./routes/admin');
const adminStatsRouter = require('./routes/api/admin-stats');
const adminConfigRouter = require('./routes/api/admin-config');
const adminMemoriesRouter = require('./routes/api/admin-memories');
const adminDashboardRealRouter = require('./routes/api/admin-dashboard-real');
const emotionalMetricsRouter = require('./routes/api/emotional-metrics');
const conversationsRouter = require('./routes/api/conversations');
const searchRouter = require('./routes/api/search');
const authRouter = require('./routes/api/auth');

const PORT = process.env.PORT || 3000;

// Initialize voicemail services
const voicemailRecordingService = new VoicemailRecordingService();
const voicemailTranscriptionCache = new VoicemailTranscriptionCache();
const audioDownloadService = new AudioDownloadService();
const whisperTranscriptionService = new WhisperTranscriptionService();

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
app.use('/api/auth', express.json());

// Serve voicemail audio assets 
const assetsPath = path.join(__dirname, 'assets');
app.use('/assets', express.static(assetsPath));

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

// Mount authentication API routes
app.use('/api/auth', authRouter);

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

/**
 * Handle voicemail recording flow with user greeting and confirmation message
 * Implements the complete voicemail experience:
 * 1. Ring simulation (30 seconds)
 * 2. User's greeting + beep
 * 3. Recording (up to 15 seconds)
 * 4. "Message saved..." confirmation
 * 5. Seamless transition to conversation
 */
async function handleVoicemailRecording(req, res) {
  try {
    console.log('📞 Starting voicemail recording flow'.cyan);
    
    // Step 1: Initial ring simulation
    const ringResponse = voicemailRecordingService.createInitialRingResponse();
    
    res.type('text/xml');
    res.end(ringResponse);
    
  } catch (err) {
    console.log('❌ Error in voicemail recording flow:', err);
    
    // Fallback to legacy behavior if voicemail fails
    console.log('⚠️  Falling back to legacy voicemail flow'.yellow);
    await handleIncomingWithRouting(req, res, '/incoming/voicemail-legacy');
  }
}

// DEPRECATED: Original /incoming endpoint - will be replaced by /incoming/voicemail
app.post('/incoming', async (req, res) => {
  console.log('⚠️  DEPRECATED: /incoming endpoint used. Consider migrating to /incoming/voicemail'.yellow);
  await handleIncomingWithRouting(req, res, '/incoming');
});

// PRESERVED: Legacy voicemail behavior (same as original /incoming)
app.post('/incoming/voicemail-legacy', async (req, res) => {
  await handleIncomingWithRouting(req, res, '/incoming/voicemail-legacy');
});

// NEW: Voicemail recording flow with user greeting and confirmation message
app.post('/incoming/voicemail', async (req, res) => {
  await handleVoicemailRecording(req, res);
});

// NEW: Direct connection to Jessica persona (no routing delays)
app.post('/incoming/persona/jessica', async (req, res) => {
  await handleIncomingDirectConnect(req, res, 'jessica');
});

// Voicemail webhook endpoints - add URL-encoded parsing for Twilio webhooks
app.use('/voicemail/*', express.urlencoded({ extended: false }));

app.post('/voicemail/start-recording', async (req, res) => {
  try {
    console.log('🎙️ Starting voicemail recording phase'.cyan);
    
    // Create recording response with user's greeting + beep
    const recordingResponse = voicemailRecordingService.createRecordingResponse();
    
    res.type('text/xml');
    res.end(recordingResponse);
    
  } catch (err) {
    console.log('❌ Error starting voicemail recording:', err);
    
    // Fallback to error response
    const errorResponse = voicemailRecordingService.createErrorFallbackResponse();
    res.type('text/xml');
    res.end(errorResponse);
  }
});

app.post('/voicemail/recording-complete', async (req, res) => {
  try {
    const { CallSid, RecordingUrl, RecordingDuration } = req.body;
    console.log(`📼 Voicemail recording complete for ${CallSid}: ${RecordingDuration}s`.green);
    
    // Store recording metadata
    voicemailRecordingService.handleRecordingComplete(CallSid, RecordingUrl, RecordingDuration);
    
    // Check if Whisper transcription is enabled via feature flag
    const enableWhisperTranscription = process.env.ENABLE_WHISPER_TRANSCRIPTION === 'true';
    
    if (enableWhisperTranscription) {
      console.log(`🎤 Using Whisper transcription for ${CallSid}`.cyan);
      
      // Start Whisper transcription process asynchronously
      setImmediate(async () => {
        try {
          // Step 1: Download audio file
          console.log('⬇️ Downloading audio from Twilio...'.gray);
          const { buffer: audioBuffer, format } = await audioDownloadService.downloadWithFallback(RecordingUrl, CallSid);
          
          // Step 2: Transcribe with Whisper
          const transcriptionResult = await whisperTranscriptionService.transcribeAudio(audioBuffer, format, CallSid);
          
          // Step 3: Process and store transcription
          if (transcriptionResult.text) {
            const processedTranscription = whisperTranscriptionService.processVoicemailTranscription(transcriptionResult.text);
            voicemailTranscriptionCache.store(CallSid, transcriptionResult.text, {
              confidence: transcriptionResult.confidence,
              processingTime: transcriptionResult.processingTime,
              language: transcriptionResult.language,
              duration: transcriptionResult.duration,
              model: transcriptionResult.model,
              fileSizeMB: transcriptionResult.fileSizeMB,
              isEmpty: processedTranscription.isEmpty,
              wordCount: processedTranscription.wordCount,
              hasUrgency: processedTranscription.hasUrgency,
              topics: processedTranscription.topics
            });
            
            console.log(`✅ Whisper transcription stored for ${CallSid}: "${transcriptionResult.text.substring(0, 80)}${transcriptionResult.text.length > 80 ? '...' : ''}"`.green);
          } else {
            console.log(`⚠️ Empty Whisper transcription for ${CallSid}`.yellow);
            // Store empty transcription to prevent waiting
            voicemailTranscriptionCache.store(CallSid, '', { isEmpty: true });
          }
          
        } catch (error) {
          console.error(`❌ Whisper transcription failed for ${CallSid}: ${error.message}`.red);
          // Store empty transcription on failure to prevent hanging
          voicemailTranscriptionCache.store(CallSid, '', { 
            error: error.message, 
            fallbackUsed: true 
          });
        }
      });
      
    } else {
      console.log(`📝 Using legacy Twilio transcription for ${CallSid}`.yellow);
      // Legacy mode - wait for Twilio transcription webhook
      // No immediate action needed, transcription will arrive via separate webhook
    }
    
    // Always connect to WebSocket immediately (transcription happens in background)
    const connectionResponse = voicemailRecordingService.createConnectionResponse(CallSid);
    
    res.type('text/xml');
    res.end(connectionResponse);
    
  } catch (err) {
    console.log('❌ Error handling recording completion:', err);
    
    // Fallback to error response
    const errorResponse = voicemailRecordingService.createErrorFallbackResponse();
    res.type('text/xml');
    res.end(errorResponse);
  }
});

app.post('/voicemail/transcription-webhook', async (req, res) => {
  try {
    const { CallSid, TranscriptionText } = req.body;
    console.log(`📝 Voicemail transcription received for ${CallSid}`.cyan);
    
    if (TranscriptionText) {
      // Store transcription in cache for WebSocket connection
      voicemailTranscriptionCache.store(CallSid, TranscriptionText);
    } else {
      console.log('⚠️ Empty transcription received'.yellow);
    }
    
    // Acknowledge webhook
    res.status(200).send('OK');
    
  } catch (err) {
    console.log('❌ Error handling voicemail transcription:', err);
    res.status(500).send('Error');
  }
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
    
    // Voicemail tracking variable (available throughout WebSocket lifetime)
    let currentVoicemailTranscript = null;
    
    // Silence detection variables
    let silenceTimer = null;
    let isWaitingForResponse = false;
    let isWaitingForVoicemailResponse = false;
    let hasAskedIfPresent = false;
    // CRITICAL FIX: Track when audio was last sent to prevent premature silence detection
    // This ensures we don't start the 5-second timer immediately after audio finishes
    let lastAudioSentTime = Date.now();
    
    // GPT Processing Lock - prevents concurrent GPT responses
    let isProcessingGPT = false;
    let gptQueue = [];
    
    // Rapid input consolidation - combine rapid user inputs into single request
    let rapidInputTimer = null;
    let rapidInputBuffer = [];
    let rapidInputDebounceMs = 1500; // 1.5 seconds to collect rapid inputs

    // GPT processing with rapid input consolidation
    const processGPTRequest = async (text, interactionCount, role = 'user', caller = 'transcription') => {
      // For user transcriptions, use rapid input consolidation
      if (caller === 'transcription' && role === 'user') {
        return handleRapidUserInput(text, interactionCount);
      }
      
      // For non-user inputs (voicemail, system), process immediately
      console.log(`🧠 GPT Request queued: "${text.substring(0, 50)}" (caller: ${caller}, queue: ${gptQueue.length})`.cyan);
      
      if (isProcessingGPT) {
        console.log(`⏳ GPT is busy, queuing request from ${caller}`.yellow);
        gptQueue.push({ text, interactionCount, role, caller });
        return;
      }
      
      await executeGPTRequest(text, interactionCount, role, caller);
    };

    // Handle rapid user input consolidation
    const handleRapidUserInput = (text, interactionCount) => {
      // Add to rapid input buffer
      rapidInputBuffer.push({ text, interactionCount, timestamp: Date.now() });
      
      console.log(`📝 Buffering rapid user input: "${text.substring(0, 50)}" (buffer: ${rapidInputBuffer.length})`.cyan);
      
      // Clear existing timer
      if (rapidInputTimer) {
        clearTimeout(rapidInputTimer);
      }
      
      // Set timer to process consolidated input after debounce period
      rapidInputTimer = setTimeout(() => {
        if (rapidInputBuffer.length > 0) {
          // Consolidate all buffered inputs
          const consolidatedText = rapidInputBuffer.map(input => input.text.trim()).join(' ');
          const latestInteractionCount = Math.max(...rapidInputBuffer.map(input => input.interactionCount));
          
          console.log(`🔄 Processing consolidated user input: "${consolidatedText.substring(0, 50)}" (${rapidInputBuffer.length} inputs combined)`.green);
          
          // Clear buffer
          rapidInputBuffer = [];
          
          // Process the consolidated input
          if (isProcessingGPT) {
            console.log('⏳ GPT is busy, queuing consolidated request'.yellow);
            gptQueue.push({ text: consolidatedText, interactionCount: latestInteractionCount, role: 'user', caller: 'transcription-consolidated' });
          } else {
            executeGPTRequest(consolidatedText, latestInteractionCount, 'user', 'transcription-consolidated');
          }
        }
      }, rapidInputDebounceMs);
    };

    // Execute GPT request
    const executeGPTRequest = async (text, interactionCount, role, caller) => {
      isProcessingGPT = true;
      console.log(`🚀 Processing GPT request from ${caller}`.green);
      
      try {
        await gptService.completion(text, interactionCount, role);
      } catch (error) {
        console.error('❌ GPT processing error:', error.message);
      } finally {
        isProcessingGPT = false;
        console.log(`✅ GPT request completed from ${caller}`.green);
        
        // Process next item in queue
        if (gptQueue.length > 0) {
          const nextRequest = gptQueue.shift();
          console.log(`🔄 Processing next queued request from ${nextRequest.caller} (${gptQueue.length} remaining)`.cyan);
          // Use setTimeout to prevent deep recursion
          setTimeout(() => {
            processGPTRequest(nextRequest.text, nextRequest.interactionCount, nextRequest.role, nextRequest.caller);
          }, 10);
        }
      }
    };

    // Clear GPT queue and rapid input buffer on interruption
    const clearGPTQueue = () => {
      let clearedItems = 0;
      
      if (gptQueue.length > 0) {
        clearedItems += gptQueue.length;
        gptQueue = [];
      }
      
      if (rapidInputBuffer.length > 0) {
        clearedItems += rapidInputBuffer.length;
        rapidInputBuffer = [];
      }
      
      if (rapidInputTimer) {
        clearTimeout(rapidInputTimer);
        rapidInputTimer = null;
      }
      
      if (clearedItems > 0) {
        console.log(`🧹 Clearing GPT queue and rapid input buffer: ${clearedItems} total requests`.yellow);
      }
      
      isProcessingGPT = false;
    };

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
      if (isWaitingForResponse || markCompletionService.getActiveMarkCount() > 0 || isWaitingForVoicemailResponse) {
        console.log(`Skipping silence detection: waiting=${isWaitingForResponse}, activeMarks=${markCompletionService.getActiveMarkCount()}, voicemailWaiting=${isWaitingForVoicemailResponse}`.gray);
        return;
      }
      
      // CRITICAL FIX: Don't start silence timer if audio was sent very recently
      // This prevents the timer from starting immediately after the last audio chunk
      // before Twilio has had time to play it and the user has had time to hear it
      const timeSinceLastAudio = Date.now() - lastAudioSentTime;
      const AUDIO_BUFFER_TIME = 3000; // 3 seconds buffer - accounts for network latency, audio playback time, and processing time for elderly callers
      
      if (timeSinceLastAudio < AUDIO_BUFFER_TIME) {
        console.log(`Skipping silence detection: audio sent only ${timeSinceLastAudio}ms ago (need ${AUDIO_BUFFER_TIME}ms buffer)`.gray);
        // Schedule a retry after the buffer time has elapsed
        setTimeout(() => {
          console.log('Retrying silence detection after audio buffer time elapsed'.cyan);
          startSilenceDetection();
        }, AUDIO_BUFFER_TIME - timeSinceLastAudio);
        return;
      }
      
      console.log('Starting 8-second silence timer (optimized for elderly callers)'.cyan);
      isWaitingForResponse = true;
      silenceTimer = setTimeout(() => {
        console.log('8-second silence timeout reached'.yellow);
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
            console.log('Final 8-second timeout reached'.yellow);
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
              
              // CRITICAL FIX: Wait for goodbye audio to actually complete using marks
              // Instead of using a fixed timeout, listen for mark completion
              let goodbyeCompletionHandler;
              goodbyeCompletionHandler = () => {
                // Only close if there are no active marks (goodbye audio finished)
                if (markCompletionService.getActiveMarkCount() === 0) {
                  console.log('Goodbye audio completed - closing call'.yellow);
                  if (ws.readyState === ws.OPEN) {
                    ws.close();
                  }
                  markCompletionService.off('all-marks-complete', goodbyeCompletionHandler);
                } else {
                  console.log(`Waiting for goodbye audio to complete (${markCompletionService.getActiveMarkCount()} marks remaining)`.gray);
                }
              };
              
              // Listen for marks completion
              markCompletionService.on('all-marks-complete', goodbyeCompletionHandler);
              
              // Safety fallback: If something goes wrong with mark tracking, still close after 5 seconds
              setTimeout(() => {
                if (ws.readyState === ws.OPEN) {
                  console.log('Safety fallback: Closing call after 5-second maximum wait'.yellow);
                  markCompletionService.off('all-marks-complete', goodbyeCompletionHandler);
                  ws.close();
                }
              }, 5000); // Longer safety timeout since we're waiting for actual audio completion
            }
          }, 8000); // 8 second final timeout for elderly callers
        }
      }, 8000); // 8 second initial timeout for elderly callers
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

        // Check for voicemail mode
        let voicemailMode = false;
        let voicemailTranscript = null;
        let playConfirmation = false;
        let isWaitingForVoicemailResponse = false;
        
        if (msg.start.customParameters) {
          voicemailMode = msg.start.customParameters.voicemail_mode === 'true';
          playConfirmation = msg.start.customParameters.play_confirmation === 'true';
          
          if (voicemailMode) {
            console.log('📼 Voicemail mode activated - checking for transcript'.cyan);
            
            // Try to retrieve the voicemail transcription
            const transcriptionData = voicemailTranscriptionCache.retrieve(callSid);
            if (transcriptionData) {
              voicemailTranscript = transcriptionData.transcription;
              currentVoicemailTranscript = voicemailTranscript; // Store for conversation saving
              console.log(`📖 Retrieved voicemail transcript: "${voicemailTranscript.substring(0, 50)}${voicemailTranscript.length > 50 ? '...' : ''}"`.green);
            } else {
              console.log('⚠️ No voicemail transcript found - continuing without context'.yellow);
            }
          }
        }

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
          
          // Set voicemail context if in voicemail mode
          if (voicemailMode && voicemailTranscript) {
            gptService.setVoicemailContext(voicemailTranscript);
            console.log('📝 Voicemail context set in GPT service'.green);
          }
        }).catch(error => {
          // HIPAA COMPLIANCE: Never log full error object as it may contain patient data (PHI)
          console.error('Error initializing GPT service:', error.message);
        });

        // Set up service event handlers after services are created
        gptService.on('gptreply', async (gptReply, icount) => {
          console.log(`Interaction ${icount}: GPT -> TTS: ${gptReply.partialResponse}`.green );
          
          // CRITICAL: If this is a real GPT response (not confirmation message), clear voicemail waiting flag
          if (isWaitingForVoicemailResponse && gptReply.partialResponse && !gptReply.partialResponse.startsWith('Message saved.')) {
            console.log('🎯 Real GPT response received - allowing silence detection to resume'.green);
            isWaitingForVoicemailResponse = false;
          }
          
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
          // CRITICAL FIX: Update timestamp when audio is sent to Twilio
          // This helps prevent silence detection from starting too soon after audio
          lastAudioSentTime = Date.now();
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

          // Handle voicemail mode vs regular mode
          if (voicemailMode) {
            console.log('📼 Voicemail mode - generating confirmation and contextual response'.cyan);
            
            if (playConfirmation) {
              // First play confirmation message
              ttsService.generate({
                partialResponseIndex: null,
                partialResponse: 'Message saved. I\'ll send your message to Ryan and he will get back to you very soon.',
                isFinal: false  // Not final, more content coming
              }, 0);
              
              // Then generate contextual response based on voicemail transcript
              if (voicemailTranscript) {
                // CRITICAL: Prevent silence detection while we generate GPT response
                isWaitingForVoicemailResponse = true;
                console.log('🔄 Generating voicemail response - preventing silence detection'.blue);
                
                // Let GPT generate a contextual response to the voicemail
                setTimeout(() => {
                  processGPTRequest(`[VOICEMAIL RESPONSE NEEDED] The caller just left this voicemail: '${voicemailTranscript}' - respond directly to their specific concern with immediate help. DO NOT repeat the confirmation message as that was already played.`, 1, 'user', 'voicemail-initial');
                }, 1500); // Small delay to let confirmation message play first
              } else {
                // Wait for transcription to arrive (up to 10 seconds)
                isWaitingForVoicemailResponse = true;
                console.log('🔄 Waiting for voicemail transcription - preventing silence detection'.blue);
                
                let attempts = 0;
                const waitForTranscription = setInterval(() => {
                  attempts++;
                  const transcriptionData = voicemailTranscriptionCache.retrieve(callSid);
                  
                  if (transcriptionData && transcriptionData.transcription) {
                    clearInterval(waitForTranscription);
                    isWaitingForVoicemailResponse = false;
                    // CRITICAL: Clear any existing silence timer since we're about to respond
                    clearSilenceTimer();
                    console.log('📖 Late transcription retrieved - generating contextual response'.green);
                    
                    // Set the voicemail context now that we have the transcript
                    gptService.setVoicemailContext(transcriptionData.transcription);
                    currentVoicemailTranscript = transcriptionData.transcription; // Store for conversation saving
                    
                    // Generate contextual response
                    setTimeout(() => {
                      processGPTRequest(`[VOICEMAIL RESPONSE NEEDED] The caller just left this voicemail: '${transcriptionData.transcription}' - respond directly to their specific concern with immediate help. DO NOT repeat the confirmation message as that was already played.`, 1, 'user', 'voicemail-delayed');
                    }, 500);
                  } else if (attempts >= 20) { // 10 seconds total wait
                    clearInterval(waitForTranscription);
                    isWaitingForVoicemailResponse = false;
                    console.log('⚠️ Transcription timeout - using fallback response'.yellow);
                    setTimeout(() => {
                      ttsService.generate({
                        partialResponseIndex: null,
                        partialResponse: 'Hi Francine! I heard your message. Let me help you with whatever you need.',
                        isFinal: true
                      }, 1);
                    }, 500);
                  }
                }, 500); // Check every 500ms
              }
            } else {
              // Direct contextual response without confirmation
              if (voicemailTranscript) {
                processGPTRequest(`[VOICEMAIL RESPONSE NEEDED] The caller just left this voicemail: '${voicemailTranscript}' - respond directly to their specific concern with immediate help. DO NOT repeat the confirmation message as that was already played.`, 0, 'user', 'voicemail-direct');
              } else {
                // Wait for transcription to arrive (up to 10 seconds)
                isWaitingForVoicemailResponse = true;
                console.log('🔄 Waiting for voicemail transcription - preventing silence detection'.blue);
                
                let attempts = 0;
                const waitForTranscription = setInterval(() => {
                  attempts++;
                  const transcriptionData = voicemailTranscriptionCache.retrieve(callSid);
                  
                  if (transcriptionData && transcriptionData.transcription) {
                    clearInterval(waitForTranscription);
                    isWaitingForVoicemailResponse = false;
                    // CRITICAL: Clear any existing silence timer since we're about to respond
                    clearSilenceTimer();
                    console.log('📖 Late transcription retrieved - generating direct contextual response'.green);
                    
                    // Set the voicemail context now that we have the transcript
                    gptService.setVoicemailContext(transcriptionData.transcription);
                    currentVoicemailTranscript = transcriptionData.transcription; // Store for conversation saving
                    
                    // Generate contextual response
                    processGPTRequest(`[VOICEMAIL RESPONSE NEEDED] The caller just left this voicemail: '${transcriptionData.transcription}' - respond directly to their specific concern with immediate help. DO NOT repeat the confirmation message as that was already played.`, 0, 'user', 'voicemail-late');
                  } else if (attempts >= 20) { // 10 seconds total wait
                    clearInterval(waitForTranscription);
                    isWaitingForVoicemailResponse = false;
                    console.log('⚠️ Transcription timeout - using fallback greeting'.yellow);
                    ttsService.generate({
                      partialResponseIndex: null,
                      partialResponse: 'Hi Francine! Let me help you with whatever you need.',
                      isFinal: true
                    }, 0);
                  }
                }, 500); // Check every 500ms
              }
            }
          } else {
            // Regular mode - variety of natural greetings
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
            // CRITICAL FIX: Include isFinal: true to ensure greeting generates proper marks for tracking
            // This prevents premature silence detection before the greeting finishes playing
            ttsService.generate({
              partialResponseIndex: null, 
              partialResponse: randomGreeting, 
              isFinal: true  // Ensures this generates marks that get tracked by markCompletionService
            }, 0);
          }
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
        
        // CRITICAL FIX: Clear TTS queue to prevent old responses from playing
        if (ttsService && typeof ttsService.clearQueue === 'function') {
          ttsService.clearQueue();
        }
        
        // CRITICAL FIX: Clear StreamService buffer to prevent old audio from being sent
        if (streamService && typeof streamService.clear === 'function') {
          streamService.clear();
        }
        
        // CRITICAL FIX: Clear GPT queue to prevent old responses from processing
        clearGPTQueue();
        
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
      
      // Rapid input is now handled by the consolidation system in handleRapidUserInput
      
      processGPTRequest(text, interactionCount, 'user', 'transcription');
      interactionCount += 1;
    });

    // Clean up when WebSocket closes
    ws.on('close', async () => {
      console.log('WebSocket closed, cleaning up services'.cyan);
      
      // CRITICAL: Stop all processing immediately when WebSocket closes
      
      // Clear silence detection timer
      clearSilenceTimer();
      
      // Clear all queues and stop processing
      if (ttsService && typeof ttsService.clearQueue === 'function') {
        ttsService.clearQueue();
        console.log('🛑 TTS service cleared on WebSocket close'.red);
      }
      
      if (streamService && typeof streamService.clear === 'function') {
        streamService.clear();
        console.log('🛑 StreamService buffer cleared on WebSocket close'.red);
      }
      
      clearGPTQueue();
      console.log('🛑 GPT queue cleared on WebSocket close'.red);
      
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
          // Add voicemail transcript if available
          if (currentVoicemailTranscript) {
            summary.voicemailTranscript = currentVoicemailTranscript;
          }
          
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
