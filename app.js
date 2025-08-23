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

const VoiceResponse = require('twilio').twiml.VoiceResponse;

const app = express();
ExpressWs(app);

// Admin routes
const adminRouter = require('./routes/admin');
const adminStatsRouter = require('./routes/api/admin-stats');
const adminConfigRouter = require('./routes/api/admin-config');
const adminDashboardRouter = require('./routes/api/admin-dashboard-real');
const adminMemoriesRouter = require('./routes/api/admin-memories');
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
        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%236366f1'/><g transform='translate(50,50) scale(1.5)'><path d='M12 2C8.5 2 6 4.5 6 7.5C6 8.2 6.1 8.9 6.3 9.5C5.8 9.3 5.3 9.2 4.8 9.2C3.8 9.2 3 10 3 11C3 12 3.8 12.8 4.8 12.8C5.3 12.8 5.8 12.7 6.3 12.5C6.5 12.8 6.8 13.1 7.1 13.3C7.5 13.6 8 13.8 8.5 13.9V14.5C8.5 15.3 9.2 16 10 16H14C14.8 16 15.5 15.3 15.5 14.5V13.9C16 13.8 16.5 13.6 16.9 13.3C17.2 13.1 17.5 12.8 17.7 12.5C18.2 12.7 18.7 12.8 19.2 12.8C20.2 12.8 21 12 21 11C21 10 20.2 9.2 19.2 9.2C18.7 9.2 18.2 9.3 17.7 9.5C17.9 8.9 18 8.2 18 7.5C18 4.5 15.5 2 12 2Z' fill='white'/><ellipse cx='12' cy='10' rx='4.5' ry='4' fill='%236366f1'/><path d='M9 14.5L10.5 15.5L12 15L13.5 15.5L15 14.5' stroke='white' stroke-width='0.5' fill='none'/><path d='M8 16C7.5 16 7 16.5 7 17V20C7 20.5 7.5 21 8 21H16C16.5 21 17 20.5 17 20V17C17 16.5 16.5 16 16 16' fill='white'/><path d='M10 17H14V20.5C14 20.8 13.8 21 13.5 21H10.5C10.2 21 10 20.8 10 20.5V17Z' fill='%236366f1'/><ellipse cx='6.5' cy='18' rx='1.5' ry='2.5' transform='rotate(-20 6.5 18)' fill='white'/><ellipse cx='17.5' cy='18' rx='1.5' ry='2.5' transform='rotate(20 17.5 18)' fill='white'/></g></svg>">
        
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                <!-- Nanny icon - hair bun and figure -->
                <circle cx="12" cy="6" r="4.5" fill="white"/>
                <circle cx="7" cy="8" r="2" fill="white"/>
                <circle cx="17" cy="8" r="2" fill="white"/>
                <circle cx="12" cy="9.5" r="3.2" fill="#6366f1"/>
                <path d="M9 13L12 14L15 13" stroke="white" stroke-width="1" fill="none"/>
                <rect x="8" y="14" width="8" height="8" rx="1" fill="white"/>
                <rect x="10" y="15.5" width="4" height="6" rx="0.5" fill="#6366f1"/>
                <ellipse cx="6" cy="17" rx="1.2" ry="2.5" fill="white"/>
                <ellipse cx="18" cy="17" rx="1.2" ry="2.5" fill="white"/>
              </svg>
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

// Import dashboard real data router
const adminDashboardRealRouter = require('./routes/api/admin-dashboard-real');

// Mount admin routes
app.use('/admin', adminRouter);
app.use('/api/admin/stats', adminStatsRouter);
app.use('/api/admin/config', adminConfigRouter);
app.use('/api/admin/dashboard', adminDashboardRealRouter);
app.use('/api/admin/memories', adminMemoriesRouter);

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

app.post('/incoming', (req, res) => {
  try {
    const response = new VoiceResponse();

    // Simulate 4 rings (each ring cycle is ~5 seconds)
    response.pause({ length: 18 });

    const connect = response.connect();
    connect.stream({ url: `wss://${process.env.SERVER}/connection` });

    res.type('text/xml');
    res.end(response.toString());
  } catch (err) {
    console.log(err);
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
    const memoryService = new MemoryService(databaseManager);
    let conversationAnalyzer; // Will be initialized after callSid is available
    
    // Initialize memory service before creating GPT service
    try {
      await memoryService.initialize();
      console.log('Memory service initialized successfully'.cyan);
    } catch (error) {
      // HIPAA COMPLIANCE: Never log full error object as it may contain patient memory data (PHI)
      console.error('Error initializing memory service:', error.message);
      // Continue anyway - memory service will be unavailable but the call should still work
    }
    
    const gptService = new GptService(markCompletionService, null, memoryService);
    const streamService = new StreamService(ws);
    const transcriptionService = new TranscriptionService();
    const ttsService = new TextToSpeechService({});

    let marks = [];
    let interactionCount = 0;

    // Incoming from MediaStream
    ws.on('message', function message(data) {
      const msg = JSON.parse(data);
      if (msg.event === 'start') {
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;

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

          // Select a random greeting
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
      
      // Track user utterance in analyzer
      if (conversationAnalyzer) {
        conversationAnalyzer.trackUserUtterance(text, new Date());
      }
      
      gptService.completion(text, interactionCount);
      interactionCount += 1;
    });

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

    // Clean up when WebSocket closes
    ws.on('close', async () => {
      console.log('WebSocket closed, cleaning up services'.cyan);
      
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
app.use('/admin', (error, req, res, next) => {
  // HIPAA COMPLIANCE: Never log full error object as it may contain request data with PHI
  console.error('Admin route error:', error.message);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/admin', (error, req, res, next) => {
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
