/**
 * Category Badge Component - Color-coded badges for memory categories
 * 
 * @class CategoryBadge
 * 
 * @example
 * // Create individual badge
 * const badge = CategoryBadge.create('family');
 * document.getElementById('container').appendChild(badge);
 * 
 * // Create badge with custom text
 * const customBadge = CategoryBadge.create('health', 'Medical Info');
 * 
 * // Get all available categories
 * const categories = CategoryBadge.getCategories();
 * 
 * // Render multiple badges
 * const badgeContainer = CategoryBadge.renderMultiple(['family', 'health', 'preferences']);
 */
export class CategoryBadge {
  /**
   * Category configuration with colors and descriptions
   * @static
   * @private
   */
  static CATEGORIES = {
    family: {
      name: 'Family',
      color: 'blue',
      description: 'Information about family members, relationships, and important family events'
    },
    health: {
      name: 'Health',
      color: 'green',
      description: 'Medical conditions, medications, allergies, and health-related preferences'
    },
    preferences: {
      name: 'Preferences',
      color: 'purple',
      description: 'Personal likes, dislikes, hobbies, interests, and comfort preferences'
    },
    topics_to_avoid: {
      name: 'Topics to Avoid',
      color: 'red',
      description: 'Sensitive subjects or topics that may cause distress or discomfort'
    },
    general: {
      name: 'General',
      color: 'gray',
      description: 'Other important information that doesn\'t fit into specific categories'
    }
  };

