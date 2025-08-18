/**
 * Memory Modal Component - Modal dialog for creating and editing memories
 * 
 * @class MemoryModal
 * @extends EventTarget
 * 
 * @example
 * const modal = new MemoryModal();
 * 
 * // Create new memory
 * modal.show();
 * 
 * // Edit existing memory
 * modal.show({
 *   key: 'favorite_music',
 *   content: 'Loves classical music, especially Mozart',
 *   category: 'preferences'
 * });
 * 
 * modal.on('save', (e) => {
 *   console.log('Memory saved:', e.detail.memory);
 *   modal.hide();
 * });
 */
export class MemoryModal extends EventTarget {
  /**
   * Create a MemoryModal instance
   * @param {Object} options - Modal configuration options
   * @param {string} [options.className=''] - Additional CSS classes
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      className: '',
      ...options
    };
    
    this.isVisible = false;
    this.isLoading = false;
    this.memory = null;
    this.validationErrors = {};
    
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
    modal.className = `modal modal-medium memory-modal ${this.options.className}`.trim();
    modal.style.display = 'none';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-labelledby', 'memory-modal-title');
    
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h2 id="memory-modal-title" class="modal-title">Add Memory</h2>
            <button class="modal-close" aria-label="Close">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <form class="modal-body memory-form" novalidate>
            <div class="form-group">
              <label for="memory-key" class="form-label">
                Memory Key <span class="required">*</span>
              </label>
              <input 
                type="text" 
                id="memory-key" 
                name="key" 
                class="form-input" 
                placeholder="e.g., favorite_music, daughter_name, medication_time"
                required
                aria-describedby="memory-key-help memory-key-error"
              />
              <div id="memory-key-help" class="form-help">
                A unique identifier for this memory (use lowercase with underscores)
              </div>
              <div id="memory-key-error" class="form-error" style="display: none;"></div>
            </div>
            
            <div class="form-group">
              <label for="memory-content" class="form-label">
                Content <span class="required">*</span>
              </label>
              <textarea 
                id="memory-content" 
                name="content" 
                class="form-textarea" 
                rows="4"
                placeholder="Describe the memory in detail..."
                required
                aria-describedby="memory-content-help memory-content-error"
              ></textarea>
              <div id="memory-content-help" class="form-help">
                Detailed information about this memory that will help provide personalized care
              </div>
              <div id="memory-content-error" class="form-error" style="display: none;"></div>
            </div>
            
            <div class="form-group">
              <label for="memory-category" class="form-label">
                Category <span class="required">*</span>
              </label>
              <select 
                id="memory-category" 
                name="category" 
                class="form-select" 
                required
                aria-describedby="memory-category-help memory-category-error"
              >
                <option value="">Select a category...</option>
                <option value="family">Family</option>
                <option value="health">Health</option>
                <option value="preferences">Preferences</option>
                <option value="topics_to_avoid">Topics to Avoid</option>
                <option value="general">General</option>
              </select>
              <div id="memory-category-help" class="form-help">
                Choose the most appropriate category for this memory
              </div>
              <div id="memory-category-error" class="form-error" style="display: none;"></div>
            </div>
            
            <div class="category-descriptions">
              <div class="category-description" data-category="family">
                <div class="category-badge category-family">Family</div>
                <p>Information about family members, relationships, and important family events</p>
              </div>
              <div class="category-description" data-category="health">
                <div class="category-badge category-health">Health</div>
                <p>Medical conditions, medications, allergies, and health-related preferences</p>
              </div>
              <div class="category-description" data-category="preferences">
                <div class="category-badge category-preferences">Preferences</div>
                <p>Personal likes, dislikes, hobbies, interests, and comfort preferences</p>
              </div>
              <div class="category-description" data-category="topics_to_avoid">
                <div class="category-badge category-topics_to_avoid">Topics to Avoid</div>
                <p>Sensitive subjects or topics that may cause distress or discomfort</p>
              </div>
              <div class="category-description" data-category="general">
                <div class="category-badge category-general">General</div>
                <p>Other important information that doesn't fit into specific categories</p>
              </div>
            </div>
          </form>
          
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-action="cancel">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary submit-btn" data-action="save">
              <span class="btn-text">Save Memory</span>
              <div class="btn-loading" style="display: none;">
                <svg class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12a9 9 0 11-6.219-8.56"/>
                </svg>
              </div>
            </button>
          </div>
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
    closeBtn.addEventListener('click', () => this.hide());
    
    // Backdrop click
    const backdrop = this.element.querySelector('.modal-backdrop');
    backdrop.addEventListener('click', () => this.hide());
    
    // Form submission
    const form = this.element.querySelector('.memory-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
    
    // Button clicks
    this.element.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        const action = btn.dataset.action;
        if (action === 'cancel') {
          this.hide();
        } else if (action === 'save') {
          this.handleSubmit();
        }
      }
    });
    
    // Keyboard events
    this.keyHandler = (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    };
    document.addEventListener('keydown', this.keyHandler);
    
    // Real-time validation
    const inputs = this.element.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      input.addEventListener('blur', () => this.validateField(input));
      input.addEventListener('input', () => this.clearFieldError(input));
    });
    
    // Category selection feedback
    const categorySelect = this.element.querySelector('#memory-category');
    categorySelect.addEventListener('change', () => this.updateCategoryDescription());
  }

  /**
   * Show the modal
   * @param {Object} [memory] - Memory data for editing
   */
  show(memory = null) {
    if (this.isVisible) return;
    
    this.memory = memory;
    this.isVisible = true;
    this.validationErrors = {};
    
    // Update title and populate form
    const title = this.element.querySelector('.modal-title');
    const submitBtn = this.element.querySelector('.submit-btn .btn-text');
    
    if (memory) {
      title.textContent = 'Edit Memory';
      submitBtn.textContent = 'Update Memory';
      this.populateForm(memory);
    } else {
      title.textContent = 'Add Memory';
      submitBtn.textContent = 'Save Memory';
      this.resetForm();
    }
    
    // Show modal
    this.element.style.display = 'block';
    this.element.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    
    // Focus first input
    setTimeout(() => {
      const firstInput = this.element.querySelector('#memory-key');
      if (firstInput) {
        firstInput.focus();
      }
    }, 100);
    
    // Animation
    requestAnimationFrame(() => {
      this.element.classList.add('show');
    });
    
    this.dispatchEvent(new CustomEvent('show', { detail: { memory } }));
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
   * Populate form with memory data
   * @private
   * @param {Object} memory - Memory data
   */
  populateForm(memory) {
    const form = this.element.querySelector('.memory-form');
    const keyInput = form.querySelector('#memory-key');
    const contentInput = form.querySelector('#memory-content');
    const categorySelect = form.querySelector('#memory-category');
    
    keyInput.value = memory.key || '';
    contentInput.value = memory.content || '';
    categorySelect.value = memory.category || '';
    
    this.updateCategoryDescription();
    this.clearAllErrors();
  }

  /**
   * Reset form to empty state
   * @private
   */
  resetForm() {
    const form = this.element.querySelector('.memory-form');
    form.reset();
    this.updateCategoryDescription();
    this.clearAllErrors();
  }

  /**
   * Handle form submission
   * @private
   */
  async handleSubmit() {
    if (this.isLoading) return;
    
    const form = this.element.querySelector('.memory-form');
    const formData = new FormData(form);
    const memoryData = {
      key: formData.get('key').trim(),
      content: formData.get('content').trim(),
      category: formData.get('category')
    };
    
    // Add ID for existing memory
    if (this.memory && this.memory.id) {
      memoryData.id = this.memory.id;
    }
    
    // Validate form
    if (!this.validateForm(memoryData)) {
      return;
    }
    
    // Set loading state
    this.setLoading(true);
    
    try {
      // Emit save event
      const event = new CustomEvent('save', {
        detail: { memory: memoryData, isEdit: !!this.memory },
        cancelable: true
      });
      
      this.dispatchEvent(event);
      
      // If event wasn't cancelled, the parent handled the save
      if (!event.defaultPrevented) {
        // Success handled by parent
      }
    } catch (error) {
      console.error('Error saving memory:', error);
      this.showError('Failed to save memory. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Validate form data
   * @private
   * @param {Object} data - Form data to validate
   * @returns {boolean} Whether form is valid
   */
  validateForm(data) {
    this.clearAllErrors();
    let isValid = true;
    
    // Validate key
    if (!data.key) {
      this.setFieldError('key', 'Memory key is required');
      isValid = false;
    } else if (!/^[a-z0-9_]+$/.test(data.key)) {
      this.setFieldError('key', 'Key must contain only lowercase letters, numbers, and underscores');
      isValid = false;
    }
    
    // Validate content
    if (!data.content) {
      this.setFieldError('content', 'Memory content is required');
      isValid = false;
    } else if (data.content.length < 10) {
      this.setFieldError('content', 'Content must be at least 10 characters long');
      isValid = false;
    }
    
    // Validate category
    if (!data.category) {
      this.setFieldError('category', 'Please select a category');
      isValid = false;
    }
    
    return isValid;
  }

  /**
   * Validate individual field
   * @private
   * @param {HTMLElement} field - Field element
   */
  validateField(field) {
    const name = field.name;
    const value = field.value.trim();
    
    this.clearFieldError(name);
    
    switch (name) {
      case 'key':
        if (!value) {
          this.setFieldError('key', 'Memory key is required');
        } else if (!/^[a-z0-9_]+$/.test(value)) {
          this.setFieldError('key', 'Key must contain only lowercase letters, numbers, and underscores');
        }
        break;
        
      case 'content':
        if (!value) {
          this.setFieldError('content', 'Memory content is required');
        } else if (value.length < 10) {
          this.setFieldError('content', 'Content must be at least 10 characters long');
        }
        break;
        
      case 'category':
        if (!value) {
          this.setFieldError('category', 'Please select a category');
        }
        break;
    }
  }

  /**
   * Set field error
   * @private
   * @param {string} fieldName - Field name
   * @param {string} message - Error message
   */
  setFieldError(fieldName, message) {
    this.validationErrors[fieldName] = message;
    
    const field = this.element.querySelector(`[name="${fieldName}"]`);
    const errorElement = this.element.querySelector(`#memory-${fieldName}-error`);
    
    if (field) {
      field.classList.add('error');
      field.setAttribute('aria-invalid', 'true');
    }
    
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }
  }

  /**
   * Clear field error
   * @private
   * @param {string} fieldName - Field name
   */
  clearFieldError(fieldName) {
    delete this.validationErrors[fieldName];
    
    const field = this.element.querySelector(`[name="${fieldName}"]`);
    const errorElement = this.element.querySelector(`#memory-${fieldName}-error`);
    
    if (field) {
      field.classList.remove('error');
      field.setAttribute('aria-invalid', 'false');
    }
    
    if (errorElement) {
      errorElement.style.display = 'none';
    }
  }

  /**
   * Clear all validation errors
   * @private
   */
  clearAllErrors() {
    this.validationErrors = {};
    
    const fields = this.element.querySelectorAll('.form-input, .form-textarea, .form-select');
    const errors = this.element.querySelectorAll('.form-error');
    
    fields.forEach(field => {
      field.classList.remove('error');
      field.setAttribute('aria-invalid', 'false');
    });
    
    errors.forEach(error => {
      error.style.display = 'none';
    });
  }

  /**
   * Update category description visibility
   * @private
   */
  updateCategoryDescription() {
    const categorySelect = this.element.querySelector('#memory-category');
    const descriptions = this.element.querySelectorAll('.category-description');
    const selectedCategory = categorySelect.value;
    
    descriptions.forEach(desc => {
      const category = desc.dataset.category;
      desc.style.display = category === selectedCategory ? 'block' : 'none';
    });
  }

  /**
   * Set loading state
   * @private
   * @param {boolean} loading - Whether in loading state
   */
  setLoading(loading) {
    this.isLoading = loading;
    
    const submitBtn = this.element.querySelector('.submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    const form = this.element.querySelector('.memory-form');
    
    if (loading) {
      submitBtn.disabled = true;
      btnText.style.display = 'none';
      btnLoading.style.display = 'flex';
      form.style.pointerEvents = 'none';
    } else {
      submitBtn.disabled = false;
      btnText.style.display = 'inline';
      btnLoading.style.display = 'none';
      form.style.pointerEvents = 'auto';
    }
  }

  /**
   * Show error message
   * @private
   * @param {string} message - Error message
   */
  showError(message) {
    // Could be enhanced to show a notification or inline error
    console.error(message);
    alert(message); // Temporary - should use notification system
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
}

export default MemoryModal;