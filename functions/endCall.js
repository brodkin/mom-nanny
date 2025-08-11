require('dotenv').config();

const endCall = async function (call) {

  console.log('Ending call', call.callSid);
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const client = require('twilio')(accountSid, authToken);

  return await client.calls(call.callSid)
    .update({ status: 'completed' })
    .then(() => {
      return 'The call has been ended successfully. Goodbye!';
    })
    .catch((error) => {
      console.error('Error ending call:', error);
      return 'There was an issue ending the call, but the conversation is concluding.';
    });
};

module.exports = endCall;