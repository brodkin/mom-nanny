/**
 * Main Components Module - Import and initialize all admin components
 * 
 * This module provides a unified API for all admin components including:
 * - Card: Expandable cards with loading states and refresh functionality
 * - DataTable: Sortable, paginated tables with search and export
 * - Chart: Wrapper for Chart.js with real-time updates and animations
 * - Modal: Programmatic modals with multiple sizes and types
 * - Notification: Toast notifications with auto-dismiss and stacking
 * 
 * @example
 * import { Card, DataTable, Chart, Modal, Notification } from './components.js';
 * 
 * // Or import all components
 * import * as Components from './components.js';
 * 
 * // Use components
 * const card = new Card({ title: 'Dashboard', collapsible: true });
 * const table = new DataTable({ columns: [...], data: [...] });
 * const chart = new Chart({ type: 'line', data: {...} });
 * 
 * // Static methods
 * Modal.confirm('Are you sure?').then(result => console.log(result));
 * Notification.success('Operation completed');
 */

// Import all components
import Card from './card.js';
import DataTable from './table.js';
import Chart from './chart.js';
import Modal from './modal.js';
import Notification from './notification.js';
import Collapsible from './collapsible.js';

/**
 * Component registry for dynamic component creation
 */
const ComponentRegistry = {
  Card,
  DataTable,
  Chart,
  Modal,
  Notification,
  Collapsible
};

/**
 * Create a component instance by name
 * @param {string} componentName - Name of the component to create
 * @param {Object} options - Component options
 * @returns {Object} Component instance
 */
function createComponent(componentName, options = {}) {
  const ComponentClass = ComponentRegistry[componentName];
  
  if (!ComponentClass) {
    throw new Error(`Component "${componentName}" not found. Available components: ${Object.keys(ComponentRegistry).join(', ')}`);
  }
  
  return new ComponentClass(options);
}

/**
 * Initialize components with default configurations
 * @param {Object} config - Global configuration for components
 */
function initializeComponents(config = {}) {
  // Set Chart.js defaults if provided
  if (config.chart && window.Chart) {
    Object.assign(window.Chart.defaults, config.chart);
  }
  
  // Set Notification defaults
  if (config.notification) {
    Notification.setDefaults(config.notification);
  }
  
  // Add global CSS classes if needed
  if (config.theme) {
    document.body.classList.add(`theme-${config.theme}`);
  }
  
  console.log('Admin components initialized', { config });
}

/**
 * Utility functions for common component operations
 */
const ComponentUtils = {
  /**
   * Create a confirmation dialog
   * @param {string} message - Confirmation message
   * @param {Object} options - Additional options
   * @returns {Promise<boolean>} User's choice
   */
  confirm(message, options = {}) {
    return Modal.confirm({ message, ...options });
  },

  /**
   * Show an alert dialog
   * @param {string} message - Alert message
   * @param {Object} options - Additional options
   * @returns {Promise} Promise that resolves when dismissed
   */
  alert(message, options = {}) {
    return Modal.alert({ message, ...options });
  },

  /**
   * Show a success notification
   * @param {string} message - Success message
   * @param {Object} options - Additional options
   * @returns {Notification} Notification instance
   */
  notify(message, options = {}) {
    return Notification.info(message, options);
  },

  /**
   * Show a success notification
   * @param {string} message - Success message
   * @param {Object} options - Additional options
   * @returns {Notification} Notification instance
   */
  notifySuccess(message, options = {}) {
    return Notification.success(message, options);
  },

  /**
   * Show an error notification
   * @param {string} message - Error message
   * @param {Object} options - Additional options
   * @returns {Notification} Notification instance
   */
  notifyError(message, options = {}) {
    return Notification.error(message, options);
  },

  /**
   * Show a warning notification
   * @param {string} message - Warning message
   * @param {Object} options - Additional options
   * @returns {Notification} Notification instance
   */
  notifyWarning(message, options = {}) {
    return Notification.warning(message, options);
  },

  /**
   * Create a data table with common settings
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Table options
   * @returns {DataTable} DataTable instance
   */
  createTable(container, options = {}) {
    const table = new DataTable({
      pagination: true,
      searchable: true,
      exportable: true,
      selectable: false,
      ...options
    });
    
    container.appendChild(table.element);
    return table;
  },

  /**
   * Create a card with common settings
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Card options
   * @returns {Card} Card instance
   */
  createCard(container, options = {}) {
    const card = new Card({
      collapsible: true,
      refreshable: false,
      ...options
    });
    
    container.appendChild(card.element);
    return card;
  },

  /**
   * Create a chart with responsive defaults
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Chart options
   * @returns {Chart} Chart instance
   */
  createChart(container, options = {}) {
    const chart = new Chart({
      responsive: true,
      maintainAspectRatio: true,
      ...options
    });
    
    container.appendChild(chart.element);
    return chart;
  },

  /**
   * Auto-initialize components from DOM data attributes
   * @param {HTMLElement} [root=document] - Root element to search
   */
  autoInit(root = document) {
    // Find elements with data-component attribute
    const componentElements = root.querySelectorAll('[data-component]');
    
    componentElements.forEach(element => {
      const componentName = element.dataset.component;
      const options = element.dataset.options ? JSON.parse(element.dataset.options) : {};
      
      try {
        const component = createComponent(componentName, options);
        
        // Replace element with component element or append to it
        if (element.dataset.replace === 'true') {
          element.parentNode.replaceChild(component.element, element);
        } else {
          element.appendChild(component.element);
        }
        
        // Store component reference on element
        element._componentInstance = component;
        
      } catch (error) {
        console.error(`Failed to initialize component "${componentName}":`, error);
      }
    });
  },

  /**
   * Clean up all component instances on an element
   * @param {HTMLElement} element - Element to clean up
   */
  cleanup(element) {
    if (element._componentInstance) {
      if (typeof element._componentInstance.destroy === 'function') {
        element._componentInstance.destroy();
      }
      element._componentInstance = null;
    }
    
    // Clean up child elements
    const childElements = element.querySelectorAll('[data-component]');
    childElements.forEach(child => {
      if (child._componentInstance) {
        if (typeof child._componentInstance.destroy === 'function') {
          child._componentInstance.destroy();
        }
        child._componentInstance = null;
      }
    });
  }
};

// Auto-initialize on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ComponentUtils.autoInit();
    });
  } else {
    ComponentUtils.autoInit();
  }
}

// Export individual components
export {
  Card,
  DataTable,
  Chart,
  Modal,
  Notification,
  Collapsible,
  ComponentRegistry,
  ComponentUtils,
  createComponent,
  initializeComponents
};

// Default export - all components and utilities
export default {
  Card,
  DataTable,
  Chart,
  Modal,
  Notification,
  Collapsible,
  ComponentRegistry,
  ComponentUtils,
  createComponent,
  initializeComponents
};