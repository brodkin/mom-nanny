/**
 * Notification Component - Toast notifications with auto-dismiss and stacking
 * 
 * @class Notification
 * @extends EventTarget
 * 
 * @example
 * // Individual notification
 * const notification = new Notification({
 *   message: 'Operation completed successfully!',
 *   type: 'success',
 *   duration: 3000,
 *   closable: true
 * });
 * 
 * notification.show();
 * 
 * // Using static methods (recommended)
 * Notification.success('Data saved successfully');
 * Notification.error('Failed to load data');
 * Notification.warning('Please check your input');
 * Notification.info('New update available');
 */
export class Notification extends EventTarget {
  // Static container for all notifications
  static container = null;
  static notifications = [];
  static nextId = 1;

  /**
   * Create a Notification instance
   * @param {Object} options - Notification configuration options
   * @param {string} options.message - Notification message
   * @param {string} [options.type='info'] - Notification type (success, warning, error, info)
   * @param {number} [options.duration=4000] - Auto-dismiss duration in ms (0 = no auto-dismiss)
   * @param {boolean} [options.closable=true] - Whether notification can be manually closed
   * @param {boolean} [options.progressBar=true] - Show progress bar for auto-dismiss
   * @param {string} [options.title=''] - Optional notification title
   * @param {string} [options.className=''] - Additional CSS classes
   * @param {string} [options.position='top-right'] - Notification position
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      message: '',
      type: 'info',
      duration: 4000,
      closable: true,
      progressBar: true,
      title: '',
      className: '',
      position: 'top-right',
      ...options
    };
    
    this.id = Notification.nextId++;
    this.isVisible = false;
    this.timeoutId = null;
    this.progressInterval = null;
    this.startTime = null;
    
    this.element = this.createElement();
    this.bindEvents();
  }

  /**
   * Create the notification DOM element
   * @private
   * @returns {HTMLElement} The notification element
   */
  createElement() {
    const notification = document.createElement('div');
    notification.className = `notification notification-${this.options.type} ${this.options.className}`.trim();
    notification.setAttribute('role', 'alert');
    notification.setAttribute('data-id', this.id);
    
    const iconMap = {
      success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
      info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
    };
    
    notification.innerHTML = `
      <div class="notification-content">
        <div class="notification-icon">
          ${iconMap[this.options.type] || iconMap.info}
        </div>
        <div class="notification-text">
          ${this.options.title ? `<div class="notification-title">${this.options.title}</div>` : ''}
          <div class="notification-message">${this.options.message}</div>
        </div>
        ${this.options.closable ? `
          <button class="notification-close" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        ` : ''}
      </div>
      ${this.options.progressBar && this.options.duration > 0 ? `
        <div class="notification-progress">
          <div class="notification-progress-bar"></div>
        </div>
      ` : ''}
    `;
    
    return notification;
  }

