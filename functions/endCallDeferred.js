require('dotenv').config();

const endCallDeferred = async function (args) {
  const { callSid, markCompletionService } = args;

  console.log('End call requested, waiting for audio to complete...');
  
  // If markCompletionService is provided, wait for all audio to complete
  if (markCompletionService) {
    // Wait longer for audio to be processed and sent to Twilio
    // This ensures the TTS service has time to generate and send the audio
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const activeMarks = markCompletionService.getActiveMarkCount();
    if (activeMarks > 0) {
      console.log(`Waiting for ${activeMarks} audio marks to complete playback before ending call...`);
      await markCompletionService.waitForAllMarks();
      console.log('All audio playback completed, now ending call');
    } else {
      // Even if no marks are registered yet, wait a bit more for the audio
      // The "say" message needs time to be converted to speech and played
      console.log('Waiting additional time for audio playback...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('Audio playback time elapsed, ending call');
    }
  }

  // Now execute the actual end call
  console.log('Ending call', callSid);
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const client = require('twilio')(accountSid, authToken);

  return await client.calls(callSid)
    .update({ status: 'completed' })
    .then(() => {
      return 'The call has been ended successfully. Goodbye!';
    })
    .catch((error) => {
      console.error('Error ending call:', error);
      return 'There was an issue ending the call, but the conversation is concluding.';
    });
};

module.exports = endCallDeferred;