/**
 * Collapsible Component
 * A reusable component for creating collapsible/expandable sections
 * 
 * @example
 * // HTML: Auto-initialized with data attributes
 * <div data-collapsible="true" data-collapsed="true" data-persist="my-section">
 *   <div class="collapsible-header">
 *     <h3>Section Title</h3>
 *   </div>
 *   <div class="collapsible-content">
 *     <!-- Content -->
 *   </div>
 * </div>
 * 
 * @example
 * // JavaScript: Programmatic initialization
 * import Collapsible from './collapsible.js';
 * 
 * const collapsible = new Collapsible({
 *   element: document.querySelector('.my-section'),
 *   collapsed: true,
 *   persist: 'my-section-state'
 * });
 * 
 * collapsible.on('toggle', (event) => {
 *   console.log('Collapsed:', event.detail.collapsed);
 * });
 */

export default class Collapsible {
  /**
   * Create a new Collapsible instance
   * @param {Object} options - Configuration options
   * @param {HTMLElement|string} options.element - The element or selector to make collapsible
   * @param {boolean} [options.collapsed=false] - Whether to start collapsed
   * @param {string} [options.persist] - LocalStorage key for persisting state
   * @param {string} [options.animation='smooth'] - Animation type: 'smooth', 'fast', 'none'
   * @param {boolean} [options.closeOthers=false] - Close other collapsibles in the same group
   * @param {string} [options.group] - Group name for closeOthers functionality
   * @param {Function} [options.onToggle] - Callback function when toggled
   */
  constructor(options = {}) {
    this.options = {
      collapsed: false,
      animation: 'smooth',
      closeOthers: false,
      group: null,
      onToggle: null,
      ...options
    };

    // Get the element
    this.element = typeof this.options.element === 'string' 
      ? document.querySelector(this.options.element)
      : this.options.element;

    if (!this.element) {
      console.error('Collapsible: Element not found');
      return;
    }

    // Store instance on element for later reference
    this.element._collapsible = this;

    // Initialize
    this.init();
  }

