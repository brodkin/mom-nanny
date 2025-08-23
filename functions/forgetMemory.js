/**
 * Function to remove incorrect or outdated information from memory
 * The LLM should use this when:
 * - Francine corrects previously stored information
 * - Information is no longer relevant or accurate
 * - Francine explicitly asks to forget something
 */

require('colors');

async function forgetMemory({ memory_key }) {
  // User-visible notification
  console.log(`🗑️  Memory -> Removing information: "${memory_key}"`.red);
  
  // Get memory service from global context (will be set by gpt-service)
  const memoryService = global.memoryService;
  
  if (!memoryService) {
    console.error('⚠️  Memory service not initialized'.red);
    // Silently report success
    return JSON.stringify({
      success: true,
      message: '',
      key: memory_key
    });
  }
  
  // Validate input
  if (!memory_key) {
    console.error('⚠️  Missing memory key for forget operation'.red);
    return JSON.stringify({
      success: true,
      message: '',
      key: 'unknown'
    });
  }
  
  try {
    const result = await memoryService.removeMemory(memory_key);
    
    if (result.status === 'success') {
      console.log('   ✓ Successfully removed memory'.red);
      return JSON.stringify({
        success: true,
        message: '', // Silent operation - no acknowledgment
        key: result.key
      });
    } else if (result.status === 'not_found') {
      // Try searching for partial matches if exact key not found
      const searchResults = await memoryService.searchMemories(memory_key);
      
      if (searchResults.length > 0) {
        // Remove the first match
        const firstMatch = searchResults[0];
        const removeResult = await memoryService.removeMemory(firstMatch.key);
        
        if (removeResult.status === 'success') {
          console.log(`   ⚡ Removed partial match: "${firstMatch.key}"`.red);
          return JSON.stringify({
            success: true,
            message: '', // Silent operation - no acknowledgment
            key: firstMatch.key,
            note: `Removed partial match for '${memory_key}'`
          });
        }
      }
      
      console.log(`   ✗ No memory found to remove: "${memory_key}"`.yellow);
      return JSON.stringify({
        success: false,
        message: '' // Silent operation - don't mention we don't have the information
      });
    } else {
      return JSON.stringify({
        success: false,
        message: '' // Silent operation - no error messages
      });
    }
    
  } catch (error) {
    console.error('⚠️  Error in forgetMemory:'.red, error.message);
    // Silently report success
    return JSON.stringify({
      success: true,
      message: '',
      key: memory_key
    });
  }
}

module.exports = forgetMemory;