# AI Companion Template System

This directory contains Mustache templates for the AI companion system prompts and other configurable text content.

## Template Files

### `system-prompt.md`
The main system prompt that defines the AI's personality, behavior guidelines, and conversational patterns. This template includes mustache variables for dynamic content insertion.

**Variables:**
- `{{currentDateTime}}` - Current date and time in Los Angeles timezone

## Using Templates

The template system is accessed through the `TemplateService` class:

```javascript
const TemplateService = require('../services/template-service');
const templateService = new TemplateService();

// Get the system prompt with current date/time
const prompt = templateService.getSystemPrompt();

// Render any template with custom data
const rendered = templateService.render('template-name', {
  variable: 'value'
});
```

## Template Features

- **Mustache Syntax**: Uses standard `{{variable}}` syntax for variable substitution
- **Caching**: Templates are cached in memory for performance
- **Markdown Support**: Templates are written in Markdown for better readability
- **Development Mode**: Cache can be cleared for template reloading during development

## Benefits

- **Separation of Concerns**: System prompts are now separate from application code
- **Version Control**: Prompt changes are tracked independently
- **Readability**: Markdown formatting makes prompts easier to read and edit
- **Maintainability**: Template structure allows for easier updates and modifications
- **Reusability**: Template system can be extended for other dynamic content

## Development

To reload templates during development:

```javascript
templateService.reloadTemplates(); // Clears cache
```

This forces templates to be re-read from disk on the next request, useful when modifying prompt content during development.