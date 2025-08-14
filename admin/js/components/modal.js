/**
 * Modal Component - Programmatic modal creation with multiple sizes and types
 * 
 * @class Modal
 * @extends EventTarget
 * 
 * @example
 * const modal = new Modal({
 *   title: 'Confirm Action',
 *   content: '<p>Are you sure you want to proceed?</p>',
 *   size: 'medium',
 *   type: 'confirmation',
 *   buttons: [
 *     { text: 'Cancel', action: 'cancel', style: 'secondary' },
 *     { text: 'Confirm', action: 'confirm', style: 'primary' }
 *   ]
 * });
 * 
 * modal.on('confirm', () => {
 *   console.log('User confirmed');
 *   modal.close();
 * });
 * 
 * modal.show();
 */
export class Modal extends EventTarget {
  /**
   * Create a Modal instance
   * @param {Object} options - Modal configuration options
   * @param {string} [options.title=''] - Modal title
   * @param {string} [options.content=''] - Modal content HTML
   * @param {string} [options.size='medium'] - Modal size (small, medium, large, full)
   * @param {string} [options.type='default'] - Modal type (default, confirmation, form)
   * @param {Array} [options.buttons=[]] - Modal buttons configuration
   * @param {boolean} [options.closable=true] - Whether modal can be closed
   * @param {boolean} [options.backdrop=true] - Show backdrop
   * @param {boolean} [options.keyboard=true] - Close on escape key
   * @param {string} [options.className=''] - Additional CSS classes
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      title: '',
      content: '',
      size: 'medium',
      type: 'default',
      buttons: [],
      closable: true,
      backdrop: true,
      keyboard: true,
      className: '',
      ...options
    };
    
    this.isVisible = false;
    this.element = this.createElement();
    this.bindEvents();
    
    // Add to DOM but keep hidden
    document.body.appendChild(this.element);
  }

  /**
   * Create the modal DOM element
   * @private
   * @returns {HTMLElement} The modal element
   */
  createElement() {
    const modal = document.createElement('div');
    modal.className = `modal modal-${this.options.size} modal-${this.options.type} ${this.options.className}`.trim();
    modal.style.display = 'none';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('tabindex', '-1');
    
    modal.innerHTML = `
      ${this.options.backdrop ? '<div class="modal-backdrop"></div>' : ''}
      <div class="modal-dialog">
        <div class="modal-content">
          ${this.options.title || this.options.closable ? `
            <div class="modal-header">
              ${this.options.title ? `<h2 class="modal-title">${this.options.title}</h2>` : ''}
              ${this.options.closable ? `
                <button class="modal-close" aria-label="Close">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              ` : ''}
            </div>
          ` : ''}
          
          <div class="modal-body">
            ${this.options.content}
          </div>
          
          ${this.options.buttons.length > 0 ? `
            <div class="modal-footer">
              ${this.options.buttons.map(button => `
                <button class="modal-btn btn-${button.style || 'primary'}" data-action="${button.action || 'close'}">
                  ${button.text}
                </button>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
    
    return modal;
  }

  /**
   * Bind event listeners
   * @private
   */
  bindEvents() {
    // Close button
    const closeBtn = this.element.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }
    
    // Backdrop click
    if (this.options.backdrop && this.options.closable) {
      const backdrop = this.element.querySelector('.modal-backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', () => this.close());
      }
    }
    
    // Button clicks
    this.element.addEventListener('click', (e) => {
      const btn = e.target.closest('.modal-btn');
      if (btn) {
        const action = btn.dataset.action;
        this.handleButtonClick(action, btn);
      }
    });
    
    // Keyboard events
    if (this.options.keyboard) {
      this.keyHandler = (e) => {
        if (e.key === 'Escape' && this.isVisible && this.options.closable) {
          this.close();
        }
        
        // Tab trapping
        if (e.key === 'Tab' && this.isVisible) {
          this.trapFocus(e);
        }
      };
      
      document.addEventListener('keydown', this.keyHandler);
    }
    
    // Focus management
    this.element.addEventListener('focusin', (e) => {
      if (!this.element.contains(e.target)) {
        this.focusFirst();
      }
    });
  }

  /**
   * Handle button click
   * @private
   * @param {string} action - Button action
   * @param {HTMLElement} button - Button element
   */
  handleButtonClick(action, button) {
    // Emit custom event for the action
    const event = new CustomEvent(action, {
      detail: { button, modal: this },
      cancelable: true
    });
    
    this.dispatchEvent(event);
    
    // If event wasn't cancelled and action is 'close', close the modal
    if (!event.defaultPrevented && (action === 'close' || action === 'cancel')) {
      this.close();
    }
  }

  /**
   * Show the modal
   */
  show() {
    if (this.isVisible) return;
    
    this.isVisible = true;
    this.element.style.display = 'block';
    this.element.setAttribute('aria-hidden', 'false');
    
    // Add body class to prevent scrolling
    document.body.classList.add('modal-open');
    
    // Focus first element
    setTimeout(() => {
      this.focusFirst();
    }, 100);
    
    // Animation
    requestAnimationFrame(() => {
      this.element.classList.add('show');
    });
    
    this.dispatchEvent(new CustomEvent('show'));
  }

  /**
   * Hide the modal
   */
  hide() {
    if (!this.isVisible) return;
    
    this.isVisible = false;
    this.element.classList.remove('show');
    
    // Wait for animation to complete
    setTimeout(() => {
      this.element.style.display = 'none';
      this.element.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
    }, 300);
    
    this.dispatchEvent(new CustomEvent('hide'));
  }

  /**
   * Close the modal (alias for hide)
   */
  close() {
    this.hide();
  }

  /**
   * Toggle modal visibility
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Focus first focusable element
   * @private
   */
  focusFirst() {
    const focusableElements = this.element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }

  /**
   * Trap focus within modal
   * @private
   * @param {KeyboardEvent} e - Keyboard event
   */
  trapFocus(e) {
    const focusableElements = Array.from(this.element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ));
    
    if (focusableElements.length === 0) return;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  /**
   * Update modal title
   * @param {string} title - New title
   */
  setTitle(title) {
    const titleElement = this.element.querySelector('.modal-title');
    if (titleElement) {
      titleElement.textContent = title;
    }
  }

  /**
   * Update modal content
   * @param {string} content - New content HTML
   */
  setContent(content) {
    const bodyElement = this.element.querySelector('.modal-body');
    if (bodyElement) {
      bodyElement.innerHTML = content;
    }
  }

  /**
   * Update modal size
   * @param {string} size - New size (small, medium, large, full)
   */
  setSize(size) {
    this.element.className = this.element.className.replace(/modal-\w+/g, '');
    this.element.classList.add(`modal-${size}`);
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
   * Destroy the modal and clean up
   */
  destroy() {
    this.hide();
    
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
    }
    
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    
    // Remove body class if this was the last modal
    if (!document.querySelector('.modal[aria-hidden="false"]')) {
      document.body.classList.remove('modal-open');
    }
  }

  /**
   * Create a confirmation modal
   * @static
   * @param {Object} options - Confirmation options
   * @param {string} options.message - Confirmation message
   * @param {string} [options.title='Confirm'] - Modal title
   * @param {string} [options.confirmText='Confirm'] - Confirm button text
   * @param {string} [options.cancelText='Cancel'] - Cancel button text
   * @returns {Promise} Promise that resolves with boolean result
   */
  static confirm(options = {}) {
    return new Promise((resolve) => {
      const modal = new Modal({
        title: options.title || 'Confirm',
        content: `<p>${options.message}</p>`,
        type: 'confirmation',
        size: 'small',
        buttons: [
          { text: options.cancelText || 'Cancel', action: 'cancel', style: 'secondary' },
          { text: options.confirmText || 'Confirm', action: 'confirm', style: 'primary' }
        ]
      });
      
      modal.on('confirm', () => {
        modal.destroy();
        resolve(true);
      });
      
      modal.on('cancel', () => {
        modal.destroy();
        resolve(false);
      });
      
      modal.on('hide', () => {
        modal.destroy();
        resolve(false);
      });
      
      modal.show();
    });
  }

  /**
   * Create an alert modal
   * @static
   * @param {Object} options - Alert options
   * @param {string} options.message - Alert message
   * @param {string} [options.title='Alert'] - Modal title
   * @param {string} [options.type='info'] - Alert type (success, warning, error, info)
   * @param {string} [options.buttonText='OK'] - Button text
   * @returns {Promise} Promise that resolves when dismissed
   */
  static alert(options = {}) {
    return new Promise((resolve) => {
      const modal = new Modal({
        title: options.title || 'Alert',
        content: `<div class="alert alert-${options.type || 'info'}"><p>${options.message}</p></div>`,
        type: 'alert',
        size: 'small',
        buttons: [
          { text: options.buttonText || 'OK', action: 'close', style: 'primary' }
        ]
      });
      
      modal.on('close', () => {
        modal.destroy();
        resolve();
      });
      
      modal.on('hide', () => {
        modal.destroy();
        resolve();
      });
      
      modal.show();
    });
  }

  /**
   * Create a form modal
   * @static
   * @param {Object} options - Form options
   * @param {string} options.title - Form title
   * @param {Array} options.fields - Form field definitions
   * @param {string} [options.submitText='Submit'] - Submit button text
   * @param {string} [options.cancelText='Cancel'] - Cancel button text
   * @returns {Promise} Promise that resolves with form data or null if cancelled
   */
  static form(options = {}) {
    return new Promise((resolve) => {
      const fields = options.fields || [];
      const formContent = `
        <form class="modal-form">
          ${fields.map(field => {
            const inputId = `field-${field.name}`;
            let inputHTML = '';
            
            switch (field.type) {
              case 'textarea':
                inputHTML = `<textarea id="${inputId}" name="${field.name}" ${field.required ? 'required' : ''}>${field.value || ''}</textarea>`;
                break;
              case 'select':
                inputHTML = `
                  <select id="${inputId}" name="${field.name}" ${field.required ? 'required' : ''}>
                    ${field.options.map(opt => `<option value="${opt.value}" ${opt.selected ? 'selected' : ''}>${opt.text}</option>`).join('')}
                  </select>
                `;
                break;
              default:
                inputHTML = `<input type="${field.type || 'text'}" id="${inputId}" name="${field.name}" value="${field.value || ''}" ${field.required ? 'required' : ''} />`;
            }
            
            return `
              <div class="form-group">
                <label for="${inputId}">${field.label}</label>
                ${inputHTML}
              </div>
            `;
          }).join('')}
        </form>
      `;
      
      const modal = new Modal({
        title: options.title,
        content: formContent,
        type: 'form',
        size: 'medium',
        buttons: [
          { text: options.cancelText || 'Cancel', action: 'cancel', style: 'secondary' },
          { text: options.submitText || 'Submit', action: 'submit', style: 'primary' }
        ]
      });
      
      modal.on('submit', () => {
        const form = modal.element.querySelector('.modal-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        modal.destroy();
        resolve(data);
      });
      
      modal.on('cancel', () => {
        modal.destroy();
        resolve(null);
      });
      
      modal.on('hide', () => {
        modal.destroy();
        resolve(null);
      });
      
      modal.show();
    });
  }
}

export default Modal;