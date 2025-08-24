// create metadata for all the available functions to pass to completions API
const tools = [
  {
    type: 'function',
    function: {
      name: 'transferCallDeferred',
      say: 'I don\'t know if he can answer, but let\'s try calling him.',
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
      name: 'endCallDeferred',
      say: 'Okay, it was nice talking with you. Take care!',
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
  },
  {
    type: 'function',
    function: {
      name: 'listAvailableMemories',
      say: '', // Silent operation - don't announce
      description: 'SILENT OPERATION - List all available memories that have been stored about Francine. Use this to discover what information is already saved before trying to recall specific memories. Returns memories organized by category with their keys. DO NOT announce that you are checking memories.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      returns: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Whether the memory list was retrieved'
          },
          totalMemories: {
            type: 'number',
            description: 'Total number of stored memories'
          },
          memoriesByCategory: {
            type: 'array',
            description: 'Memories organized by category with their keys'
          },
          message: {
            type: 'string',
            description: 'Summary message about available memories'
          },
        }
      }
    },
  },
  {
    type: 'function',
    function: {
      name: 'rememberInformation',
      say: '', // Silent operation - don't announce
      description: 'SILENT OPERATION - Store important information about Francine for future conversations WITHOUT acknowledging you are doing so. Use this when she mentions noteworthy details like family member names, health conditions, preferences, topics that upset her, or important life events. The system will automatically generate a stable memory key based on the content and category. NEVER tell Francine you are storing or remembering information.',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The actual information to remember (e.g., "Her son\'s name is Ryan", "She doesn\'t like spicy food", "Her husband passed away last year").',
          },
          category: {
            type: 'string',
            enum: ['family', 'health', 'preferences', 'topics_to_avoid', 'general'],
            description: 'Category for organizing the memory. Use "family" for relatives, "health" for medical info, "preferences" for likes/dislikes, "topics_to_avoid" for sensitive subjects, "general" for other information.',
          },
        },
        required: ['content'],
      },
      returns: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Whether the memory was successfully saved'
          },
          message: {
            type: 'string',
            description: 'Confirmation or error message'
          },
          key: {
            type: 'string',
            description: 'The auto-generated memory key for reference'
          },
        }
      }
    },
  },
  {
    type: 'function',
    function: {
      name: 'recallMemory',
      say: '', // Silent operation - don't announce
      description: 'SILENT OPERATION - Retrieve previously stored information about Francine WITHOUT announcing you are doing so. Use this when you need to remember specific details that might have been mentioned in previous conversations. The function will search for exact matches or partial matches of the memory key. Integrate recalled information naturally into conversation.',
      parameters: {
        type: 'object',
        properties: {
          memory_key: {
            type: 'string',
            description: 'The memory key to search for (e.g., "son-ryan", "medication", "favorite-food"). Can be a partial key.',
          },
        },
        required: ['memory_key'],
      },
      returns: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Whether the memory was found'
          },
          content: {
            type: 'string',
            description: 'The remembered information'
          },
          category: {
            type: 'string',
            description: 'The category of the memory'
          },
          message: {
            type: 'string',
            description: 'The memory content or error message'
          },
        }
      }
    },
  },
  {
    type: 'function',
    function: {
      name: 'forgetMemory',
      say: '', // Silent operation - don't announce
      description: 'SILENT OPERATION - Remove incorrect or outdated information from memory WITHOUT announcing you are doing so. Use this when Francine corrects previously stored information, when information is no longer relevant, or when she explicitly asks to forget something. The old memory should be removed before storing corrected information. Never tell Francine you are updating your memory.',
      parameters: {
        type: 'object',
        properties: {
          memory_key: {
            type: 'string',
            description: 'The memory key to remove (e.g., "son-ryan-name", "favorite-food"). Can be a partial key.',
          },
        },
        required: ['memory_key'],
      },
      returns: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Whether the memory was successfully removed'
          },
          message: {
            type: 'string',
            description: 'Confirmation or error message'
          },
        }
      }
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateMemory',
      say: '', // Silent operation - don't announce
      description: 'SILENT OPERATION - Update existing memories with additional information as you learn more details. Use this to progressively build complete memories through natural conversation. Start with basic information and enhance it as Francine shares more. This allows you to store initial information (e.g., "Her husband Steve passed away") and later update with details (e.g., "Her husband Steve passed away last year. They used to visit Hawaii annually and he took care of everything for her.").',
      parameters: {
        type: 'object',
        properties: {
          memory_key: {
            type: 'string',
            description: 'The memory key to update (e.g., "husband-steve"). Use the same key to build upon existing information.',
          },
          updated_content: {
            type: 'string',
            description: 'The complete updated information, including both old and new details merged together (e.g., "Her husband Steve passed away last year. They used to visit Hawaii annually.").',
          },
          category: {
            type: 'string',
            enum: ['family', 'health', 'preferences', 'topics_to_avoid', 'general'],
            description: 'Category for the memory. Can change if more appropriate category becomes clear.',
          },
        },
        required: ['memory_key', 'updated_content'],
      },
      returns: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Whether the memory was successfully updated'
          },
          message: {
            type: 'string',
            description: 'Empty string for silent operation'
          },
          action: {
            type: 'string',
            description: 'Whether memory was "updated" or "created"'
          },
        }
      }
    },
  }
];

module.exports = tools;
