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
  constructor(markCompletionService, conversationAnalyzer = null, memoryService = null) {
    super();
    this.openai = new OpenAI();
    this.markCompletionService = markCompletionService;
    this.conversationAnalyzer = conversationAnalyzer;
    this.memoryService = memoryService;
    this.templateService = new TemplateService();

    // Store memory service in global context for functions to access
    if (memoryService) {
      global.memoryService = memoryService;
    }

    // Initialize system prompt (will be updated with memory keys)
    this.systemPrompt = '';
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

    // Get the system prompt with memory keys
    this.systemPrompt = this.templateService.getSystemPrompt(memoryKeys);
    
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
          partialResponse: `Hi there! • I understand you said "${text}" • How can I help you today?`,
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

        this.emit('gptreply', {
          partialResponseIndex: null,
          partialResponse: say
        }, interactionCount);
        
        // Track function call pre-message in analyzer
        if (this.conversationAnalyzer) {
          this.conversationAnalyzer.trackAssistantResponse(say, new Date());
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
        // Emit last partial response and add complete response to userContext
        if (content.trim().slice(-1) === '•' || finishReason === 'stop') {
          const gptReply = {
            partialResponseIndex: this.partialResponseIndex,
            partialResponse,
            isFinal: finishReason === 'stop'
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
