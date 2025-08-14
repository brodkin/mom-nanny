const TemplateService = require('../services/template-service');
const path = require('path');
const fs = require('fs');

describe('TemplateService', () => {
  let templateService;

  beforeEach(() => {
    templateService = new TemplateService();
  });

  afterEach(() => {
    templateService.clearCache();
  });

  describe('loadTemplate', () => {
    test('should load system-prompt template', () => {
      const template = templateService.loadTemplate('system-prompt');
      expect(typeof template).toBe('string');
      expect(template.length).toBeGreaterThan(0);
      expect(template).toContain('{{currentDateTime}}');
    });

    test('should throw error for non-existent template', () => {
      expect(() => {
        templateService.loadTemplate('non-existent');
      }).toThrow('Template not found');
    });

    test('should cache templates by default', () => {
      const template1 = templateService.loadTemplate('system-prompt');
      const template2 = templateService.loadTemplate('system-prompt');
      expect(template1).toBe(template2); // Same reference due to caching
    });

    test('should not cache when disabled', () => {
      const template1 = templateService.loadTemplate('system-prompt', false);
      const template2 = templateService.loadTemplate('system-prompt', false);
      expect(template1).toEqual(template2);
      expect(template1).toBe(template2); // Should still be same since it's a string
    });
  });

  describe('render', () => {
    test('should render template with data', () => {
      const result = templateService.render('system-prompt', {
        currentDateTime: 'Monday, December 25, 2023 at 10:30 AM PST'
      });
      
      expect(result).toContain('Monday, December 25, 2023 at 10:30 AM PST');
      expect(result).not.toContain('{{currentDateTime}}');
      expect(result).toContain('You are **Jessica**');
    });

    test('should handle empty data object', () => {
      const result = templateService.render('system-prompt', {});
      expect(result).not.toContain('{{currentDateTime}}'); // Should be rendered as empty
      expect(result).toContain('Current date and time in La Palma, CA (Orange County): .');
    });

    test('should handle undefined data', () => {
      const result = templateService.render('system-prompt');
      expect(result).not.toContain('{{currentDateTime}}'); // Should be rendered as empty
      expect(result).toContain('Current date and time in La Palma, CA (Orange County): .');
    });
  });

  describe('getSystemPrompt', () => {
    test('should return rendered system prompt with current time', () => {
      const prompt = templateService.getSystemPrompt();
      
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).not.toContain('{{currentDateTime}}'); // Should be rendered
      expect(prompt).toContain('You are **Jessica**');
      expect(prompt).toContain('Current date and time in La Palma, CA (Orange County):');
      
      // Should contain current date
      const currentYear = new Date().getFullYear();
      expect(prompt).toContain(currentYear.toString());
    });

    test('should include all expected sections', () => {
      const prompt = templateService.getSystemPrompt();
      
      expect(prompt).toContain('Identity and Role');
      expect(prompt).toContain('Core Principles');
      expect(prompt).toContain('Time Awareness');
      expect(prompt).toContain('Limitations and Boundaries');
      expect(prompt).toContain('Handling Common Concerns');
      expect(prompt).toContain('Medical Concerns');
      expect(prompt).toContain('Dementia-Related Behaviors');
      expect(prompt).toContain('Safe Topics and Conversation Guidelines');
      expect(prompt).toContain('Handling Difficult Situations');
      expect(prompt).toContain('Graceful Exit Phrases');
      expect(prompt).toContain('Ending Calls');
      expect(prompt).toContain('Text-to-Speech Formatting');
    });
  });

  describe('clearCache', () => {
    test('should clear template cache', () => {
      // Load template to populate cache
      templateService.loadTemplate('system-prompt');
      expect(templateService.templateCache.size).toBe(1);
      
      templateService.clearCache();
      expect(templateService.templateCache.size).toBe(0);
    });
  });

  describe('reloadTemplates', () => {
    test('should clear cache and log message', () => {
      // Load template to populate cache
      templateService.loadTemplate('system-prompt');
      expect(templateService.templateCache.size).toBe(1);
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      templateService.reloadTemplates();
      
      expect(templateService.templateCache.size).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith('Template cache cleared - templates will be reloaded on next request');
      
      consoleSpy.mockRestore();
    });
  });
});