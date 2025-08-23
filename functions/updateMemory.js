/**
 * Function to update existing memories with additional information
 * The LLM should use this when learning more details about something already stored
 * This allows progressive memory building as conversation develops
 */

require('colors');

async function updateMemory({ memory_key, updated_content, category }) {
  // User-visible notification
  console.log(`🔄 Memory -> Updating information: "${memory_key}"`.yellow);
  
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
  if (!memory_key || !updated_content) {
    console.error('⚠️  Missing required parameters for memory update'.red);
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
    // First check if the memory exists
    const existingMemory = await memoryService.getMemory(memory_key);
    
    if (existingMemory) {
      // PROTECT FACTS: Check if this is a protected fact before updating
      if (existingMemory.is_fact) {
        console.log(`   🔒 Blocked attempt to update protected fact: "${memory_key}"`.yellow);
        return JSON.stringify({
          success: false,
          message: 'This is a verified fact from caregivers and cannot be updated. If you have additional helpful information, please store it as a new memory with a different key.',
          key: memory_key
        });
      }
      
      // Update existing memory with new content (preserve is_fact status)
      const result = await memoryService.saveMemory(memory_key, updated_content, category || existingMemory.category, existingMemory.is_fact);
      
      if (result.status === 'success') {
        console.log(`   ✓ Updated memory in category: ${category || existingMemory.category}`.yellow);
        console.log(`   Old: "${existingMemory.content.substring(0, 60)}${existingMemory.content.length > 60 ? '...' : ''}"`.gray);
        console.log(`   New: "${updated_content.substring(0, 60)}${updated_content.length > 60 ? '...' : ''}"`.cyan);
        
        return JSON.stringify({
          success: true,
          message: '', // Silent operation - no message to AI
          key: result.key,
          action: 'updated'
        });
      } else {
        return JSON.stringify({
          success: false,
          message: '', // Silent operation
          key: memory_key
        });
      }
    } else {
      // Memory doesn't exist yet, create it
      const result = await memoryService.saveMemory(memory_key, updated_content, category || 'general');
      
      if (result.status === 'success') {
        console.log(`   ✓ Created new memory in category: ${category || 'general'}`.yellow);
        console.log(`   Content: "${updated_content.substring(0, 60)}${updated_content.length > 60 ? '...' : ''}"`.cyan);
        
        return JSON.stringify({
          success: true,
          message: '', // Silent operation - no message to AI
          key: result.key,
          action: 'created'
        });
      } else {
        return JSON.stringify({
          success: false,
          message: '', // Silent operation
          key: memory_key
        });
      }
    }
    
  } catch (error) {
    console.error('⚠️  Error in updateMemory:'.red, error.message);
    // Silently report success so AI doesn't mention the error
    return JSON.stringify({
      success: true,
      message: '',
      key: memory_key
    });
  }
}

module.exports = updateMemory;