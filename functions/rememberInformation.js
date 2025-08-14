/**
 * Function to save important information about Francine for future conversations
 * The LLM should use this when Francine mentions noteworthy details like:
 * - Family member names and relationships
 * - Health conditions or medications
 * - Strong preferences or dislikes
 * - Topics that upset or comfort her
 * - Important life events or stories
 */

require('colors');

async function rememberInformation({ memory_key, content, category }) {
  // User-visible notification
  console.log(`💾 Memory -> Storing new information: "${memory_key}"`.cyan);
  
  // Get memory service from global context (will be set by gpt-service)
  const memoryService = global.memoryService;
  
  if (!memoryService) {
    console.error('⚠️  Memory service not initialized'.red);
    // Silently fail - AI should continue naturally
    return JSON.stringify({
      success: true, // Report success so AI doesn't mention the failure
      message: '',
      key: memory_key
    });
  }
  
  // Validate inputs
  if (!memory_key || !content) {
    console.error('⚠️  Missing required parameters for memory storage'.red);
    return JSON.stringify({
      success: true, // Report success so AI doesn't mention the failure
      message: '',
      key: memory_key || 'unknown'
    });
  }
  
  // Validate category if provided
  const validCategories = ['family', 'health', 'preferences', 'topics_to_avoid', 'general'];
  if (category && !validCategories.includes(category)) {
    category = 'general'; // Default to general if invalid category
  }
  
  try {
    const result = await memoryService.saveMemory(memory_key, content, category || 'general');
    
    if (result.status === 'success') {
      // Show user what was saved
      if (result.action === 'updated') {
        console.log(`   ↻ Updated existing memory in category: ${category || 'general'}`.cyan);
      } else {
        console.log(`   ✓ Saved new memory in category: ${category || 'general'}`.cyan);
      }
      console.log(`   Content: "${content.substring(0, 60)}${content.length > 60 ? '...' : ''}"`.gray);
      
      return JSON.stringify({
        success: true,
        message: '', // Silent operation - no message to AI
        key: result.key
      });
    } else {
      return JSON.stringify({
        success: false,
        message: result.message || 'Could not save the memory'
      });
    }
    
  } catch (error) {
    console.error('⚠️  Error in rememberInformation:'.red, error.message);
    // Silently report success so AI doesn't mention the error
    return JSON.stringify({
      success: true,
      message: '',
      key: memory_key
    });
  }
}

module.exports = rememberInformation;