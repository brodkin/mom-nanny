#!/usr/bin/env node

/**
 * Script to regenerate memory keys based on their content using the updated GPT prompt
 * 
 * Usage:
 *   node scripts/regenerate-memory-keys.js                    # Regenerate all keys
 *   node scripts/regenerate-memory-keys.js "old-key-name"     # Regenerate specific key
 *   node scripts/regenerate-memory-keys.js --dry-run          # Preview changes without updating
 */

const path = require('path');
process.chdir(path.join(__dirname, '..'));

const DatabaseManager = require('../services/database-manager');
const { GptService } = require('../services/gpt-service');

async function regenerateMemoryKeys() {
  const args = process.argv.slice(2);
  const specificKey = args.find(arg => !arg.startsWith('--'));
  const isDryRun = args.includes('--dry-run');
  
  console.log('🔄 Memory Key Regeneration Tool\n');
  
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  try {
    // Initialize services
    const dbManager = DatabaseManager.getInstance();
    await dbManager.waitForInitialization();
    
    const gptService = new GptService();
    
    // Get memories to process
    let memories;
    if (specificKey) {
      console.log(`🎯 Processing specific key: "${specificKey}"\n`);
      memories = await dbManager.all(
        'SELECT * FROM memories WHERE memory_key = ?',
        [specificKey]
      );
      
      if (memories.length === 0) {
        console.log(`❌ No memory found with key: "${specificKey}"`);
        process.exit(1);
      }
    } else {
      console.log('🗂️  Processing all memories\n');
      memories = await dbManager.all(
        'SELECT * FROM memories ORDER BY updated_at DESC'
      );
    }
    
    if (memories.length === 0) {
      console.log('📭 No memories found in database');
      process.exit(0);
    }
    
    console.log(`📊 Found ${memories.length} memor${memories.length === 1 ? 'y' : 'ies'} to process\n`);
    
    let updated = 0;
    let unchanged = 0;
    let errors = 0;
    
    for (const memory of memories) {
      const { memory_key: oldKey, memory_content: content, category } = memory;
      
      try {
        console.log(`🔍 Processing: "${oldKey}"`);
        console.log(`   Content: "${content.substring(0, 80)}${content.length > 80 ? '...' : ''}"`);
        
        // Generate new key using updated GPT prompt
        const newKey = await gptService.generateMemoryKey(content, category);
        
        if (newKey === oldKey) {
          console.log(`   ✅ Key unchanged: "${oldKey}"`);
          unchanged++;
        } else {
          console.log(`   🔄 Key change: "${oldKey}" → "${newKey}"`);
          
          if (!isDryRun) {
            // Check if new key already exists
            const existing = await dbManager.get(
              'SELECT id FROM memories WHERE memory_key = ? AND id != ?',
              [newKey, memory.id]
            );
            
            if (existing) {
              console.log(`   ⚠️  Conflict: Key "${newKey}" already exists. Skipping update.`);
              errors++;
            } else {
              // Update the key
              await dbManager.run(
                'UPDATE memories SET memory_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newKey, memory.id]
              );
              console.log('   ✅ Updated successfully');
              updated++;
            }
          } else {
            updated++; // Count as "would be updated" in dry run
          }
        }
        
        console.log(''); // Empty line for readability
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        errors++;
        console.log(''); // Empty line for readability
      }
    }
    
    // Summary
    console.log('📋 Summary:');
    console.log(`   ├─ Total processed: ${memories.length}`);
    console.log(`   ├─ ${isDryRun ? 'Would be updated' : 'Updated'}: ${updated}`);
    console.log(`   ├─ Unchanged: ${unchanged}`);
    console.log(`   └─ Errors: ${errors}`);
    
    if (isDryRun && updated > 0) {
      console.log('\n💡 To apply these changes, run without --dry-run flag');
    }
    
    if (!isDryRun && updated > 0) {
      console.log('\n✅ Memory keys have been regenerated successfully!');
      console.log('   The AI system will now use the improved keys for better organization.');
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🔄 Memory Key Regeneration Tool

This script regenerates memory keys using the improved GPT prompt that 
prioritizes the patient (Francine) as the primary subject.

Usage:
  node scripts/regenerate-memory-keys.js                    # Regenerate all keys
  node scripts/regenerate-memory-keys.js "old-key-name"     # Regenerate specific key
  node scripts/regenerate-memory-keys.js --dry-run          # Preview changes without updating
  
Examples:
  node scripts/regenerate-memory-keys.js --dry-run
  node scripts/regenerate-memory-keys.js "daughter-occupation-hobbies-pet"
  node scripts/regenerate-memory-keys.js
  
Options:
  --dry-run    Preview changes without updating the database
  --help, -h   Show this help message
`);
  process.exit(0);
}

regenerateMemoryKeys().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});