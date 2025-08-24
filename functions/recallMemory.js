/**
 * Function to recall stored information about Francine
 * The LLM should use this when it needs to remember specific details
 * that might have been mentioned in previous conversations
 */

require('colors');

async function recallMemory({ memory_key }) {
  // User-visible notification (for system monitoring, not for Francine)
  console.log(`🔍 Memory -> Recalling information: "${memory_key}"`.magenta);
  
  // Get memory service from global context (will be set by gpt-service)
  const memoryService = global.memoryService;
  
  if (!memoryService) {
    // Log error for system monitoring only
    console.error('⚠️  Memory service not initialized'.red);
    // Return gracefully without mentioning technical issues
    return JSON.stringify({
      success: false,
      content: null,
      // The AI should handle this gracefully without mentioning the error
      message: ''
    });
  }
  
  // Validate input
  if (!memory_key) {
    // Silently fail - the AI should handle this naturally
    return JSON.stringify({
      success: false,
      content: null,
      message: ''
    });
  }
  
  try {
    const memory = await memoryService.getMemory(memory_key);
    
    if (memory) {
      // Show user what was recalled
      console.log(`   ✓ Found memory in category: ${memory.category}`.magenta);
      console.log(`   Content: "${memory.content.substring(0, 60)}${memory.content.length > 60 ? '...' : ''}"`.gray);
      
      return JSON.stringify({
        success: true,
        key: memory.key,
        content: memory.content,
        category: memory.category,
        message: '' // Silent operation - AI uses content naturally without acknowledging
      });
    } else {
      // Try searching for partial matches if exact key not found
      const searchResults = await memoryService.searchMemories(memory_key);
      
      if (searchResults.length > 0) {
        // Return the first match
        const firstMatch = searchResults[0];
        console.log(`   ⚡ Found partial match: "${firstMatch.key}" in category: ${firstMatch.category}`.magenta);
        console.log(`   Content: "${firstMatch.content.substring(0, 60)}${firstMatch.content.length > 60 ? '...' : ''}"`.gray);
        
        // Update last accessed time for the partial match (don't wait for completion)
        memoryService.db.run(
          'UPDATE memories SET last_accessed = CURRENT_TIMESTAMP WHERE memory_key = ?', 
          [firstMatch.key]
        ).catch(err => console.error('Error updating last_accessed for partial match:', err));
        
        return JSON.stringify({
          success: true,
          key: firstMatch.key,
          content: firstMatch.content,
          category: firstMatch.category,
          message: '', // Silent operation - AI uses content naturally without acknowledging
          note: `Found as partial match for '${memory_key}'`
        });
      } else {
        console.log(`   ✗ No memory found for: "${memory_key}"`.yellow);
        // Don't mention that we don't have the information - let AI handle naturally
        return JSON.stringify({
          success: false,
          content: null,
          message: ''
        });
      }
    }
    
  } catch (error) {
    console.error('⚠️  Error in recallMemory:'.red, error.message);
    // Fail silently to the AI - never expose technical errors
    return JSON.stringify({
      success: false,
      content: null,
      message: ''
    });
  }
}

module.exports = recallMemory;