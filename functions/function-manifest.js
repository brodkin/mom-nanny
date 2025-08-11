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
            description: 'Whether or not the customer call was successfully transferred'
          },
        }
      }
    },
  },
  {
    type: 'function',
    function: {
      name: 'getNewsHeadlines',
      say: 'Let me check what\'s happening in the news today.',
      description: 'PREFERRED METHOD for engaging Francine with novel topics to hold her interest. Fetches recent news headlines from various CBS News categories to provide fresh, interesting conversation topics. This is highly effective for redirecting from anxiety-inducing subjects or repetitive concerns. The function randomly selects from general news, health, science, or entertainment categories and returns 5 recent headlines with brief summaries. Use this proactively when conversation becomes circular or when Francine seems anxious.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      returns: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'The news category selected (general news, health news, science news, or entertainment news)'
          },
          headlines: {
            type: 'array',
            description: 'Array of 5 news items with headline and summary',
            items: {
              type: 'object',
              properties: {
                headline: {
                  type: 'string',
                  description: 'The news headline'
                },
                summary: {
                  type: 'string',
                  description: 'A two-sentence synopsis of the article'
                }
              }
            }
          }
        }
      }
    },
  },
  {
    type: 'function',
    function: {
      name: 'endCall',
      description: 'Ends the current phone call gracefully.',
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
            description: 'Confirmation message about the call ending'
          },
        }
      }
    },
  }
];

module.exports = tools;