  /**
   * Create a category badge element
   * @static
   * @param {string} category - Category key
   * @param {string} [customText] - Custom text to display (defaults to category name)
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.interactive=false] - Whether badge should be interactive
   * @param {boolean} [options.removable=false] - Whether badge should have remove button
   * @param {string} [options.size='medium'] - Badge size (small, medium, large)
   * @param {Function} [options.onRemove] - Callback for remove button click
   * @param {Function} [options.onClick] - Callback for badge click
   * @returns {HTMLElement} Badge element
   */
  static create(category, customText = null, options = {}) {
    const config = this.CATEGORIES[category];
    if (!config) {
      console.warn(`Unknown category: ${category}`);
      return this.createUnknownBadge(category, customText);
    }

    const {
      interactive = false,
      removable = false,
      size = 'medium',
      onRemove = null,
      onClick = null
    } = options;

    const badge = document.createElement(interactive ? 'button' : 'span');
    const text = customText || config.name;
    
    badge.className = `category-badge category-${category} size-${size}`;
    badge.setAttribute('data-category', category);
    badge.setAttribute('title', config.description);
    
    if (interactive) {
      badge.setAttribute('type', 'button');
      badge.setAttribute('aria-label', `${text} category`);
      badge.setAttribute('role', 'button');
      badge.setAttribute('tabindex', '0');
    }

    let badgeContent = `<span class="badge-text">${this.escapeHtml(text)}</span>`;
    
    if (removable) {
      badgeContent += `
        <button class="badge-remove" aria-label="Remove ${text}" type="button">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;
    }

    badge.innerHTML = badgeContent;

    // Bind events
    if (onClick && interactive) {
      badge.addEventListener('click', (e) => {
        e.preventDefault();
        onClick(category, badge);
      });
      
      badge.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(category, badge);
        }
      });
    }

    if (removable && onRemove) {
      const removeBtn = badge.querySelector('.badge-remove');
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        onRemove(category, badge);
      });
    }

    return badge;
  }

  /**
   * Create badge for unknown category
   * @static
   * @private
   * @param {string} category - Unknown category key
   * @param {string} [customText] - Custom text
   * @returns {HTMLElement} Badge element
   */
  static createUnknownBadge(category, customText = null) {
    const badge = document.createElement('span');
    const text = customText || this.formatCategoryName(category);
    
    badge.className = 'category-badge category-unknown';
    badge.setAttribute('data-category', category);
    badge.setAttribute('title', 'Unknown category');
    badge.innerHTML = `<span class="badge-text">${this.escapeHtml(text)}</span>`;
    
    return badge;
  }

  /**
   * Create a badge list container with multiple badges
   * @static
   * @param {Array} categories - Array of category keys
   * @param {Object} [options] - Options for each badge
   * @returns {HTMLElement} Container element with badges
   */
  static renderMultiple(categories, options = {}) {
    const container = document.createElement('div');
    container.className = 'category-badge-list';
    
    categories.forEach(category => {
      const badge = this.create(category, null, options);
      container.appendChild(badge);
    });
    
    return container;
  }

  /**
   * Create an interactive badge selector
   * @static
   * @param {Object} options - Selector options
   * @param {Array} [options.selectedCategories=[]] - Initially selected categories
   * @param {boolean} [options.multiSelect=true] - Allow multiple selections
   * @param {Function} [options.onChange] - Callback when selection changes
   * @param {Array} [options.excludeCategories=[]] - Categories to exclude
   * @returns {Object} Selector object with element and methods
   */
  static createSelector(options = {}) {
    const {
      selectedCategories = [],
      multiSelect = true,
      onChange = null,
      excludeCategories = []
    } = options;

    const selectedSet = new Set(selectedCategories);
    const availableCategories = Object.keys(this.CATEGORIES)
      .filter(cat => !excludeCategories.includes(cat));

    const container = document.createElement('div');
    container.className = 'category-badge-selector';

    const updateSelection = () => {
      if (onChange) {
        onChange(Array.from(selectedSet));
      }
    };

    const renderBadges = () => {
      container.innerHTML = '';
      
      availableCategories.forEach(category => {
        const isSelected = selectedSet.has(category);
        const badge = this.create(category, null, {
          interactive: true,
          size: 'medium',
          onClick: (cat) => {
            if (multiSelect) {
              if (selectedSet.has(cat)) {
                selectedSet.delete(cat);
              } else {
                selectedSet.add(cat);
              }
            } else {
              selectedSet.clear();
              selectedSet.add(cat);
            }
            renderBadges();
            updateSelection();
          }
        });

        if (isSelected) {
          badge.classList.add('selected');
          badge.setAttribute('aria-pressed', 'true');
        } else {
          badge.setAttribute('aria-pressed', 'false');
        }

        container.appendChild(badge);
      });
    };

    renderBadges();

    return {
      element: container,
      getSelected: () => Array.from(selectedSet),
      setSelected: (categories) => {
        selectedSet.clear();
        categories.forEach(cat => selectedSet.add(cat));
        renderBadges();
      },
      clear: () => {
        selectedSet.clear();
        renderBadges();
        updateSelection();
      }
    };
  }

  /**
   * Get all available categories
   * @static
   * @returns {Array} Array of category objects
   */
  static getCategories() {
    return Object.entries(this.CATEGORIES).map(([key, config]) => ({
      key,
      ...config
    }));
  }

  /**
   * Get category configuration
   * @static
   * @param {string} category - Category key
   * @returns {Object|null} Category configuration
   */
  static getCategoryConfig(category) {
    return this.CATEGORIES[category] || null;
  }

  /**
   * Format category name for display
   * @static
   * @param {string} category - Category key
   * @returns {string} Formatted name
   */
  static formatCategoryName(category) {
    const config = this.CATEGORIES[category];
    if (config) {
      return config.name;
    }
    
    return category.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  /**
   * Get category color
   * @static
   * @param {string} category - Category key
   * @returns {string} Color name
   */
  static getCategoryColor(category) {
    const config = this.CATEGORIES[category];
    return config ? config.color : 'gray';
  }

  /**
   * Validate category
   * @static
   * @param {string} category - Category to validate
   * @returns {boolean} Whether category is valid
   */
  static isValidCategory(category) {
    return Object.prototype.hasOwnProperty.call(this.CATEGORIES, category);
  }

  /**
   * Create a category legend/guide
   * @static
   * @param {Object} [options] - Legend options
   * @param {boolean} [options.showDescriptions=true] - Show category descriptions
   * @param {Array} [options.categories] - Specific categories to show (defaults to all)
   * @returns {HTMLElement} Legend element
   */
  static createLegend(options = {}) {
    const {
      showDescriptions = true,
      categories = Object.keys(this.CATEGORIES)
    } = options;

    const legend = document.createElement('div');
    legend.className = 'category-legend';
    
    const title = document.createElement('h3');
    title.className = 'legend-title';
    title.textContent = 'Memory Categories';
    legend.appendChild(title);

    const list = document.createElement('div');
    list.className = 'legend-list';

    categories.forEach(category => {
      const config = this.CATEGORIES[category];
      if (!config) return;

      const item = document.createElement('div');
      item.className = 'legend-item';
      
      const badge = this.create(category);
      item.appendChild(badge);

      if (showDescriptions) {
        const description = document.createElement('p');
        description.className = 'legend-description';
        description.textContent = config.description;
        item.appendChild(description);
      }

      list.appendChild(item);
    });

    legend.appendChild(list);
    return legend;
  }

  /**
   * Escape HTML characters
   * @static
   * @private
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  static escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export default CategoryBadge;