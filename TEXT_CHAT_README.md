# Text Chat CLI Tool

A text-based conversation testing interface for the mom-nanny voice assistant. This tool allows developers to test and interact with Jessica (the AI assistant) through a command-line interface without requiring phone calls or audio processing.

## Features

- 🗣️ **Interactive Chat**: Real-time text conversation with the AI assistant
- 📊 **Token Usage Tracking**: Monitor OpenAI API token consumption per turn and session
- 🔧 **Function Call Visualization**: See when the AI triggers functions with color-coded output
- 📈 **Context Monitoring**: Track conversation context size and usage percentage
- 🎨 **Color-Coded Output**: Different colors for user messages, AI responses, and system events
- ⚙️ **Debug Commands**: Built-in commands for troubleshooting and session management

## Quick Start

1. **Set up environment variables** (copy from `.env.example`):
   ```bash
   OPENAI_API_KEY=your_openai_api_key_here
   ```

2. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

3. **Start the text chat**:
   ```bash
   npm run chat
   ```

## Usage

### Starting a Chat Session

```bash
npm run chat
```

The tool will display a welcome banner and show Jessica's initial greeting. You can then type messages just like you would speak to her over the phone.

### Interactive Commands

During a chat session, you can use these commands:

- `/help` - Show help information
- `/stats` - Show session statistics (messages, tokens, duration)
- `/context` - Show full conversation context
- `/debug` - Show technical debug information
- `/reset` - Reset the conversation (starts fresh)
- `/exit` - End the chat session

### Sample Conversation

```
🤖 Hi Francine! How are you doing today?

You: I'm feeling a bit anxious today

🤖 I understand you're feeling anxious today, dear. • That's okay, sometimes we all have days like that. • Is there anything particular that's worrying you? •

📈 Token Usage:
   ├─ This Turn: 45 prompt + 28 completion = 73 total
   ├─ Session Total: 73 tokens
   └─ Context: 4 messages / 128,000 (0.0%)

You: Can you tell me what's happening in the news?

🔧 Let me check what's happening in the news today.

🤖 I found some interesting news for you! • There's a story about a new art exhibit opening in Los Angeles • and another about a local community garden project that's been really successful. • Would you like to hear more about either of these? •

📈 Token Usage:
   ├─ This Turn: 89 prompt + 45 completion = 134 total
   ├─ Session Total: 207 tokens
   └─ Context: 7 messages / 128,000 (0.0%)
```

## Color Coding

- 🗣️ **User messages** (cyan): Your input text
- 🤖 **AI responses** (green): Jessica's replies
- 🔧 **Function calls** (yellow): When AI triggers functions like news or call transfer
- 📊 **Function results** (magenta): Results from function calls
- 📈 **Token usage** (white/bold): API usage statistics

## Technical Details

### Architecture

The text chat tool uses mock services that simulate the real audio pipeline:

- **MockTranscriptionService**: Converts text input to transcript events
- **MockTTS Service**: Captures AI responses without generating audio
- **MockStreamService**: Logs audio marks without WebSocket connections
- **Enhanced GptService**: Captures and returns token usage data
- **ChatSession**: Orchestrates all services and manages conversation state

### Token Usage Tracking

The tool provides detailed token usage information:

- **This Turn**: Tokens used for the current request/response
- **Session Total**: Cumulative tokens used during the entire session
- **Context**: Number of messages in context and percentage of model limit

### Function Integration

The tool uses the same function manifest and implementations as the real voice assistant:

- `getNewsHeadlines`: Fetches news stories
- `transferCallDeferred`: Would transfer to Ryan (logged only in text mode)
- `endCallDeferred`: Gracefully ends the conversation

## Development

### Running Tests

```bash
npm test -- test/text-chat.test.js
```

Tests cover:
- Mock service functionality
- Event handling and integration
- Token usage tracking
- Command processing
- Error handling

### Files Added

- `services/mock-transcription-service.js` - Mock STT service
- `services/mock-tts-service.js` - Mock TTS service  
- `services/mock-stream-service.js` - Mock stream service
- `services/chat-session.js` - Chat session manager
- `scripts/text-chat.js` - Main CLI application
- `test/text-chat.test.js` - Test suite

### Files Modified

- `services/gpt-service.js` - Added token usage tracking
- `package.json` - Added `chat` script

## Use Cases

### Testing Conversation Flow
Test how Jessica responds to different scenarios:
- Anxiety and worry
- Repetitive questions
- Requests for news
- End-of-call scenarios

### Token Usage Analysis
Monitor API costs and optimize prompts:
- Track token consumption patterns
- Identify expensive conversation paths
- Test context window usage

### Function Testing
Verify function calls work correctly:
- News headline retrieval
- Call transfer scenarios
- Graceful call ending

### Development Workflow
- Rapid iteration on conversation logic
- Test new responses without phone calls
- Debug conversation context issues
- Validate AI behavior changes

## Troubleshooting

### "Missing OPENAI_API_KEY" Error
Ensure your `.env` file contains a valid OpenAI API key:
```
OPENAI_API_KEY=sk-...your-key-here
```

### High Token Usage
- Use `/reset` to clear conversation context
- Monitor context size with `/context` command
- Consider shorter system prompts for testing

### Function Calls Not Working
- Verify function files exist in `functions/` directory
- Check `functions/function-manifest.js` for proper definitions
- Use `/debug` to see service status

## Future Enhancements

Potential improvements for the text chat tool:

- **Conversation Export**: Save chat sessions to files
- **Multi-session Support**: Run multiple conversations simultaneously
- **Performance Metrics**: Response time tracking
- **Advanced Analytics**: Conversation pattern analysis
- **Custom Personas**: Test different AI personalities
- **Batch Testing**: Automated conversation scenarios