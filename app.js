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

const VoiceResponse = require('twilio').twiml.VoiceResponse;

const app = express();
ExpressWs(app);

const PORT = process.env.PORT || 3000;

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

app.ws('/connection', (ws) => {
  try {
    ws.on('error', console.error);
    // Filled in from start message
    let streamSid;
    let callSid;

    const markCompletionService = new MarkCompletionService();
    // Initialize SQLite storage directly
    const dbPath = process.env.SQLITE_DB_PATH || './conversation-summaries.db';
    const databaseManager = new DatabaseManager(dbPath);
    const storageService = new SqliteStorageService(databaseManager);
    const summaryGenerator = new SummaryGenerator();
    let conversationAnalyzer; // Will be initialized after callSid is available
    
    const gptService = new GptService(markCompletionService);
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
          }
          
        } catch (error) {
          console.error('Error saving conversation summary or messages:', error);
        }
      }
      
      transcriptionService.close();
      markCompletionService.clearAll();
    });
  } catch (err) {
    console.log(err);
  }
});

app.listen(PORT);
console.log(`Server running on port ${PORT}`);
