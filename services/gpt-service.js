require('colors');
const EventEmitter = require('events');
const OpenAI = require('openai');
const tools = require('../functions/function-manifest');
const TemplateService = require('./template-service');

// Import all functions included in function manifest
// Note: the function name and file name must be the same
const availableFunctions = {};
tools.forEach((tool) => {
  let functionName = tool.function.name;
  availableFunctions[functionName] = require(`../functions/${functionName}`);
});

class GptService extends EventEmitter {
  constructor(markCompletionService, conversationAnalyzer = null, memoryService = null, databaseManager = null, persona = 'jessica') {
    super();
    this.openai = new OpenAI();
    this.markCompletionService = markCompletionService;
    this.conversationAnalyzer = conversationAnalyzer;
    this.memoryService = memoryService;
    this.databaseManager = databaseManager;
    this.persona = persona; // Store persona for template service
    this.templateService = new TemplateService();

    // Store memory service in global context for functions to access
    if (memoryService) {
      global.memoryService = memoryService;
    }

    // Initialize system prompt (will be updated with memory keys)
    this.systemPrompt = '';
    this.callStats = null; // Store call frequency data for access
    this.userContext = [
      { 'role': 'system', 'content': 'Initializing...' },
      { 'role': 'assistant', 'content': 'Hi Francine! • How are you doing today?' },
    ],
    this.partialResponseIndex = 0;
  }

  async initialize() {
    // Get memory keys if memory service is available
    let memoryKeys = [];
    if (this.memoryService) {
      try {
        await this.memoryService.initialize();
        memoryKeys = await this.memoryService.getAllMemoryKeys();
        if (memoryKeys.length > 0) {
          console.log(`📂 Memory -> Loaded ${memoryKeys.length} stored memories for Francine`.cyan);
        }
      } catch (error) {
        console.error('Error loading memory keys:', error);
      }
    }

    // Get today's call statistics if database manager is available
    if (this.databaseManager) {
      try {
        await this.databaseManager.waitForInitialization();
        this.callStats = await this.databaseManager.getTodayCallStats();
        if (this.callStats.callsToday > 0) {
          console.log(`📞 Call Frequency -> ${this.callStats.callsToday} calls today, last call ${this.callStats.timeSinceLastCall}`.cyan);
        }
      } catch (error) {
        console.error('Error loading call frequency data:', error);
      }
    }

    // Get the system prompt with memory keys, call frequency data, and persona
    this.systemPrompt = this.templateService.getSystemPrompt(memoryKeys, this.callStats, this.persona);
    
    // Update the system context with the full prompt
    this.userContext[0] = { 'role': 'system', 'content': this.systemPrompt };
  }

  // Add the callSid to the chat context in case
  // ChatGPT decides to transfer the call.
  setCallSid (callSid) {
    this.userContext.push({ 'role': 'system', 'content': `callSid: ${callSid}` });
  }

  // Set conversation analyzer for tracking
  setConversationAnalyzer(analyzer) {
    this.conversationAnalyzer = analyzer;
  }

  // Get call frequency statistics (for progressive delay calculation)
  getCallStats() {
    return this.callStats;
  }

