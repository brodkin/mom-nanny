/**
 * Template Loader System for Admin Pages
 * Loads and renders shared components to maintain DRY principles
 */

class TemplateLoader {
  constructor() {
    this.templateCache = new Map();
    this.baseUrl = '';
  }

  /**
   * Load a template from the templates directory
   * @param {string} templateName - Name of template file without extension
   * @returns {Promise<string>} Template HTML content
   */
  async loadTemplate(templateName) {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }

    try {
      const response = await fetch(`${this.baseUrl}templates/${templateName}.html`);
      if (!response.ok) {
        throw new Error(`Failed to load template: ${templateName}`);
      }
      
      const templateContent = await response.text();
      this.templateCache.set(templateName, templateContent);
      return templateContent;
    } catch (error) {
      console.error(`Error loading template ${templateName}:`, error);
      return '';
    }
  }

  /**
   * Simple template variable replacement
   * @param {string} template - Template HTML with {{variable}} placeholders
   * @param {object} variables - Variables to replace in template
   * @returns {string} Rendered HTML
   */
  renderTemplate(template, variables = {}) {
    let rendered = template;
    
    // Replace simple variables {{variableName}}
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, value || '');
    }
    
    // Clean up any unreplaced variables
    rendered = rendered.replace(/{{[^}]+}}/g, '');
    
    return rendered;
  }

  /**
   * Load and render the header component
   * @param {object} variables - Variables for header (pageTitle, etc.)
   * @returns {Promise<string>} Rendered header HTML
   */
  async loadHeader(variables = {}) {
    const template = await this.loadTemplate('header');
    return this.renderTemplate(template, variables);
  }

  /**
   * Load and render the sidebar component
   * @param {string} activePage - Current active page for navigation highlighting
   * @returns {Promise<string>} Rendered sidebar HTML
   */
  async loadSidebar(activePage = '') {
    const template = await this.loadTemplate('sidebar');
    let rendered = this.renderTemplate(template, { activePage });
    
    // Add active class to current page nav item
    if (activePage) {
      rendered = rendered.replace(
        new RegExp(`data-page="${activePage}"`, 'g'),
        `data-page="${activePage}" class="nav-link active"`
      );
      // Remove active class from other nav items that might have it
      rendered = rendered.replace(
        /class="nav-link active"(?![^>]*data-page="${activePage}")/g,
        'class="nav-link"'
      );
    }
    
    return rendered;
  }

  /**
   * Load and render the footer component
   * @returns {Promise<string>} Rendered footer HTML
   */
  async loadFooter() {
    const template = await this.loadTemplate('footer');
    return this.renderTemplate(template, {});
  }

  /**
   * Initialize templates for a page
   * @param {object} config - Page configuration
   * @param {string} config.pageTitle - Page title for breadcrumb
   * @param {string} config.activePage - Active page for navigation
   * @param {string} config.contentSelector - Selector for main content area
   */
  async initializePage(config) {
    const { pageTitle, activePage, contentSelector = '#main-content' } = config;
    
    try {
      // Load all templates concurrently
      const [headerHtml, sidebarHtml, footerHtml] = await Promise.all([
        this.loadHeader({ pageTitle }),
        this.loadSidebar(activePage),
        this.loadFooter()
      ]);

      // Find insertion points in current page
      const adminLayout = document.querySelector('.admin-layout');
      if (!adminLayout) {
        console.error('Admin layout container not found');
        return;
      }

      // Insert header
      const existingHeader = adminLayout.querySelector('.admin-header');
      if (existingHeader) {
        existingHeader.outerHTML = headerHtml;
      } else {
        // Insert before main content
        const mainContent = adminLayout.querySelector('.admin-main');
        if (mainContent) {
          mainContent.insertAdjacentHTML('beforebegin', headerHtml);
        }
      }

      // Insert sidebar
      const existingSidebar = adminLayout.querySelector('.admin-sidebar');
      if (existingSidebar) {
        existingSidebar.outerHTML = sidebarHtml;
      } else {
        adminLayout.insertAdjacentHTML('afterbegin', sidebarHtml);
      }

      // Insert footer
      const existingFooter = adminLayout.querySelector('.admin-footer');
      if (existingFooter) {
        existingFooter.outerHTML = footerHtml;
      } else {
        adminLayout.insertAdjacentHTML('beforeend', footerHtml);
      }

      // Reinitialize JavaScript that depends on the DOM
      this.reinitializeScripts();

    } catch (error) {
      console.error('Error initializing page templates:', error);
    }
  }

  /**
   * Reinitialize scripts that depend on template elements
   */
  reinitializeScripts() {
    // Reinitialize admin dashboard if it exists
    if (window.adminDashboard) {
      window.adminDashboard.bindEvents();
    }

    // Dispatch custom event for other scripts to listen to
    document.dispatchEvent(new CustomEvent('templates:loaded', {
      detail: { timestamp: Date.now() }
    }));
  }

  /**
   * Clear template cache (useful for development)
   */
  clearCache() {
    this.templateCache.clear();
  }
}

// Create global instance
window.templateLoader = new TemplateLoader();

// Auto-initialize for pages that have data-page attribute
document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const pageTitle = document.querySelector('title')?.textContent?.split(' - ')[0] || 'Admin';
  const activePage = body.dataset.page || 
                    window.location.pathname.split('/').pop().replace('.html', '') ||
                    'dashboard';

  // Only auto-initialize if we have an admin layout
  if (document.querySelector('.admin-layout')) {
    window.templateLoader.initializePage({
      pageTitle,
      activePage
    });
  }
});

export default TemplateLoader;