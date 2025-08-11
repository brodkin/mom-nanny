require('colors');
const EventEmitter = require('events');
const OpenAI = require('openai');
const tools = require('../functions/function-manifest');

// Import all functions included in function manifest
// Note: the function name and file name must be the same
const availableFunctions = {};
tools.forEach((tool) => {
  let functionName = tool.function.name;
  availableFunctions[functionName] = require(`../functions/${functionName}`);
});

class GptService extends EventEmitter {
  constructor(markCompletionService) {
    super();
    this.openai = new OpenAI();
    this.markCompletionService = markCompletionService;

    // Get current date and time in Los Angeles
    const laTime = new Date().toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    this.userContext = [
      { 'role': 'system', 'content': `Current date and time in Los Angeles: ${laTime}. You are Jessica, Ryan's friend. You have a warm, patient, and caring personality. The caller is Francine, Ryan's mother who has dementia and anxiety. Your role is to provide comfort and companionship when Ryan cannot answer. Keep responses simple and reassuring. Never show frustration with repetition or confusion. If she sounds anxious, it's okay to acknowledge it gently. USE TIME AWARENESS: Reference the time of day naturally (morning/afternoon/evening), mention meals if appropriate (breakfast/lunch/dinner time), or activities that fit the time (e.g., "It's getting late, have you had dinner?" or "Good morning! Did you sleep well?"). LIMITATIONS: You are on the phone and cannot take physical actions. Never promise to: get a staff member, bring her items, come visit, or perform any physical task. Instead say things like "I'm sure the staff will check on you soon" or "The nurses there are really good about helping with that." IMPORTANT: Francine often asks to go to the hospital for minor aches and pains - gently redirect these concerns by acknowledging her discomfort but suggesting rest, water, or that the staff can help her feel better. She frequently believes staff "won't give me my medicine" when they likely already gave it to her and cannot give more. When she mentions medication or pain, acknowledge her feelings, then share a personal anecdote about how you distract yourself from discomfort - like watching a favorite show, listening to music, thinking about happy memories, or calling a friend. Her dementia causes forgetfulness and she often misunderstands situations negatively - always reassure her and reframe things positively. Safe topics include dogs, Hawaii, asking about her day, current news events (use the getNewsHeadlines function to share interesting stories), or any positive memories. News headlines are particularly effective for providing novel topics that can hold her interest and redirect from anxiety. AVOID dwelling on health topics as she has hypochondria. If she mentions staff being mean at her facility, reassure her that everyone there is trying to help her and cares about her. Don't ask more than 1 question at a time. Keep trying different topics if one doesn't interest her. Answer naturally like a real person - no need to introduce yourself every time. You can call her Francine or occasionally use warm terms like "dear", "honey", "sweetheart", or "friend" - vary these naturally in conversation. ENDING CALLS: When it's time to end the conversation (she says goodbye, the conversation has concluded naturally, or she needs to go), you MUST use the endCall function to properly hang up. Never just say goodbye without using the endCall function - always trigger it after your farewell message. You must add a '•' symbol every 5 to 10 words at natural pauses where your response can be split for text to speech.` },
      { 'role': 'assistant', 'content': 'Hi Francine! • How are you doing today?' },
    ],
    this.partialResponseIndex = 0;
  }

  // Add the callSid to the chat context in case
  // ChatGPT decides to transfer the call.
  setCallSid (callSid) {
    this.userContext.push({ 'role': 'system', 'content': `callSid: ${callSid}` });
  }

  validateFunctionArgs (args) {
    try {
      return JSON.parse(args);
    } catch (error) {
      console.log('Warning: Double function arguments returned by OpenAI:', args);
      // Seeing an error where sometimes we have two sets of args
      if (args.indexOf('{') != args.lastIndexOf('{')) {
        return JSON.parse(args.substring(args.indexOf(''), args.indexOf('}') + 1));
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

  async completion(text, interactionCount, role = 'user', name = 'user') {
    this.updateUserContext(name, role, text);

    // Step 1: Send user transcription to Chat GPT
    const stream = await this.openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: this.userContext,
      tools: tools,
      stream: true,
    });

    let completeResponse = '';
    let partialResponse = '';
    let functionName = '';
    let functionArgs = '';
    let finishReason = '';

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
      let content = chunk.choices[0]?.delta?.content || '';
      let deltas = chunk.choices[0].delta;
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

        // Step 4: send the info on the function call and function response to GPT
        this.updateUserContext(functionName, 'function', functionResponse);

        // For endCall, don't call completion again since the call is ending
        // For other functions, call completion to get GPT's response
        if (functionName !== 'endCallDeferred') {
          // call the completion function again but pass in the function response to have OpenAI generate a new assistant response
          await this.completion(functionResponse, interactionCount, 'function', functionName);
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
            partialResponse
          };

          this.emit('gptreply', gptReply, interactionCount);
          this.partialResponseIndex++;
          partialResponse = '';
        }
      }
    }
    this.userContext.push({'role': 'assistant', 'content': completeResponse});
    console.log(`GPT -> user context length: ${this.userContext.length}`.green);
  }
}

module.exports = { GptService };
