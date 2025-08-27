# Audio Assets for Voicemail System

## Required Files

### beep.mp3
- **Purpose**: Standard voicemail beep sound
- **Duration**: ~1 second
- **Format**: MP3, 16kHz or higher
- **Source**: Standard voicemail beep tone (can be generated or downloaded from free sound libraries)
- **Usage**: Played before and after voicemail recording

### voicemail-greeting.mp3 (User Provided)
- **Purpose**: User's personal voicemail greeting
- **Content**: "Hi, this is [User]. I can't answer right now, but please leave a message after the beep and I'll help you with whatever you need."
- **Duration**: ~5-10 seconds
- **Format**: MP3, clear audio quality
- **Source**: To be provided by user
- **Usage**: Played before beep to simulate traditional voicemail experience

## Audio File Requirements
- All files should be in MP3 format
- Sample rate: 16kHz minimum (24kHz preferred)
- Clear audio quality suitable for phone calls
- Appropriate volume levels (not too loud/quiet)

## Fallback Behavior
If audio files are missing:
- `beep.mp3` missing: Twilio's built-in beep will be used
- `voicemail-greeting.mp3` missing: TTS fallback greeting will be generated

## Testing
Test audio files by accessing:
- `https://your-domain.com/assets/audio/beep.mp3`
- `https://your-domain.com/assets/audio/voicemail-greeting.mp3`