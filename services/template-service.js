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
   * Get the system prompt with current date/time
   * @returns {string} Rendered system prompt
   */
  getSystemPrompt() {
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

    return this.render('system-prompt', {
      currentDateTime: laTime
    });
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