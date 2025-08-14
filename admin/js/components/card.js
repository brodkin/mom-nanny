/**
 * Card Component - Expandable cards with loading states and refresh functionality
 * 
 * @class Card
 * @extends EventTarget
 * 
 * @example
 * const card = new Card({
 *   title: 'Dashboard Stats',
 *   content: '<p>Statistics content here</p>',
 *   collapsible: true,
 *   refreshable: true
 * });
 * 
 * card.on('refresh', () => {
 *   // Handle refresh logic
 * });
 * 
 * document.body.appendChild(card.element);
 */
export class Card extends EventTarget {
  /**
   * Create a Card instance
   * @param {Object} options - Card configuration options
   * @param {string} options.title - Card title
   * @param {string} [options.content=''] - Card content HTML
   * @param {boolean} [options.collapsible=true] - Whether card can be collapsed
   * @param {boolean} [options.refreshable=false] - Whether card has refresh button
   * @param {boolean} [options.loading=false] - Initial loading state
   * @param {string} [options.className=''] - Additional CSS classes
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      title: '',
      content: '',
      collapsible: true,
      refreshable: false,
      loading: false,
      className: '',
      ...options
    };
    
    this.isCollapsed = false;
    this.isLoading = this.options.loading;
    
    this.element = this.createElement();
    this.bindEvents();
  }

  /**
   * Create the card DOM element
   * @private
   * @returns {HTMLElement} The card element
   */
  createElement() {
    const card = document.createElement('div');
    card.className = `card ${this.options.className}`.trim();
    
    card.innerHTML = `
      <div class="card-header">
        <h3 class="card-title">${this.options.title}</h3>
        <div class="card-actions">
          ${this.options.refreshable ? '<button class="card-refresh-btn" aria-label="Refresh"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg></button>' : ''}
          ${this.options.collapsible ? '<button class="card-toggle-btn" aria-label="Toggle"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></button>' : ''}
        </div>
      </div>
      <div class="card-content">
        <div class="card-skeleton" style="display: ${this.isLoading ? 'block' : 'none'}">
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
        <div class="card-body" style="display: ${this.isLoading ? 'none' : 'block'}">
          ${this.options.content}
        </div>
      </div>
    `;
    
    return card;
  }

  /**
   * Bind event listeners
   * @private
   */
  bindEvents() {
    // Toggle collapse
    const toggleBtn = this.element.querySelector('.card-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggle());
    }
    
    // Refresh
    const refreshBtn = this.element.querySelector('.card-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refresh());
    }
  }

  /**
   * Toggle card collapsed state
   */
  toggle() {
    this.isCollapsed = !this.isCollapsed;
    const content = this.element.querySelector('.card-content');
    const toggleBtn = this.element.querySelector('.card-toggle-btn svg');
    
    if (this.isCollapsed) {
      content.style.display = 'none';
      this.element.classList.add('collapsed');
      if (toggleBtn) {
        toggleBtn.style.transform = 'rotate(-90deg)';
      }
    } else {
      content.style.display = 'block';
      this.element.classList.remove('collapsed');
      if (toggleBtn) {
        toggleBtn.style.transform = 'rotate(0deg)';
      }
    }
    
    this.dispatchEvent(new CustomEvent('toggle', { 
      detail: { collapsed: this.isCollapsed } 
    }));
  }

  /**
   * Trigger card refresh
   */
  refresh() {
    this.setLoading(true);
    
    const refreshBtn = this.element.querySelector('.card-refresh-btn');
    if (refreshBtn) {
      refreshBtn.classList.add('spinning');
    }
    
    this.dispatchEvent(new CustomEvent('refresh'));
  }

  /**
   * Set loading state
   * @param {boolean} loading - Whether card is loading
   */
  setLoading(loading) {
    this.isLoading = loading;
    const skeleton = this.element.querySelector('.card-skeleton');
    const body = this.element.querySelector('.card-body');
    const refreshBtn = this.element.querySelector('.card-refresh-btn');
    
    if (loading) {
      skeleton.style.display = 'block';
      body.style.display = 'none';
    } else {
      skeleton.style.display = 'none';
      body.style.display = 'block';
      
      if (refreshBtn) {
        refreshBtn.classList.remove('spinning');
      }
    }
  }

  /**
   * Update card content
   * @param {string} content - New content HTML
   */
  setContent(content) {
    const body = this.element.querySelector('.card-body');
    if (body) {
      body.innerHTML = content;
    }
    this.setLoading(false);
  }

  /**
   * Update card title
   * @param {string} title - New title
   */
  setTitle(title) {
    const titleElement = this.element.querySelector('.card-title');
    if (titleElement) {
      titleElement.textContent = title;
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
   * Destroy the card and clean up
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

export default Card;