  validateFunctionArgs (args) {
    try {
      // Safe parsing with prototype pollution protection
      return JSON.parse(args, (key, value) => {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          return undefined;
        }
        return value;
      });
    } catch (error) {
      console.log('Warning: Double function arguments returned by OpenAI:', args);
      // Seeing an error where sometimes we have two sets of args
      if (args.indexOf('{') != args.lastIndexOf('{')) {
        return JSON.parse(args.substring(args.indexOf('{'), args.indexOf('}') + 1), (key, value) => {
          if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            return undefined;
          }
          return value;
        });
      }
    }
  }

  updateUserContext(name, role, text) {
    if (name !== 'user') {
      this.userContext.push({ 'role': role, 'name': name, 'content': text });
    } else {
      this.userContext.push({ 'role': role, 'content': text });
    }
  }

  async analyzeEmotionalState(conversationTranscript) {
    // Create conversation text from transcript
    let conversationText = '';
    if (Array.isArray(conversationTranscript)) {
      // Handle array of interactions (from conversationAnalyzer.interactions)
      conversationText = conversationTranscript.map(interaction => {
        const timestamp = new Date(interaction.timestamp).toLocaleTimeString();
        if (interaction.type === 'user_utterance') {
          return `[${timestamp}] User: ${interaction.text}`;
        } else if (interaction.type === 'assistant_response') {
          return `[${timestamp}] Assistant: ${interaction.text}`;
        }
        return '';
      }).filter(line => line.length > 0).join('\n');
    } else if (typeof conversationTranscript === 'string') {
      conversationText = conversationTranscript;
    } else {
      throw new Error('Invalid conversation transcript format');
    }

    // In test environment, return mock emotional analysis
    if (process.env.NODE_ENV === 'test') {
      return {
        anxietyLevel: 25.5,
        anxietyPeak: 65.0,
        anxietyTrend: 'decreasing',
        confusionLevel: 40.0,
        confusionPeak: 75.0,
        confusionTrend: 'stable',
        agitationLevel: 15.0,
        agitationPeak: 30.0,
        agitationTrend: 'stable',
        overallMood: 20.5,
        moodTrend: 'improving',
        analysisConfidence: 0.85,
        keyObservations: [
          'Mock analysis for testing',
          'Simulated emotional metrics'
        ]
      };
    }

    // System prompt for emotional analysis with clear transcript-based scoring criteria
    const emotionalAnalysisPrompt = `You are an expert geriatric psychiatrist analyzing a dementia care conversation. Evaluate ONLY what you can observe in the transcript text.

ANXIETY SCORING (0-100):
• 0-20: Calm, engaged, no verbal distress
• 20-40: Mild worry expressions, seeks reassurance, accepts comfort  
• 40-60: Repeated worry statements, multiple reassurance requests, difficulty accepting comfort
• 60-80: Catastrophizing language, unable to redirect from worries
• 80-100: Severe verbal distress, panic expressions, overwhelming fear statements

CONFUSION SCORING (0-100) - Key transcript indicators:
• Self-contradictions: "I haven't eaten" then "I just had lunch" (+20-30 points)
• Not remembering recent statements: "I didn't say that" when they just did (+20-30 points)
• Frequent repetition: Same question 3+ times (+10-20 points per cluster)
• Temporal disorientation: Wrong decade, thinking deceased are alive (+20-30 points)
• Identity confusion: Not knowing who/where they are (+40-50 points)
• Baseline: 1-2 repetitions normal for dementia (don't over-penalize)

AGITATION SCORING (0-100):
• 0-20: Cooperative, no verbal resistance
• 20-40: Mild frustration, complaints but redirectable
• 40-60: Argumentative, refuses suggestions, verbal resistance
• 60-80: Hostile language, accusations
• 80-100: Verbal aggression, threats, extreme outbursts

MOOD SCORING (-100 to +100):
• Positive: Laughter, gratitude, pleasant memories, engagement
• Negative: Expressions of sadness, hopelessness, fear, crying
• Weight final 30% of conversation 2x more than beginning

Return structured JSON with exact numeric fields.`;

    // Tool definition for structured output
    const emotionalAnalysisTool = {
      type: 'function',
      function: {
        name: 'reportEmotionalAnalysis',
        description: 'Report structured emotional analysis of the conversation',
        parameters: {
          type: 'object',
          properties: {
            anxietyLevel: {
              type: 'number',
              description: 'Overall anxiety level (0-100) based on verbal distress, worry expressions, and reassurance-seeking patterns',
              minimum: 0,
              maximum: 100
            },
            anxietyPeak: {
              type: 'number', 
              description: 'Peak anxiety level during conversation (0-100) - highest point of verbal distress or panic expressions',
              minimum: 0,
              maximum: 100
            },
            anxietyTrend: {
              type: 'string',
              enum: ['increasing', 'decreasing', 'stable', 'fluctuating'],
              description: 'Trend of anxiety throughout conversation - weight final 30% more heavily'
            },
            confusionLevel: {
              type: 'number',
              description: 'Overall confusion level (0-100) based on self-contradictions, memory gaps, and repetitive statements beyond dementia baseline',
              minimum: 0,
              maximum: 100
            },
            confusionPeak: {
              type: 'number',
              description: 'Peak confusion level during conversation (0-100) - highest point of disorientation or contradictory statements', 
              minimum: 0,
              maximum: 100
            },
            confusionTrend: {
              type: 'string',
              enum: ['increasing', 'decreasing', 'stable', 'fluctuating'],
              description: 'Trend of confusion throughout conversation - distinguish from normal dementia repetition patterns'
            },
            agitationLevel: {
              type: 'number',
              description: 'Overall agitation level (0-100) based on verbal resistance, argumentative language, and hostility expressions',
              minimum: 0,
              maximum: 100
            },
            agitationPeak: {
              type: 'number',
              description: 'Peak agitation level during conversation (0-100) - highest point of verbal aggression or resistance',
              minimum: 0,
              maximum: 100
            },
            agitationTrend: {
              type: 'string',
              enum: ['increasing', 'decreasing', 'stable', 'fluctuating'],
              description: 'Trend of agitation throughout conversation - consider successful redirection as positive indicator'
            },
            overallMood: {
              type: 'number',
              description: 'Overall mood score (-100 to +100, negative is sad/distressed, positive is happy/content) based on laughter, gratitude, or sadness expressions',
              minimum: -100,
              maximum: 100
            },
            moodTrend: {
              type: 'string',
              enum: ['improving', 'declining', 'stable', 'fluctuating'],
              description: 'Trend of mood throughout conversation - weight final 30% of conversation 2x more heavily'
            },
            analysisConfidence: {
              type: 'number',
              description: 'Confidence in analysis (0.0 to 1.0) - lower for ambiguous conversations or limited transcript data',
              minimum: 0.0,
              maximum: 1.0
            },
            keyObservations: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Key observations about emotional state (2-5 items) - specific transcript-based evidence for scoring decisions',
              minItems: 2,
              maxItems: 5
            }
          },
          required: [
            'anxietyLevel', 'anxietyPeak', 'anxietyTrend',
            'confusionLevel', 'confusionPeak', 'confusionTrend', 
            'agitationLevel', 'agitationPeak', 'agitationTrend',
            'overallMood', 'moodTrend', 'analysisConfidence', 'keyObservations'
          ]
        }
      }
    };

    try {
      // Create the analysis request
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-1106-preview',
        messages: [
          { role: 'system', content: emotionalAnalysisPrompt },
          { role: 'user', content: `Please analyze this conversation for emotional state:\n\n${conversationText}` }
        ],
        tools: [emotionalAnalysisTool],
        tool_choice: { type: 'function', function: { name: 'reportEmotionalAnalysis' } },
        temperature: 0.3 // Lower temperature for more consistent analysis
      });

      // Extract the function call result
      const choice = response.choices[0];
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        const toolCall = choice.message.tool_calls[0];
        if (toolCall.function.name === 'reportEmotionalAnalysis') {
          const analysisResult = JSON.parse(toolCall.function.arguments);
          
          // Validate and ensure all required numeric fields are present with defaults
          const validatedResult = {
            anxietyLevel: Number(analysisResult.anxietyLevel) || 0,
            anxietyPeak: Number(analysisResult.anxietyPeak) || 0,
            anxietyTrend: analysisResult.anxietyTrend || 'stable',
            confusionLevel: Number(analysisResult.confusionLevel) || 0,
            confusionPeak: Number(analysisResult.confusionPeak) || 0,
            confusionTrend: analysisResult.confusionTrend || 'stable',
            agitationLevel: Number(analysisResult.agitationLevel) || 0,
            agitationPeak: Number(analysisResult.agitationPeak) || 0,
            agitationTrend: analysisResult.agitationTrend || 'stable',
            overallMood: Number(analysisResult.overallMood) || 0,
            moodTrend: analysisResult.moodTrend || 'stable',
            analysisConfidence: Number(analysisResult.analysisConfidence) || 0.5,
            keyObservations: Array.isArray(analysisResult.keyObservations) ? 
              analysisResult.keyObservations : ['No specific observations']
          };

          return validatedResult;
        }
      }

      throw new Error('No valid emotional analysis function call returned');

    } catch (error) {
      // HIPAA COMPLIANCE: Never log full error object as it may contain emotional analysis data (PHI)
      console.error('GPT Emotional Analysis Error:', error.message);
      
      // Return default values if analysis fails
      return {
        anxietyLevel: 0,
        anxietyPeak: 0,
        anxietyTrend: 'stable',
        confusionLevel: 0,
        confusionPeak: 0,
        confusionTrend: 'stable',
        agitationLevel: 0,
        agitationPeak: 0,
        agitationTrend: 'stable',
        overallMood: 0,
        moodTrend: 'stable',
        analysisConfidence: 0.0,
        keyObservations: ['Analysis failed - using default values']
      };
    }
  }

  async generateMemoryKey(content, category) {
    // In test environment, return deterministic mock key
    if (process.env.NODE_ENV === 'test') {
      // Create a simple deterministic key for testing
      const cleanContent = content.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      const words = cleanContent.split(/\s+/).slice(0, 3);
      return `${category}-${words.join('-')}-info`;
    }

    const keyGenerationPrompt = `Generate a stable memory key (3-6 words) that identifies WHAT this memory is about, not the specific changeable details.

CRITICAL: The patient (Francine) is the PRIMARY SUBJECT of most memories unless explicitly about someone else.

KEY STRUCTURE RULES:
- For memories about the patient: always start with "patient-"
- For memories about specific people: use their name (e.g., "ryan-", "gary-", "mary-")
- Use information types (onset, history, routine, preferences) NOT specific details
- Never include: locations, jobs, times, quantities, ages, or current states
- Key must remain valid even if every detail in the memory changes

Memory content: ${content}
Category: ${category}

Examples of GOOD patient-centered keys:
- "patient-dementia-onset" (for "Patient's dementia began in 2024...")
- "patient-medical-history" (for patient's health conditions)
- "patient-daily-routine" (for patient's schedule/activities) 
- "patient-medication-routine" (for patient's medication info)
- "patient-food-preferences" (for patient's dietary likes/dislikes)
- "patient-anxiety-triggers" (for things that cause patient distress)
- "patient-comfort-strategies" (for what helps calm the patient)

Examples for family/others (when memory is explicitly about someone else):
- "mary-basic-information" (for info about Mary, the patient's daughter)
- "ryan-contact-information" (for info about Ryan and how to reach him)
- "gary-health-status" (for info about Gary's health issues)

IMPORTANT: Default to patient-centered unless the content is clearly about someone else.

Return only the key in lowercase with hyphens, nothing else.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-1106-preview',
        messages: [
          { role: 'system', content: keyGenerationPrompt }
        ],
        temperature: 0.1, // Low temperature for consistency
        max_tokens: 50
      });

      let generatedKey = response.choices[0]?.message?.content?.trim();
      
      if (!generatedKey) {
        throw new Error('No key generated by GPT');
      }

      // Clean and validate the key
      generatedKey = generatedKey
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '') // Remove non-alphanumeric except hyphens
        .replace(/--+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

      // Ensure key is not empty and has reasonable length
      if (!generatedKey || generatedKey.length < 3 || generatedKey.length > 50) {
        throw new Error('Generated key failed validation');
      }

      return generatedKey;

    } catch (error) {
      console.error('Error generating memory key:', error.message);
      
      // Fallback: create a simple key from category and first few words
      const cleanContent = content.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      const words = cleanContent.split(/\s+/).slice(0, 2);
      const fallbackKey = `${category}-${words.join('-')}-info`;
      
      console.log(`Using fallback key: ${fallbackKey}`);
      return fallbackKey;
    }
  }

  async completion(text, interactionCount, role = 'user', name = 'user', returnUsage = false) {
    this.updateUserContext(name, role, text);

    // NOTE: User utterances are tracked in chat-session.js or app.js
    // to avoid duplicates. This was causing messages to be saved twice.

    // In test environment, return mock response to prevent OpenAI API calls
    // This allows testing of chat flow without making expensive API calls
    if (process.env.NODE_ENV === 'test') {
      // Emit a mock GPT reply that mimics real behavior
      setTimeout(() => {
        this.emit('gptreply', {
          partialResponseIndex: 0,
          partialResponse: `Hi there! I understand you said "${text}" How can I help you today?`,
          isFinal: true
        }, interactionCount);
      }, 10);
      
      // Return mock usage data if requested
      return returnUsage ? {
        usage: {
          prompt_tokens: Math.max(20, text.length * 1.2), // Realistic token estimation
          completion_tokens: 25,
          total_tokens: Math.max(45, text.length * 1.2 + 25)
        }
      } : {};
    }

    // Step 1: Send user transcription to Chat GPT
    const stream = await this.openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: this.userContext,
      tools: tools,
      stream: true,
      stream_options: returnUsage ? { include_usage: true } : undefined,
    });

    let completeResponse = '';
    let partialResponse = '';
    let functionName = '';
    let functionArgs = '';
    let finishReason = '';
    let usageData = null;

    function collectToolInformation(deltas) {
      let name = deltas.tool_calls[0]?.function?.name || '';
      if (name != '') {
        functionName = name;
      }
      let args = deltas.tool_calls[0]?.function?.arguments || '';
      if (args != '') {
        // args are streamed as JSON string so we need to concatenate all chunks
        functionArgs += args;
      }
    }

    for await (const chunk of stream) {
      // Collect usage data when available
      if (chunk.usage && returnUsage) {
        usageData = chunk.usage;
      }
      
      // Safely access choices array
      if (!chunk.choices || !chunk.choices[0]) {
        continue;
      }
      
      let content = chunk.choices[0]?.delta?.content || '';
      let deltas = chunk.choices[0]?.delta;
      finishReason = chunk.choices[0].finish_reason;

      // Step 2: check if GPT wanted to call a function
      if (deltas.tool_calls) {
        // Step 3: Collect the tokens containing function data
        collectToolInformation(deltas);
      }

      // need to call function on behalf of Chat GPT with the arguments it parsed from the conversation
      if (finishReason === 'tool_calls') {
        // parse JSON string of args into JSON object

        const functionToCall = availableFunctions[functionName];
        const validatedArgs = this.validateFunctionArgs(functionArgs);

        // Say a pre-configured message from the function manifest
        // before running the function.
        const toolData = tools.find(tool => tool.function.name === functionName);
        const say = toolData.function.say;

        // Remove bullets from function call messages before emitting
        const cleanedSay = say ? say.replace(/•/g, '').trim() : '';

        this.emit('gptreply', {
          partialResponseIndex: null,
          partialResponse: cleanedSay
        }, interactionCount);
        
        // Track function call pre-message in analyzer
        if (this.conversationAnalyzer) {
          this.conversationAnalyzer.trackAssistantResponse(cleanedSay, new Date());
        }

        // For transfer and endCall functions, pass the markCompletionService
        let functionResponse;
        if (functionName === 'transferCallDeferred' || functionName === 'endCallDeferred') {
          // Add delay to ensure the "say" message gets processed through TTS and marked
          // This allows the audio to be generated, sent, and queued before we check for marks
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const argsWithService = {
            ...validatedArgs,
            markCompletionService: this.markCompletionService
          };
          functionResponse = await functionToCall(argsWithService);
        } else {
          functionResponse = await functionToCall(validatedArgs);
        }

        // Track function call in analyzer
        if (this.conversationAnalyzer) {
          this.conversationAnalyzer.trackFunctionCall(functionName, validatedArgs, new Date());
        }

        // Step 4: send the info on the function call and function response to GPT
        this.updateUserContext(functionName, 'function', functionResponse);

        // For endCall, don't call completion again since the call is ending
        // For other functions, call completion to get GPT's response
        if (functionName !== 'endCallDeferred') {
          // call the completion function again but pass in the function response to have OpenAI generate a new assistant response
          const recursiveResult = await this.completion(functionResponse, interactionCount, 'function', functionName, returnUsage);
          if (returnUsage && recursiveResult?.usage) {
            // Accumulate usage from recursive calls
            if (usageData) {
              usageData.prompt_tokens += recursiveResult.usage.prompt_tokens || 0;
              usageData.completion_tokens += recursiveResult.usage.completion_tokens || 0;
              usageData.total_tokens += recursiveResult.usage.total_tokens || 0;
            } else {
              usageData = recursiveResult.usage;
            }
          }
        }
      } else {
        // We use completeResponse for userContext
        completeResponse += content;
        // We use partialResponse to provide a chunk for TTS
        partialResponse += content;
        
        // Check if content ends with a bullet point (indicating a complete chunk)
        if (content.trim().endsWith('•')) {
          // Remove bullets from the response before emitting
          const cleanedResponse = partialResponse.trim().replace(/•$/, '').trim();
          
          const gptReply = {
            partialResponseIndex: this.partialResponseIndex,
            partialResponse: cleanedResponse,
            isFinal: false
          };

          this.emit('gptreply', gptReply, interactionCount);
          
          // Track assistant response in analyzer
          if (this.conversationAnalyzer) {
            this.conversationAnalyzer.trackAssistantResponse(gptReply.partialResponse, new Date());
          }
          
          this.partialResponseIndex++;
          partialResponse = '';
        }
        
        // Emit final response when stream ends
        if (finishReason === 'stop' && partialResponse.trim()) {
          // Remove any trailing bullets from final response
          const cleanedResponse = partialResponse.trim().replace(/•$/, '').trim();
          
          const gptReply = {
            partialResponseIndex: this.partialResponseIndex,
            partialResponse: cleanedResponse,
            isFinal: true
          };

          this.emit('gptreply', gptReply, interactionCount);
          
          // Track assistant response in analyzer
          if (this.conversationAnalyzer) {
            this.conversationAnalyzer.trackAssistantResponse(gptReply.partialResponse, new Date());
          }
          
          this.partialResponseIndex++;
          partialResponse = '';
        }
      }
    }
    this.userContext.push({'role': 'assistant', 'content': completeResponse});
    // Context length tracked internally, no need to log during conversation
    
    if (returnUsage) {
      return {
        response: completeResponse,
        usage: usageData,
        contextLength: this.userContext.length
      };
    }
  }
}

module.exports = { GptService };
