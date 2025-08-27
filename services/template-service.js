const fs = require('fs');
const path = require('path');
const mustache = require('mustache');

class TemplateService {
  constructor() {
    this.templateCache = new Map();
    this.templatesDir = path.join(__dirname, '..', 'templates');
    
    // Disable HTML escaping in mustache since we're dealing with plain text
    mustache.escape = (text) => text;
  }

  /**
   * Load a template from the templates directory
   * @param {string} templateName - Name of the template file (without .md extension)
   * @param {boolean} useCache - Whether to use cached template (default: true)
   * @returns {string} Raw template content
   */
  loadTemplate(templateName, useCache = true) {
    const cacheKey = templateName;
    
    if (useCache && this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey);
    }

    const templatePath = path.join(this.templatesDir, `${templateName}.md`);
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    const template = fs.readFileSync(templatePath, 'utf8');
    
    if (useCache) {
      this.templateCache.set(cacheKey, template);
    }
    
    return template;
  }

  /**
   * Render a template with the provided data
   * @param {string} templateName - Name of the template file (without .md extension)
   * @param {object} data - Data to interpolate into the template
   * @param {boolean} useCache - Whether to use cached template (default: true)
   * @returns {string} Rendered template
   */
  render(templateName, data = {}, useCache = true) {
    const template = this.loadTemplate(templateName, useCache);
    return mustache.render(template, data);
  }

  /**
   * Clear the template cache
   */
  clearCache() {
    this.templateCache.clear();
  }

  /**
   * Get the system prompt with current date/time, available memories, call frequency data, and persona
   * @param {Array<string>} memoryKeys - Optional array of available memory keys
   * @param {Object} callStats - Optional call frequency statistics {callsToday, lastCallTime, timeSinceLastCall}
   * @param {string} persona - Persona name (default: 'jessica')
   * @returns {string} Rendered system prompt
   */
  getSystemPrompt(memoryKeys = [], callStats = null, persona = 'jessica') {
    const now = new Date();
    const laTime = now.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    // First render the base template with call frequency data and persona
    let systemPrompt = this.render('system-prompt', {
      currentDateTime: laTime,
      persona: persona,  // Pass raw persona value
      isJessica: persona === 'jessica',  // Helper flag for conditional template
      callsToday: callStats?.callsToday || 0,
      timeSinceLastCall: callStats?.timeSinceLastCall || null,
      hasMultipleCalls: callStats && callStats.callsToday > 1,
      hasFrequentCalls: callStats && callStats.callsToday >= 3
    });

    // Then append memory section if memories are available
    if (memoryKeys && memoryKeys.length > 0) {
      // Filter out malformed keys (ensure they are strings)
      const validKeys = memoryKeys.filter(key => typeof key === 'string' && key.trim().length > 0);
      
      if (validKeys.length > 0) {
        // Group keys by category for better LLM parsing
        const familyKeys = validKeys.filter(key => key.includes('daughter') || key.includes('son') || key.includes('family') || key.includes('mary'));
        const healthKeys = validKeys.filter(key => key.includes('patient') || key.includes('health') || key.includes('allergy') || key.includes('medication'));
        const preferenceKeys = validKeys.filter(key => key.includes('francine') || key.includes('preferences') || key.includes('hobby'));
        const otherKeys = validKeys.filter(key => !familyKeys.includes(key) && !healthKeys.includes(key) && !preferenceKeys.includes(key));

        const memorySection = `

## Available Stored Memories (${validKeys.length} total)
**Use recallMemory with these specific keys when topics arise:**

**Family:** ${familyKeys.join(', ')}
**Health:** ${healthKeys.join(', ')}
**Preferences:** ${preferenceKeys.join(', ')}
**Other:** ${otherKeys.join(', ')}

**Memory Usage:**
- Use recallMemory("key-name") when conversation topics match the key descriptions
- Store new information with rememberInformation when they share important details
- Use listAvailableMemories only as backup if you need to rediscover available memories`;
        
        systemPrompt += memorySection;
      }
    }

    return systemPrompt;
  }

  /**
   * Reload templates from disk (useful for development)
   */
  reloadTemplates() {
    this.clearCache();
    console.log('Template cache cleared - templates will be reloaded on next request');
  }
}

module.exports = TemplateService;