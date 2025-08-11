// create metadata for all the available functions to pass to completions API
const tools = [
  {
    type: 'function',
    function: {
      name: 'transferCall',
      say: 'One moment while I transfer your call.',
      description: 'Transfers Francine to Ryan. IMPORTANT: Francine often exaggerates situations due to her condition and anxiety. She may claim to be dying or in an emergency when she is not. Carefully assess whether there is a GENUINE emergency (e.g., actual medical distress, fall with injury, inability to breathe) before using this function. Most situations can be handled with reassurance and redirection.',
      parameters: {
        type: 'object',
        properties: {
          callSid: {
            type: 'string',
            description: 'The unique identifier for the active phone call.',
          },
        },
        required: ['callSid'],
      },
      returns: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Whether or not the customer call was successfully transfered'
          },
        }
      }
    },
  }
];

module.exports = tools;
