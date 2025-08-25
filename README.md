# Compassionate AI Companion System

A specialized AI companion designed to provide emotional support and comfort to elderly individuals with dementia and anxiety through phone calls. This system prioritizes patience, validation, and emotional well-being over technical efficiency.

**Mission**: Provide compassionate AI companionship when family members cannot be immediately available, serving as a bridge during distressing moments and offering consistent, gentle support.

This application combines several technologies to create a voice-first AI system:
- [Twilio Media Streams](https://twilio.com/media-streams) for real-time phone call handling
- [Deepgram](https://deepgram.com/) for Speech-to-Text and Text-to-Speech
- [OpenAI GPT](https://openai.com) for compassionate conversation AI
- SQLite database for persistent memory and conversation tracking

## Core Features

- 💝 **Compassionate Responses**: Every interaction prioritizes emotional comfort and dignity
- 🧠 **Persistent Memory**: Remembers important details about the user across calls
- 🗣️ **Real-time Conversation**: Low-latency responses with natural interruption handling
- 📞 **Emergency Assessment**: Intelligent evaluation of urgent situations vs. anxiety episodes
- 📰 **Engagement Tools**: News headlines and topics to redirect anxious conversations
- 📊 **Emotional Analysis**: GPT-powered tracking of anxiety, confusion, and mood patterns
- 🏥 **Admin Dashboard**: Caregiver interface for monitoring conversation patterns and emotional trends

## Quick Start

### Prerequisites
- Node.js 18+ installed
- API keys from:
  - [OpenAI](https://platform.openai.com/signup) for GPT conversation AI
  - [Deepgram](https://console.deepgram.com/signup) for speech processing
  - [Twilio](https://twilio.com) for phone call integration (for production use)
  - [ngrok](https://ngrok.com) for local development with phone calls

### 1. Installation

```bash
# Clone and install dependencies
git clone [repository-url]
cd mom-nanny
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env` and configure:

```bash
# Required for all modes
OPENAI_API_KEY="sk-your-openai-key"
DEEPGRAM_API_KEY="your-deepgram-key"

# Required for phone integration
SERVER="your-ngrok-url.ngrok.io"  # No https://
TWILIO_ACCOUNT_SID="your-account-sid"
TWILIO_AUTH_TOKEN="your-auth-token"

# Optional configuration
VOICE_MODEL="aura-asteria-en"  # Deepgram voice model
RECORDING_ENABLED="false"      # Enable call recording
TIMEZONE="America/Los_Angeles" # Admin dashboard timezone
SQLITE_DB_PATH="./storage/conversation-summaries.db"

# Testing phone numbers
FROM_NUMBER="+15551234567"     # Your Twilio number
YOUR_NUMBER="+15559876543"     # Your personal phone
```

### 3. Development Modes

#### Text Chat (Recommended for Development)
```bash
npm run chat
```
Interactive console interface with full GPT integration, memory persistence, and debugging commands:
- `/help` - Show available commands
- `/memories` - View stored memories
- `/context` - Show conversation context
- `/stats` - Display token usage
- `/debug` - Toggle verbose logging

#### Phone Call Testing
```bash
# Start the server
npm run dev

# In another terminal, start ngrok
ngrok http 3000

# Update your Twilio webhook URL to: https://your-ngrok-url.ngrok.io/incoming

# Test with automated calls
npm run inbound   # Simulated incoming call
npm run outbound  # Calls YOUR_NUMBER
```

### 4. Admin Dashboard
Once running, visit `http://localhost:3000/admin` to view:
- Recent conversation summaries
- Emotional analysis trends
- System statistics and health metrics

## How It Works

The system coordinates data flow between multiple services to create seamless, compassionate conversations:

### Phone Call Flow
```
1. Twilio receives incoming call → WebSocket connection established
2. Audio streams to Deepgram → Real-time speech-to-text
3. GPT processes text → Generates compassionate response with memory context
4. Response chunks sent to Deepgram → Text-to-speech conversion
5. Audio streams back to caller → Natural conversation flow
```

### Key Technical Features
- **Interruption Handling**: Users can interrupt the AI naturally, just like human conversation
- **Response Chunking**: Uses bullet points (•) to break responses into quick audio chunks
- **Memory Integration**: Persistent SQLite database stores personal details across calls
- **Emotional Analysis**: GPT-4 analyzes conversation tone and emotional patterns
- **Emergency Detection**: Intelligent assessment of genuine emergencies vs. anxiety episodes

## Conversation Design Philosophy

The AI companion follows specific conversational principles:

### Core Personality Traits
- **Infinitely Patient**: Never shows frustration with repetition or confusion
- **Validating**: Acknowledges feelings rather than correcting misunderstandings
- **Gentle**: Uses soft, comforting language appropriate for elderly users
- **Consistent**: Maintains the same warm personality across all interactions

### Response Patterns
```javascript
// Example compassionate response structure
"Hello dear! • How are you feeling today? • I'm so glad you called."
```

The `•` symbol is crucial - it breaks responses into natural chunks for faster audio delivery, reducing user wait time during anxious moments.

### Memory System
The AI silently remembers important details:
- Personal preferences and family information
- Medical concerns and medication schedules
- Emotional patterns and effective comfort strategies
- Topics that bring joy or cause distress

**Important**: Memory operations are invisible to users - the AI never mentions "remembering" or "storing" information.

## Available AI Functions

The AI companion has access to specialized functions that enhance the caregiving experience:

### Emergency Assessment (`transferCallDeferred`)
**Purpose**: Evaluate whether a situation requires immediate human intervention
**Critical Note**: The system understands that users with dementia often experience anxiety that feels like emergencies. True emergencies are rare.

**Assessment Criteria**:
- Actual medical distress (chest pain, difficulty breathing)
- Physical injury from falls
- Genuine safety concerns

**Default Behavior**: Comfort and redirect rather than transfer, as most "emergencies" are anxiety episodes.

### Engagement Tool (`getNewsHeadlines`)
**Purpose**: Redirect anxious or repetitive conversations with novel topics
**Categories**: General news, health, science, entertainment
**Usage**: Proactively introduced when conversations become circular or distressing

### Memory Functions (Silent Operation)
- `rememberInformation`: Store personal details naturally during conversation
- `recallMemory`: Retrieve stored information for context
- `updateMemory`: Build progressive understanding over time
- `forgetMemory`: Remove outdated or incorrect information
- `listAvailableMemories`: Internal discovery of stored memories

**Critical**: These functions operate silently - the AI never tells users it's "remembering" or "storing" information.

### Call Management (`endCallDeferred`)
**Purpose**: Gracefully end conversations when appropriate
**Behavior**: Always includes warm goodbye before triggering end sequence

## Adding Custom Functions

To extend the AI's capabilities:

1. **Create Function File**: Add `newFunction.js` in `/functions/` directory
2. **Define in Manifest**: Add function definition to `function-manifest.js`
3. **Include Speech Cue**: Add `say` property for pre-execution comfort phrases

Example function structure:
```javascript
// functions/comfortUser.js
module.exports = function comfortUser(args) {
  // Function logic here
  return "Comfort message delivered successfully";
};
```

Function manifest entry:
```javascript
{
  type: "function",
  function: {
    name: "comfortUser",
    say: "Let me help you feel better.",
    description: "Provide targeted comfort for specific anxiety triggers",
    parameters: {
      type: "object",
      properties: {
        trigger: {
          type: "string",
          description: "The anxiety trigger to address"
        }
      },
      required: ["trigger"]
    }
  }
}
```

## Testing & Quality Assurance

### Unit Testing
```bash
npm test
```
Runs Jest tests for all function modules, ensuring reliability without requiring GPT calls.

### Integration Testing Scripts
```bash
npm run inbound   # Automated test call with scripted conversation
npm run outbound  # Places call to YOUR_NUMBER for manual testing
npm run chat      # Text-based testing with full system integration
```

### Admin Dashboard Testing
```bash
npm run test:dashboard
```
Tests the admin interface APIs and statistics endpoints.

## Data Management Tools

### Call Removal Script
For administrative purposes, you can safely remove specific calls and their associated data from the system:

```bash
# Remove call by call_sid (exact or partial match)
node scripts/remove-call.js CA123456

# Remove call by conversation ID
node scripts/remove-call.js --id 42

# Preview what would be deleted (dry run)
node scripts/remove-call.js CA123456 --dry-run

# Force deletion without confirmation prompt
node scripts/remove-call.js CA123456 --force
```

**What gets removed:**
- The conversation record
- All messages in the conversation
- All summaries for the conversation
- All analytics data for the conversation
- All emotional metrics for the conversation

**What is preserved:**
- Memories (shared across all calls)
- Other conversations and their data
- System settings and configuration

The script includes safety features:
- Interactive confirmation before deletion
- Detailed preview of what will be removed
- Transaction-based deletion for data integrity
- Comprehensive error handling and logging

### Database Cleanup Scripts
```bash
# Remove conversations shorter than 1 second
node scripts/cleanup-short-conversations.js

# Preview cleanup without making changes
node scripts/cleanup-short-conversations.js --dry-run
```

## Database & Persistence

The system uses SQLite for reliable local storage with automatic schema migrations:

### Stored Data
- **Conversations**: Call metadata, duration, emotional analysis
- **Messages**: Complete conversation transcripts with timestamps
- **Memories**: Personal information learned about users
- **Analytics**: Emotional patterns and conversation insights
- **Settings**: System configuration and preferences

### Emotional Analysis
Advanced GPT-4 powered analysis tracks:
- Anxiety levels (0-10 scale)
- Confusion indicators
- Agitation patterns
- Overall mood sentiment (-10 to +10)
- Comfort effectiveness metrics

### Data Privacy
- No personally identifiable information in logs
- Local SQLite storage - no external transmission
- Conversation summaries rather than full transcripts
- HIPAA-conscious design for healthcare environments

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Twilio Call   │───▶│   Audio Stream   │───▶│   Deepgram STT  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Audio Response │◀───│   Deepgram TTS   │◀───│   GPT-4 + Memory│
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Call Ends     │───▶│ Conversation Log │───▶│ Emotional Analysis│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Deployment

### Production Considerations
- **Latency**: Deploy close to users for optimal response times
- **Reliability**: Consider load balancing for high call volumes
- **Monitoring**: Set up health checks and error alerting
- **Backup**: Regular database backups for conversation history

### Fly.io Deployment (Recommended)
```bash
# Install Fly CLI and login
fly auth login

# Configure app name in fly.toml (must be globally unique)
fly launch

# Deploy application
fly deploy

# Import environment variables
fly secrets import < .env
```

Fly.io's east-coast regions are recommended for optimal Twilio Media Streams performance.

---

## Credits & Acknowledgments

This compassionate AI companion system was built upon the foundational architecture provided by the [Twilio Call GPT demo](https://github.com/twilio-labs/call-gpt) project. We extend our gratitude to the Twilio Labs team for their excellent work in demonstrating real-time voice AI integration.

The original project showcased the technical possibilities of combining Twilio Media Streams, Deepgram, and OpenAI for voice applications. This implementation has been extensively modified and enhanced to serve the specific needs of elderly care and dementia support, with a focus on compassion, patience, and emotional well-being rather than commercial applications.

**Key architectural components retained from the original**:
- Twilio Media Streams WebSocket handling
- Deepgram speech-to-text and text-to-speech integration
- OpenAI GPT streaming response processing
- Real-time audio interruption handling

**Major enhancements for compassionate care**:
- Persistent memory system for personalized interactions
- Emotional analysis and mood tracking
- Emergency assessment and escalation protocols
- Admin dashboard for caregiver insights
- Specialized conversation design for dementia care
- Comprehensive testing and development tools

We encourage others to explore the original Twilio Call GPT project for general voice AI applications, while this version remains focused on providing dignified, compassionate care for vulnerable populations.