  /**
   * Bind event listeners
   * @private
   */
  bindEvents() {
    // Close button
    const closeBtn = this.element.querySelector('.notification-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }
    
    // Click to dismiss
    this.element.addEventListener('click', (e) => {
      if (!e.target.closest('.notification-close')) {
        this.dispatchEvent(new CustomEvent('click', { detail: { notification: this } }));
      }
    });
    
    // Hover to pause auto-dismiss
    if (this.options.duration > 0) {
      this.element.addEventListener('mouseenter', () => this.pauseAutoDismiss());
      this.element.addEventListener('mouseleave', () => this.resumeAutoDismiss());
    }
  }

  /**
   * Show the notification
   */
  show() {
    if (this.isVisible) return;
    
    this.isVisible = true;
    
    // Ensure container exists
    Notification.ensureContainer();
    
    // Add to container
    Notification.container.appendChild(this.element);
    Notification.notifications.push(this);
    
    // Trigger animation
    requestAnimationFrame(() => {
      this.element.classList.add('show');
    });
    
    // Start auto-dismiss if configured
    if (this.options.duration > 0) {
      this.startAutoDismiss();
    }
    
    this.dispatchEvent(new CustomEvent('show'));
  }

  /**
   * Hide the notification
   */
  hide() {
    if (!this.isVisible) return;
    
    this.isVisible = false;
    this.clearTimers();
    
    this.element.classList.add('hiding');
    this.element.classList.remove('show');
    
    // Remove from DOM after animation
    setTimeout(() => {
      this.destroy();
    }, 300);
    
    this.dispatchEvent(new CustomEvent('hide'));
  }

  /**
   * Start auto-dismiss timer
   * @private
   */
  startAutoDismiss() {
    this.startTime = Date.now();
    this.remainingTime = this.options.duration;
    
    this.timeoutId = setTimeout(() => {
      this.hide();
    }, this.options.duration);
    
    if (this.options.progressBar) {
      this.startProgressBar();
    }
  }

  /**
   * Pause auto-dismiss
   * @private
   */
  pauseAutoDismiss() {
    if (!this.timeoutId) return;
    
    clearTimeout(this.timeoutId);
    this.remainingTime -= (Date.now() - this.startTime);
    
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
    
    this.dispatchEvent(new CustomEvent('pause'));
  }

  /**
   * Resume auto-dismiss
   * @private
   */
  resumeAutoDismiss() {
    if (this.remainingTime <= 0) return;
    
    this.startTime = Date.now();
    this.timeoutId = setTimeout(() => {
      this.hide();
    }, this.remainingTime);
    
    if (this.options.progressBar) {
      this.startProgressBar();
    }
    
    this.dispatchEvent(new CustomEvent('resume'));
  }

  /**
   * Start progress bar animation
   * @private
   */
  startProgressBar() {
    const progressBar = this.element.querySelector('.notification-progress-bar');
    if (!progressBar) return;
    
    const duration = this.remainingTime || this.options.duration;
    const startTime = Date.now();
    
    this.progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      progressBar.style.width = `${(1 - progress) * 100}%`;
      
      if (progress >= 1) {
        clearInterval(this.progressInterval);
      }
    }, 16); // ~60fps
  }

  /**
   * Clear all timers
   * @private
   */
  clearTimers() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  /**
   * Update notification message
   * @param {string} message - New message
   */
  setMessage(message) {
    const messageEl = this.element.querySelector('.notification-message');
    if (messageEl) {
      messageEl.textContent = message;
    }
  }

  /**
   * Update notification title
   * @param {string} title - New title
   */
  setTitle(title) {
    let titleEl = this.element.querySelector('.notification-title');
    
    if (title) {
      if (!titleEl) {
        titleEl = document.createElement('div');
        titleEl.className = 'notification-title';
        this.element.querySelector('.notification-text').insertBefore(titleEl, this.element.querySelector('.notification-message'));
      }
      titleEl.textContent = title;
    } else if (titleEl) {
      titleEl.remove();
    }
  }

  /**
   * Add event listener (alias for addEventListener)
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  on(event, handler) {
    this.addEventListener(event, handler);
  }

  /**
   * Remove event listener (alias for removeEventListener)
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  off(event, handler) {
    this.removeEventListener(event, handler);
  }

  /**
   * Destroy the notification and clean up
   */
  destroy() {
    this.clearTimers();
    
    // Remove from notifications array
    const index = Notification.notifications.findIndex(n => n.id === this.id);
    if (index > -1) {
      Notification.notifications.splice(index, 1);
    }
    
    // Remove from DOM
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    
    // Clean up container if empty
    if (Notification.notifications.length === 0 && Notification.container) {
      Notification.container.remove();
      Notification.container = null;
    }
  }

  /**
   * Ensure notification container exists
   * @static
   * @private
   */
  static ensureContainer() {
    if (!Notification.container) {
      Notification.container = document.createElement('div');
      Notification.container.className = 'notification-container';
      Notification.container.setAttribute('aria-live', 'polite');
      Notification.container.setAttribute('aria-atomic', 'false');
      document.body.appendChild(Notification.container);
    }
  }

  /**
   * Create and show a success notification
   * @static
   * @param {string} message - Notification message
   * @param {Object} [options={}] - Additional options
   * @returns {Notification} Notification instance
   */
  static success(message, options = {}) {
    const notification = new Notification({
      message,
      type: 'success',
      ...options
    });
    
    notification.show();
    return notification;
  }

  /**
   * Create and show an error notification
   * @static
   * @param {string} message - Notification message
   * @param {Object} [options={}] - Additional options
   * @returns {Notification} Notification instance
   */
  static error(message, options = {}) {
    const notification = new Notification({
      message,
      type: 'error',
      duration: options.duration || 0, // Errors don't auto-dismiss by default
      ...options
    });
    
    notification.show();
    return notification;
  }

  /**
   * Create and show a warning notification
   * @static
   * @param {string} message - Notification message
   * @param {Object} [options={}] - Additional options
   * @returns {Notification} Notification instance
   */
  static warning(message, options = {}) {
    const notification = new Notification({
      message,
      type: 'warning',
      duration: options.duration || 6000, // Warnings stay longer
      ...options
    });
    
    notification.show();
    return notification;
  }

  /**
   * Create and show an info notification
   * @static
   * @param {string} message - Notification message
   * @param {Object} [options={}] - Additional options
   * @returns {Notification} Notification instance
   */
  static info(message, options = {}) {
    const notification = new Notification({
      message,
      type: 'info',
      ...options
    });
    
    notification.show();
    return notification;
  }

  /**
   * Clear all notifications
   * @static
   * @param {string} [type] - Optional type filter
   */
  static clear(type = null) {
    const toRemove = type 
      ? Notification.notifications.filter(n => n.options.type === type)
      : [...Notification.notifications];
    
    toRemove.forEach(notification => notification.hide());
  }

  /**
   * Get all active notifications
   * @static
   * @param {string} [type] - Optional type filter
   * @returns {Array} Array of notification instances
   */
  static getAll(type = null) {
    return type 
      ? Notification.notifications.filter(n => n.options.type === type)
      : [...Notification.notifications];
  }

  /**
   * Set default options for all notifications
   * @static
   * @param {Object} options - Default options
   */
  static setDefaults(options) {
    Notification.defaults = { ...Notification.defaults, ...options };
  }
}

// Default options
Notification.defaults = {
  duration: 4000,
  closable: true,
  progressBar: true,
  position: 'top-right'
};

export default Notification;