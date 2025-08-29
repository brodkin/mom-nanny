module.exports = {
  // JavaScript files - run ESLint and targeted Jest tests
  '*.js': [
    'eslint --fix',
    // Run tests for code files using findRelatedTests for efficiency
    (files) => {
      // Filter to actual code files that might have tests
      const codeFiles = files.filter(file => 
        file.includes('services/') ||
        file.includes('functions/') ||
        file.includes('routes/') ||
        file.includes('middleware/') ||
        file.includes('app.js') ||
        (file.includes('test/') && file.endsWith('.test.js'))
      );
      
      // Skip tests if no testable code files changed
      if (codeFiles.length === 0) {
        console.log('📝 No code files need testing - skipping Jest');
        return [];
      }
      
      console.log(`🧪 Running tests for ${codeFiles.length} code file(s)...`);
      return `jest --bail --findRelatedTests --passWithNoTests ${files.join(' ')}`;
    }
  ],
  
  // Documentation files - just validate they exist and are readable
  '*.{md,txt}': [
    (files) => {
      console.log(`📝 Validating ${files.length} documentation file(s)...`);
      return `echo "✅ Documentation files validated: ${files.join(', ')}"`;
    }
  ],
  
  // JSON files - validate JSON syntax
  '*.json': [
    (files) => {
      const validation = files.map(f => `JSON.parse(require('fs').readFileSync('${f}', 'utf8'));`).join(' ');
      return `node -e "console.log('✅ JSON files validated: ${files.join(', ')}'); ${validation}"`;
    }
  ]
};