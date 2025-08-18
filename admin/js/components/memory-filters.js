/**
 * Memory Filters Component - Filter bar for memory search and category filtering
 * 
 * @class MemoryFilters
 * @extends EventTarget
 * 
 * @example
 * const filters = new MemoryFilters({
 *   categories: ['family', 'health', 'preferences', 'topics_to_avoid', 'general'],
 *   placeholder: 'Search memories...'
 * });
 * 
 * filters.on('filter', (e) => {
 *   console.log('Filter changed:', e.detail);
 *   // { searchTerm: 'music', selectedCategories: ['preferences'] }
 * });
 * 
 * filters.on('clear', () => {
 *   console.log('Filters cleared');
 * });
 * 
 * document.getElementById('filters-container').appendChild(filters.element);
 */
export class MemoryFilters extends EventTarget {
  /**
   * Create a MemoryFilters instance
   * @param {Object} options - Filter configuration options
   * @param {Array} [options.categories] - Available categories
   * @param {string} [options.placeholder='Search memories...'] - Search input placeholder
   * @param {string} [options.className=''] - Additional CSS classes
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      categories: ['family', 'health', 'preferences', 'topics_to_avoid', 'general'],
      placeholder: 'Search memories...',
      className: '',
      ...options
    };
    
    this.searchTerm = '';
    this.selectedCategories = new Set();
    this.searchTimeout = null;
    
    this.element = this.createElement();
    this.bindEvents();
  }

  /**
   * Create the filter DOM element
   * @private
   * @returns {HTMLElement} The filter container element
   */
  createElement() {
    const container = document.createElement('div');
    container.className = `memory-filters ${this.options.className}`.trim();
    
    container.innerHTML = `
      <div class="filters-top">
        <div class="search-container">
          <div class="search-input-wrapper">
            <input 
              type="text" 
              class="search-input" 
              placeholder="${this.options.placeholder}"
              aria-label="Search memories"
            />
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <button class="search-clear" style="display: none;" aria-label="Clear search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="filter-actions">
          <button class="clear-all-btn" style="display: none;">
            Clear All Filters
          </button>
        </div>
      </div>
      
      <div class="filters-bottom">
        <div class="category-filters">
          <span class="filter-label">Categories:</span>
          <div class="category-chips">
            ${this.options.categories.map(category => `
              <button 
                class="category-chip" 
                data-category="${category}"
                aria-pressed="false"
                title="Filter by ${this.formatCategoryName(category)}"
              >
                <span class="category-badge category-${category}">
                  ${this.formatCategoryName(category)}
                </span>
                <span class="chip-count" style="display: none;">0</span>
              </button>
            `).join('')}
          </div>
        </div>
        
        <div class="active-filters" style="display: none;">
          <span class="filter-label">Active filters:</span>
          <div class="active-filter-chips"></div>
        </div>
      </div>
      
      <div class="filter-summary">
        <span class="result-count"></span>
      </div>
    `;
    
    return container;
  }

