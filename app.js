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
            // HIPAA COMPLIANCE: Process emotional analysis in background without blocking
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
