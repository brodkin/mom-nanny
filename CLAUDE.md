# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Purpose**: This is a compassionate AI companion system designed to support elderly individuals with dementia and anxiety, particularly when family members cannot be immediately available.

**Primary Use Case**: This application provides a caring, patient voice assistant that answers phone calls from Ryan's mother, who has severe dementia and chronic anxiety. When Ryan is unavailable, the AI companion engages in calming, supportive conversations to help reduce anxiety and provide comfort through familiar, positive interactions.

**Core Functionality**: The system combines Twilio Media Streams for phone connectivity with OpenAI's GPT for empathetic conversation, using Deepgram for natural speech-to-text and text-to-speech conversion. The AI is designed to:
- Provide patient, warm responses regardless of repetition
- Redirect conversations to positive, calming topics
- Maintain a consistent, reassuring presence
- Never show frustration with repeated questions or confusion

## Development Commands

### Running the Application
```bash
# Install dependencies
npm install

# Development mode with auto-reload
npm run dev

# Production mode
npm start

# Run tests
npm test

# Run a single test file
npm test -- test/checkInventory.test.js
```

### Testing Phone Calls
```bash
# Make an inbound test call (automated script)
npm run inbound

# Make an outbound test call (connects to your phone)
npm run outbound
```

## Architecture Overview

### Core Flow
The application orchestrates real-time communication between multiple services:

1. **Twilio Media Streams** → WebSocket connection at `/connection` receives audio from phone calls
2. **TranscriptionService** → Sends audio to Deepgram for Speech-to-Text
3. **GptService** → Processes transcriptions through OpenAI GPT with function calling support
4. **TextToSpeechService** → Converts GPT responses to speech via Deepgram
5. **StreamService** → Buffers and sends audio back to Twilio

### Service Architecture

- **app.js**: Express server with WebSocket handling for Twilio Media Streams
  - `/incoming` endpoint: Handles incoming calls with TwiML response
  - `/connection` WebSocket: Manages bidirectional audio streaming

- **services/**:
  - `gpt-service.js`: OpenAI integration with streaming responses and function calling orchestration
  - `transcription-service.js`: Deepgram STT with utterance detection
  - `tts-service.js`: Deepgram TTS with response chunking (configurable for ElevenLabs)
  - `stream-service.js`: Audio buffering and mark management for interruption handling
  - `recording-service.js`: Optional call recording functionality

- **functions/**: GPT function calling implementations
  - `function-manifest.js`: Defines available functions for GPT
  - Each function file must match its function name exactly

### Key Technical Details

- **Interruption Handling**: Uses Twilio marks to track audio playback and clear on user interruption
- **Response Chunking**: GPT responses are split at `•` symbols for faster TTS processing
- **Streaming**: All services use event emitters for real-time data flow
- **Context Management**: Maintains conversation history in `userContext` array

## Environment Configuration

Required environment variables (copy `.env.example` to `.env`):
- `SERVER`: Your server domain (without https://)
- `OPENAI_API_KEY`: OpenAI API key for GPT
- `DEEPGRAM_API_KEY`: Deepgram API key for STT/TTS
- `VOICE_MODEL`: Deepgram voice model (default: aura-asteria-en)
- `RECORDING_ENABLED`: Enable call recording (default: false)

For testing calls:
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`: Twilio credentials
- `FROM_NUMBER`: Twilio phone number
- `APP_NUMBER`: Application phone number for inbound calls
- `YOUR_NUMBER`: Your phone number for outbound testing

## GPT Configuration

The GPT assistant personality and behavior are configured in `services/gpt-service.js`:
- System prompt defines the assistant's role and conversation style
- The `•` symbol insertion is critical for response chunking
- Function calling is handled through the manifest in `functions/function-manifest.js`

### Key Behavioral Guidelines for Dementia Support
- **Identity**: Assistant identifies as "Jessica," Ryan's friend
- **Patience First**: Never express frustration with repetition or confusion
- **Validation**: Acknowledge feelings without dismissing them
- **Redirection**: Gently guide to pleasant, familiar topics when anxiety rises
- **Simplicity**: Use clear, simple language and short sentences
- **Reassurance**: Consistently provide comfort and safety

### Conversation Guidelines
- **Safe Topics**: Dogs, Hawaii, positive memories, asking about her day
- **Avoid**: Health topics (she has hypochondria tendencies)
- **Anxiety Response**: It's okay to acknowledge when she sounds worried
- **Facility Concerns**: If she mentions staff being mean, reassure her that everyone at her assisted living facility is trying to help her
- **Redirection Strategy**: Try various positive topics to find what interests her in the moment
- **Call Routing**: The AI only activates when Ryan is unavailable (if available, he answers directly)

## Adding New Functions

1. Create a new file in `/functions/` matching the function name
2. Add the function definition to `function-manifest.js`
3. Include a `say` property for pre-execution speech
4. Return values to prevent GPT from repeatedly calling the function

## Testing Considerations

- Unit tests in `/test/` directory test function calls without GPT
- Use `npm run inbound` for automated testing with scripts
- Monitor console output for color-coded service communication