  /**
   * Bind event listeners
   * @private
   */
  bindEvents() {
    // Search input
    const searchInput = this.element.querySelector('.search-input');
    const searchClear = this.element.querySelector('.search-clear');
    
    searchInput.addEventListener('input', (e) => {
      this.setSearchTerm(e.target.value);
    });
    
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.clearSearch();
      }
    });
    
    searchClear.addEventListener('click', () => {
      this.clearSearch();
    });
    
    // Category chips
    this.element.addEventListener('click', (e) => {
      const chip = e.target.closest('.category-chip');
      if (chip) {
        const category = chip.dataset.category;
        this.toggleCategory(category);
      }
    });
    
    // Clear all button
    const clearAllBtn = this.element.querySelector('.clear-all-btn');
    clearAllBtn.addEventListener('click', () => {
      this.clearAll();
    });
    
    // Remove active filter chips
    this.element.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.remove-filter');
      if (removeBtn) {
        const type = removeBtn.dataset.type;
        const value = removeBtn.dataset.value;
        
        if (type === 'search') {
          this.clearSearch();
        } else if (type === 'category') {
          this.toggleCategory(value);
        }
      }
    });
  }

  /**
   * Set search term with debouncing
   * @param {string} term - Search term
   */
  setSearchTerm(term) {
    this.searchTerm = term.trim();
    
    // Update UI
    this.updateSearchUI();
    
    // Debounce the filter event
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.emitFilterEvent();
    }, 300);
  }

  /**
   * Clear search term
   */
  clearSearch() {
    this.searchTerm = '';
    const searchInput = this.element.querySelector('.search-input');
    searchInput.value = '';
    this.updateSearchUI();
    this.emitFilterEvent();
  }

  /**
   * Toggle category filter
   * @param {string} category - Category to toggle
   */
  toggleCategory(category) {
    if (this.selectedCategories.has(category)) {
      this.selectedCategories.delete(category);
    } else {
      this.selectedCategories.add(category);
    }
    
    this.updateCategoryUI();
    this.updateActiveFilters();
    this.updateClearAllButton();
    this.emitFilterEvent();
  }

  /**
   * Clear all filters
   */
  clearAll() {
    this.searchTerm = '';
    this.selectedCategories.clear();
    
    const searchInput = this.element.querySelector('.search-input');
    searchInput.value = '';
    
    this.updateSearchUI();
    this.updateCategoryUI();
    this.updateActiveFilters();
    this.updateClearAllButton();
    this.emitFilterEvent();
    
    this.dispatchEvent(new CustomEvent('clear'));
  }

  /**
   * Set category counts for display
   * @param {Object} counts - Category counts object
   */
  setCategoryCounts(counts) {
    const chips = this.element.querySelectorAll('.category-chip');
    
    chips.forEach(chip => {
      const category = chip.dataset.category;
      const countElement = chip.querySelector('.chip-count');
      const count = counts[category] || 0;
      
      if (count > 0) {
        countElement.textContent = count;
        countElement.style.display = 'inline';
      } else {
        countElement.style.display = 'none';
      }
    });
  }

  /**
   * Set result count
   * @param {number} count - Number of results
   * @param {number} total - Total number of items
   */
  setResultCount(count, total) {
    const resultCount = this.element.querySelector('.result-count');
    
    if (this.hasActiveFilters()) {
      resultCount.textContent = `Showing ${count} of ${total} memories`;
    } else {
      resultCount.textContent = `${total} memories total`;
    }
  }

  /**
   * Update search UI
   * @private
   */
  updateSearchUI() {
    const searchClear = this.element.querySelector('.search-clear');
    
    if (this.searchTerm) {
      searchClear.style.display = 'block';
    } else {
      searchClear.style.display = 'none';
    }
  }

  /**
   * Update category UI
   * @private
   */
  updateCategoryUI() {
    const chips = this.element.querySelectorAll('.category-chip');
    
    chips.forEach(chip => {
      const category = chip.dataset.category;
      const isSelected = this.selectedCategories.has(category);
      
      chip.classList.toggle('active', isSelected);
      chip.setAttribute('aria-pressed', isSelected.toString());
    });
  }

  /**
   * Update active filters display
   * @private
   */
  updateActiveFilters() {
    const activeFiltersContainer = this.element.querySelector('.active-filters');
    const activeFiltersChips = this.element.querySelector('.active-filter-chips');
    
    const hasFilters = this.hasActiveFilters();
    
    if (hasFilters) {
      const chips = [];
      
      // Add search filter chip
      if (this.searchTerm) {
        chips.push(`
          <div class="active-filter-chip">
            <span class="filter-type">Search:</span>
            <span class="filter-value">"${this.escapeHtml(this.searchTerm)}"</span>
            <button class="remove-filter" data-type="search" aria-label="Remove search filter">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        `);
      }
      
      // Add category filter chips
      this.selectedCategories.forEach(category => {
        chips.push(`
          <div class="active-filter-chip">
            <span class="category-badge category-${category}">
              ${this.formatCategoryName(category)}
            </span>
            <button class="remove-filter" data-type="category" data-value="${category}" aria-label="Remove ${this.formatCategoryName(category)} filter">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        `);
      });
      
      activeFiltersChips.innerHTML = chips.join('');
      activeFiltersContainer.style.display = 'flex';
    } else {
      activeFiltersContainer.style.display = 'none';
    }
  }

  /**
   * Update clear all button visibility
   * @private
   */
  updateClearAllButton() {
    const clearAllBtn = this.element.querySelector('.clear-all-btn');
    const hasFilters = this.hasActiveFilters();
    
    clearAllBtn.style.display = hasFilters ? 'block' : 'none';
  }

  /**
   * Check if there are active filters
   * @private
   * @returns {boolean} Whether there are active filters
   */
  hasActiveFilters() {
    return this.searchTerm || this.selectedCategories.size > 0;
  }

  /**
   * Emit filter change event
   * @private
   */
  emitFilterEvent() {
    this.updateActiveFilters();
    this.updateClearAllButton();
    
    this.dispatchEvent(new CustomEvent('filter', {
      detail: {
        searchTerm: this.searchTerm,
        selectedCategories: Array.from(this.selectedCategories),
        hasActiveFilters: this.hasActiveFilters()
      }
    }));
  }

  /**
   * Get current filter state
   * @returns {Object} Current filter state
   */
  getFilters() {
    return {
      searchTerm: this.searchTerm,
      selectedCategories: Array.from(this.selectedCategories),
      hasActiveFilters: this.hasActiveFilters()
    };
  }

  /**
   * Set filter state
   * @param {Object} filters - Filter state to set
   * @param {string} [filters.searchTerm=''] - Search term
   * @param {Array} [filters.selectedCategories=[]] - Selected categories
   */
  setFilters(filters) {
    this.searchTerm = filters.searchTerm || '';
    this.selectedCategories = new Set(filters.selectedCategories || []);
    
    // Update UI
    const searchInput = this.element.querySelector('.search-input');
    searchInput.value = this.searchTerm;
    
    this.updateSearchUI();
    this.updateCategoryUI();
    this.updateActiveFilters();
    this.updateClearAllButton();
  }

  /**
   * Format category name for display
   * @private
   * @param {string} category - Category value
   * @returns {string} Formatted category name
   */
  formatCategoryName(category) {
    return category.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  /**
   * Escape HTML characters
   * @private
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
   * Destroy the component and clean up
   */
  destroy() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

export default MemoryFilters;