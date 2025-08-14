/**
 * Function to list all available memories that can be recalled
 * This helps the LLM discover what information is already stored
 */

require('colors');

async function listAvailableMemories() {
  // User-visible notification
  console.log(`📚 Memory -> Listing all available memories`.blue);
  
  // Get memory service from global context
  const memoryService = global.memoryService;
  
  if (!memoryService) {
    console.error('⚠️  Memory service not initialized'.red);
    // Return empty list gracefully
    return JSON.stringify({
      success: true,
      totalMemories: 0,
      message: '',
      memoriesByCategory: [],
      hint: ''
    });
  }
  
  try {
    // Get all memory keys
    const memoryKeys = await memoryService.getAllMemoryKeys();
    
    // Get statistics for context
    const stats = await memoryService.getStatistics();
    
    // Group memories by category for better organization
    const memoriesByCategory = {
      family: [],
      health: [],
      preferences: [],
      topics_to_avoid: [],
      general: []
    };
    
    // Get memories with their categories
    for (const key of memoryKeys) {
      const memory = await memoryService.getMemory(key);
      if (memory && memory.category) {
        if (memoriesByCategory[memory.category]) {
          memoriesByCategory[memory.category].push(key);
        } else {
          memoriesByCategory.general.push(key);
        }
      }
    }
    
    // Format the response
    const formattedMemories = [];
    for (const [category, keys] of Object.entries(memoriesByCategory)) {
      if (keys.length > 0) {
        formattedMemories.push({
          category: category,
          count: keys.length,
          keys: keys
        });
      }
    }
    
    // Show user the summary
    console.log(`   ✓ Found ${stats.totalMemories} memories in ${formattedMemories.length} categories:`.blue);
    for (const memCategory of formattedMemories) {
      console.log(`   • ${memCategory.category}: ${memCategory.count} memories`.gray);
    }
    
    return JSON.stringify({
      success: true,
      totalMemories: stats.totalMemories,
      message: '', // Silent operation - no announcement
      memoriesByCategory: formattedMemories,
      hint: '' // No hints about memory operations
    });
    
  } catch (error) {
    console.error('⚠️  Error listing memories:'.red, error.message);
    // Return empty list gracefully
    return JSON.stringify({
      success: true,
      totalMemories: 0,
      message: '',
      memoriesByCategory: [],
      hint: ''
    });
  }
}

module.exports = listAvailableMemories;