  /**
   * Initialize the collapsible
   */
  init() {
    // Find or create header and content elements
    this.header = this.element.querySelector('.collapsible-header') 
      || this.element.querySelector('[data-collapsible-header]')
      || this.element.firstElementChild;
    
    this.content = this.element.querySelector('.collapsible-content')
      || this.element.querySelector('[data-collapsible-content]')
      || this.element.lastElementChild;

    if (!this.header || !this.content) {
      console.error('Collapsible: Header and content elements required');
      return;
    }

    // Add classes
    this.element.classList.add('collapsible-section');
    this.header.classList.add('collapsible-header');
    this.content.classList.add('collapsible-content');

    // Add animation class
    if (this.options.animation !== 'none') {
      this.content.classList.add(`collapsible-${this.options.animation}`);
    }

    // Create toggle button if it doesn't exist
    this.toggleBtn = this.header.querySelector('.collapsible-toggle');
    if (!this.toggleBtn) {
      this.toggleBtn = document.createElement('button');
      this.toggleBtn.className = 'collapsible-toggle';
      this.toggleBtn.setAttribute('aria-label', 'Toggle section');
      this.toggleBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      `;
      
      // Find the first heading element (h1, h2, h3, etc.)
      const heading = this.header.querySelector('h1, h2, h3, h4, h5, h6');
      
      if (heading) {
        // Check if heading is already wrapped
        if (!heading.parentElement.classList.contains('collapsible-heading-wrapper')) {
          // Create a wrapper div for heading and toggle
          const wrapper = document.createElement('div');
          wrapper.className = 'collapsible-heading-wrapper';
          
          // Wrap the heading
          heading.parentNode.insertBefore(wrapper, heading);
          wrapper.appendChild(heading);
          
          // Add the toggle button to the wrapper
          wrapper.appendChild(this.toggleBtn);
        } else {
          // Heading is already wrapped, just add the toggle
          heading.parentElement.appendChild(this.toggleBtn);
        }
      } else {
        // Fallback: append to header
        this.header.appendChild(this.toggleBtn);
      }
    }

    // Set initial state
    const persistedState = this.getPersistedState();
    const initialCollapsed = persistedState !== null ? persistedState : this.options.collapsed;
    
    if (initialCollapsed) {
      this.collapse(false);
    } else {
      this.expand(false);
    }

    // Bind events
    this.bindEvents();

    // Add to group if specified
    if (this.options.group) {
      this.addToGroup(this.options.group);
    }
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Click on toggle button
    this.toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // Click on header (optional)
    this.header.addEventListener('click', (e) => {
      // Only toggle if clicking the header directly, not child elements
      if (e.target === this.header || e.target.closest('.collapsible-toggle')) {
        this.toggle();
      }
    });

    // Keyboard support
    this.header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggle();
      }
    });

    // Make header focusable if not already
    if (!this.header.hasAttribute('tabindex')) {
      this.header.setAttribute('tabindex', '0');
    }
  }

  /**
   * Toggle collapsed state
   * @param {boolean} [animate=true] - Whether to animate the transition
   */
  toggle(animate = true) {
    if (this.isCollapsed) {
      this.expand(animate);
    } else {
      this.collapse(animate);
    }
  }

  /**
   * Expand the section
   * @param {boolean} [animate=true] - Whether to animate the transition
   */
  expand(animate = true) {
    // Close others in group if needed
    if (this.options.closeOthers && this.options.group) {
      this.closeOthersInGroup();
    }

    // Update state
    this.element.classList.remove('collapsed');
    this.element.setAttribute('aria-expanded', 'true');
    this.toggleBtn.setAttribute('aria-expanded', 'true');
    this.content.removeAttribute('hidden');

    // Animate if needed
    if (animate && this.options.animation !== 'none') {
      this.animateExpand();
    }

    // Persist state
    this.persistState(false);

    // Emit event
    this.emit('toggle', { collapsed: false });
    this.emit('expand');

    // Callback
    if (this.options.onToggle) {
      this.options.onToggle(false, this);
    }
  }

  /**
   * Collapse the section
   * @param {boolean} [animate=true] - Whether to animate the transition
   */
  collapse(animate = true) {
    // Update state
    this.element.classList.add('collapsed');
    this.element.setAttribute('aria-expanded', 'false');
    this.toggleBtn.setAttribute('aria-expanded', 'false');

    // Animate if needed
    if (animate && this.options.animation !== 'none') {
      this.animateCollapse();
    } else {
      this.content.setAttribute('hidden', '');
    }

    // Persist state
    this.persistState(true);

    // Emit event
    this.emit('toggle', { collapsed: true });
    this.emit('collapse');

    // Callback
    if (this.options.onToggle) {
      this.options.onToggle(true, this);
    }
  }

  /**
   * Animate expansion
   */
  animateExpand() {
    // Get the height of the content
    const height = this.content.scrollHeight;
    
    // Set initial state
    this.content.style.height = '0';
    this.content.style.overflow = 'hidden';
    
    // Force reflow
    this.content.offsetHeight;
    
    // Animate to full height
    this.content.style.transition = this.getTransition();
    this.content.style.height = height + 'px';
    
    // Clean up after animation
    this.content.addEventListener('transitionend', () => {
      this.content.style.height = '';
      this.content.style.overflow = '';
      this.content.style.transition = '';
    }, { once: true });
  }

  /**
   * Animate collapse
   */
  animateCollapse() {
    // Get current height
    const height = this.content.scrollHeight;
    
    // Set explicit height
    this.content.style.height = height + 'px';
    this.content.style.overflow = 'hidden';
    
    // Force reflow
    this.content.offsetHeight;
    
    // Animate to 0
    this.content.style.transition = this.getTransition();
    this.content.style.height = '0';
    
    // Hide after animation
    this.content.addEventListener('transitionend', () => {
      this.content.setAttribute('hidden', '');
      this.content.style.height = '';
      this.content.style.overflow = '';
      this.content.style.transition = '';
    }, { once: true });
  }

  /**
   * Get transition string based on animation type
   * @returns {string} CSS transition
   */
  getTransition() {
    const durations = {
      smooth: '0.3s',
      fast: '0.15s'
    };
    return `height ${durations[this.options.animation] || '0.3s'} ease-in-out`;
  }

  /**
   * Get persisted state from localStorage
   * @returns {boolean|null} Persisted state or null if not found
   */
  getPersistedState() {
    if (!this.options.persist) return null;
    
    try {
      const state = localStorage.getItem(`collapsible-${this.options.persist}`);
      return state === 'true' ? true : state === 'false' ? false : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Persist state to localStorage
   * @param {boolean} collapsed - Current collapsed state
   */
  persistState(collapsed) {
    if (!this.options.persist) return;
    
    try {
      localStorage.setItem(`collapsible-${this.options.persist}`, collapsed.toString());
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  /**
   * Add to collapsible group
   * @param {string} groupName - Name of the group
   */
  addToGroup(groupName) {
    if (!window._collapsibleGroups) {
      window._collapsibleGroups = {};
    }
    
    if (!window._collapsibleGroups[groupName]) {
      window._collapsibleGroups[groupName] = [];
    }
    
    window._collapsibleGroups[groupName].push(this);
  }

  /**
   * Close other collapsibles in the same group
   */
  closeOthersInGroup() {
    if (!this.options.group || !window._collapsibleGroups) return;
    
    const group = window._collapsibleGroups[this.options.group];
    if (!group) return;
    
    group.forEach(collapsible => {
      if (collapsible !== this && !collapsible.isCollapsed) {
        collapsible.collapse();
      }
    });
  }

  /**
   * Emit custom event
   * @param {string} eventName - Name of the event
   * @param {Object} detail - Event detail data
   */
  emit(eventName, detail = {}) {
    const event = new CustomEvent(`collapsible:${eventName}`, {
      detail: { ...detail, collapsible: this },
      bubbles: true
    });
    this.element.dispatchEvent(event);
  }

  /**
   * Add event listener
   * @param {string} eventName - Name of the event
   * @param {Function} handler - Event handler
   */
  on(eventName, handler) {
    this.element.addEventListener(`collapsible:${eventName}`, handler);
  }

  /**
   * Remove event listener
   * @param {string} eventName - Name of the event
   * @param {Function} handler - Event handler
   */
  off(eventName, handler) {
    this.element.removeEventListener(`collapsible:${eventName}`, handler);
  }

  /**
   * Check if collapsed
   * @returns {boolean} Whether the section is collapsed
   */
  get isCollapsed() {
    return this.element.classList.contains('collapsed');
  }

  /**
   * Destroy the collapsible instance
   */
  destroy() {
    // Remove from group
    if (this.options.group && window._collapsibleGroups) {
      const group = window._collapsibleGroups[this.options.group];
      const index = group.indexOf(this);
      if (index > -1) {
        group.splice(index, 1);
      }
    }

    // Remove instance reference
    delete this.element._collapsible;

    // Remove classes
    this.element.classList.remove('collapsible-section', 'collapsed');
    this.header.classList.remove('collapsible-header');
    this.content.classList.remove('collapsible-content', `collapsible-${this.options.animation}`);

    // Remove attributes
    this.element.removeAttribute('aria-expanded');
    this.content.removeAttribute('hidden');

    // Remove toggle button if we created it
    if (this.toggleBtn && this.toggleBtn.parentNode === this.header) {
      this.toggleBtn.remove();
    }
  }

  /**
   * Auto-initialize collapsibles from DOM
   * @param {HTMLElement|Document} [context=document] - Context to search within
   * @returns {Collapsible[]} Array of initialized collapsibles
   */
  static autoInit(context = document) {
    const elements = context.querySelectorAll('[data-collapsible]');
    const instances = [];

    elements.forEach(element => {
      // Skip if already initialized
      if (element._collapsible) return;

      // Get options from data attributes
      const options = {
        element,
        collapsed: element.dataset.collapsed === 'true',
        persist: element.dataset.persist || null,
        animation: element.dataset.animation || 'smooth',
        closeOthers: element.dataset.closeOthers === 'true',
        group: element.dataset.group || null
      };

      instances.push(new Collapsible(options));
    });

    return instances;
  }

  /**
   * Get collapsible instance from element
   * @param {HTMLElement|string} element - Element or selector
   * @returns {Collapsible|null} Collapsible instance or null
   */
  static getInstance(element) {
    const el = typeof element === 'string' 
      ? document.querySelector(element)
      : element;
    
    return el ? el._collapsible || null : null;
  }
}