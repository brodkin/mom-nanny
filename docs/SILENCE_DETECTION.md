# Silence Detection Feature

## Overview

The silence detection feature automatically detects when a caller becomes unresponsive and handles the situation gracefully. This prevents calls from continuing indefinitely when a caller may have accidentally left the call open or is unable to respond due to technical issues.

## How It Works

### 1. Detection Trigger
- Silence detection starts when all queued audio has finished playing (no active marks)
- Uses the existing `MarkCompletionService` to detect when audio playback completes
- Starts a 5-second timer to wait for user response

### 2. First Response Check
After 5 seconds of silence with no audio playing:
- AI asks if the user is still there with a caring message
- Random selection from phrases like:
  - "Hello? Are you still there?"
  - "I'm still here if you need me."
  - "Is everything okay?"
  - "Are you still with me?"

### 3. Final Timeout
If no response after the check message:
- Wait another 5 seconds after the check message completes
- Send a graceful goodbye message
- Random selection from phrases like:
  - "I'll let you go for now. Take care!"
  - "Goodbye for now. I'm here whenever you need me."
  - "Have a wonderful day. Call me anytime!"
- Automatically end the call after 3 seconds (allowing goodbye to play)

### 4. Reset Conditions
Silence detection is reset/cancelled when:
- User responds while we're waiting for a silence response (utterance/transcription events when `isWaitingForResponse=true`)
- New audio starts playing (marks are added)  
- WebSocket connection closes

**Important**: Normal user utterances during regular conversation do NOT clear the silence timer - only responses that occur while we're actively waiting for a silence response will clear the timer.

## Implementation Details

### Key Variables (in app.js)
```javascript
let silenceTimer = null;           // Timer for silence detection
let isWaitingForResponse = false;  // Flag to prevent multiple timers
let hasAskedIfPresent = false;     // Flag to track if we've asked already
```

### Key Functions (in app.js)
```javascript
clearSilenceTimer()     // Clears timer and resets waiting state
startSilenceDetection() // Starts the 5-second silence detection timer
```

### Event Integration
- **`markCompletionService.on('all-marks-complete')`** - Triggers silence detection
- **`transcriptionService.on('utterance')`** - Clears silence detection
- **`transcriptionService.on('transcription')`** - Clears silence detection  
- **`ws.on('close')`** - Cleanup silence timers

## Testing

The feature includes comprehensive tests in `test/silence-detection.test.js`:
- Mark completion event integration
- Condition checking logic  
- Multiple mark handling
- Integration with existing services

## Configuration

No configuration required - the feature uses hardcoded timeouts:
- **5 seconds** - Initial silence detection
- **5 seconds** - Final timeout after "are you still there?"  
- **3 seconds** - Goodbye message playback time

## Logging

The feature provides console logging for debugging:
- `"All audio completed - starting silence detection"` (cyan)
- `"Silence detected - asking if user is still there"` (yellow)  
- `"No response received - ending call gracefully"` (yellow)
- `"Closing call due to unresponsive user"` (yellow)

## Compassionate Design

This feature is designed with the user's emotional needs in mind:
- Patient 5-second timeouts (not aggressive)
- Caring, non-judgmental language
- Graceful goodbye messages
- Maintains the system's compassionate tone
- Never shows frustration or impatience

## Future Enhancements

Potential improvements:
- Configurable timeout durations
- Integration with user anxiety levels
- Different messages based on conversation context
- Analytics tracking for silence patterns