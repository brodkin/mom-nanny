/**
 * Global Search Module
 * 
 * Provides global search functionality across all admin pages.
 * When user searches, redirects to conversations page with search query.
 * If already on conversations page, triggers search without page reload.
 */

class GlobalSearch {
  constructor() {
    this.searchInput = null;
    this.searchIcon = null;
    this.searchContainer = null;
    this.isLoading = false;
    this.searchTimeout = null;
    this.init();
  }

  /**
   * Initialize global search functionality
   */
  init() {
    // Find the global search elements
    this.searchInput = document.getElementById('global-search-input');
    this.searchContainer = document.querySelector('.global-search-container');
    this.searchIcon = this.searchInput?.parentElement?.querySelector('.search-icon');

    if (!this.searchInput) {
      console.warn('Global search input not found');
      return;
    }

    this.bindEvents();
    this.checkUrlParams();
    this.initializeAnimations();
  }

  /**
   * Initialize modern animations and interactions
   */
  initializeAnimations() {
    // Add entrance animation
    setTimeout(() => {
      this.searchContainer?.classList.add('animate-fade-in');
    }, 100);

    // Add subtle hover effect on container
    if (this.searchContainer) {
      this.searchContainer.addEventListener('mouseenter', () => {
        if (!this.isLoading) {
          this.searchContainer.style.transform = 'translateY(-1px)';
        }
      });

      this.searchContainer.addEventListener('mouseleave', () => {
        if (!this.isLoading) {
          this.searchContainer.style.transform = 'translateY(0)';
        }
      });
    }
  }

  /**
   * Bind event listeners with enhanced interactions
   */
  bindEvents() {
    // Handle Enter key with modern feedback
    this.searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.performSearch();
      }
      
      // Add typing effect
      this.clearTimeout();
      this.searchTimeout = setTimeout(() => {
        this.handleTyping();
      }, 150);
    });

    // Handle search icon click with animation
    if (this.searchIcon) {
      this.searchIcon.addEventListener('click', () => {
        this.performSearch();
      });
      // Make search icon clickable with enhanced styling
      this.searchIcon.classList.add('clickable');
      
      // Add ripple effect on click
      this.searchIcon.addEventListener('mousedown', this.createRipple.bind(this));
    }

    // Enhanced focus/blur states with modern animations
    this.searchInput.addEventListener('focus', () => {
      this.activateSearchState();
    });

    this.searchInput.addEventListener('blur', () => {
      this.deactivateSearchState();
    });

    // Add input event for live feedback
    this.searchInput.addEventListener('input', (event) => {
      this.handleInputChange(event.target.value);
    });

    // Add modern keyboard navigation
    this.searchInput.addEventListener('keydown', (event) => {
      this.handleKeyboardNavigation(event);
    });
  }

  /**
   * Handle typing with visual feedback
   */
  handleTyping() {
    const query = this.searchInput.value.trim();
    
    // Add visual feedback for typing
    if (query.length > 0) {
      this.searchContainer?.classList.add('has-content');
    } else {
      this.searchContainer?.classList.remove('has-content');
    }
  }

  /**
   * Activate enhanced search state
   */
  activateSearchState() {
    this.searchContainer?.classList.add('search-active');
    this.searchInput.parentElement?.classList.add('focused');
    
    // Add pulse animation
    setTimeout(() => {
      this.searchContainer?.classList.add('search-focused');
    }, 50);
  }

  /**
   * Deactivate search state
   */
  deactivateSearchState() {
    // Delay removal to allow for click events
    setTimeout(() => {
      this.searchContainer?.classList.remove('search-active', 'search-focused');
      this.searchInput.parentElement?.classList.remove('focused');
    }, 150);
  }

  /**
   * Handle input changes with modern feedback
   */
  handleInputChange(value) {
    const trimmedValue = value.trim();
    
    if (trimmedValue.length > 0) {
      this.searchContainer?.classList.add('has-content');
      this.searchIcon?.classList.add('active');
    } else {
      this.searchContainer?.classList.remove('has-content');
      this.searchIcon?.classList.remove('active');
    }
  }

  /**
   * Create ripple effect for button interactions
   */
  createRipple(event) {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    const ripple = document.createElement('div');
    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      background: rgba(99, 102, 241, 0.3);
      border-radius: 50%;
      transform: scale(0);
      animation: ripple 0.6s linear;
      pointer-events: none;
      z-index: 1;
    `;
    
    button.style.position = 'relative';
    button.appendChild(ripple);
    
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }

  /**
   * Handle keyboard navigation
   */
  handleKeyboardNavigation(event) {
    switch (event.key) {
      case 'Escape':
        this.clearSearch();
        this.searchInput.blur();
        break;
      case 'ArrowDown':
        // Future: Navigate to search suggestions
        event.preventDefault();
        break;
      case 'ArrowUp':
        // Future: Navigate to search suggestions
        event.preventDefault();
        break;
    }
  }

  /**
   * Clear timeout helper
   */
  clearTimeout() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }
  }

  /**
   * Check URL parameters for search query and populate input
   */
  checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('search');
    
    if (searchQuery) {
      this.searchInput.value = decodeURIComponent(searchQuery);
      
      // If we're on conversations page, trigger search
      if (this.isConversationsPage()) {
        this.triggerConversationsSearch(searchQuery);
      }
    }
  }

  /**
   * Perform the search action with modern loading states
   */
  async performSearch() {
    const query = this.searchInput.value.trim();
    
    if (!query) {
      this.shakeSearchBar();
      return;
    }

    // Start loading state with animation
    this.setLoadingState(true);

    try {
      if (this.isConversationsPage()) {
        // If already on conversations page, trigger search without reload
        await this.triggerConversationsSearch(query);
        this.updateUrlWithSearch(query);
        
        // Brief delay to show loading state
        setTimeout(() => {
          this.setLoadingState(false);
          this.showSearchSuccess();
        }, 300);
      } else {
        // Redirect to conversations page with search query
        this.redirectToConversations(query);
        // Loading state will be cleared on page navigation
      }
    } catch (error) {
      console.error('Search error:', error);
      this.setLoadingState(false);
      this.showSearchError();
    }
  }

  /**
   * Set loading state with visual feedback
   */
  setLoadingState(isLoading) {
    this.isLoading = isLoading;
    
    if (isLoading) {
      this.searchContainer?.classList.add('loading');
      this.searchIcon?.classList.add('loading');
      this.searchInput.disabled = true;
      
      // Add loading pulse effect
      this.searchContainer?.style.setProperty('animation', 'searchPulse 1s infinite');
    } else {
      this.searchContainer?.classList.remove('loading');
      this.searchIcon?.classList.remove('loading');
      this.searchInput.disabled = false;
      
      // Remove loading animation
      this.searchContainer?.style.removeProperty('animation');
    }
  }

  /**
   * Show search success feedback
   */
  showSearchSuccess() {
    this.searchContainer?.classList.add('search-success');
    
    setTimeout(() => {
      this.searchContainer?.classList.remove('search-success');
    }, 1000);
  }

  /**
   * Show search error feedback
   */
  showSearchError() {
    this.searchContainer?.classList.add('search-error');
    this.shakeSearchBar();
    
    setTimeout(() => {
      this.searchContainer?.classList.remove('search-error');
    }, 1500);
  }

  /**
   * Shake animation for invalid input
   */
  shakeSearchBar() {
    this.searchContainer?.classList.add('shake');
    
    setTimeout(() => {
      this.searchContainer?.classList.remove('shake');
    }, 600);
  }

  /**
   * Check if we're currently on the conversations page
   */
  isConversationsPage() {
    return window.location.pathname.includes('/conversations') || 
           window.location.pathname.includes('conversations.html');
  }

  /**
   * Trigger search on conversations page
   */
  triggerConversationsSearch(query) {
    // Check if ConversationsPage is available and trigger its search
    if (window.conversationsPage && typeof window.conversationsPage.performGlobalSearch === 'function') {
      window.conversationsPage.performGlobalSearch(query);
    } else {
      // Fallback: populate the local search input if it exists
      const localSearchInput = document.getElementById('global-search');
      if (localSearchInput) {
        localSearchInput.value = query;
        // Trigger input event to activate existing search functionality
        localSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  /**
   * Update URL with search parameter without page reload
   */
  updateUrlWithSearch(query) {
    const url = new URL(window.location);
    if (query) {
      url.searchParams.set('search', encodeURIComponent(query));
    } else {
      url.searchParams.delete('search');
    }
    window.history.replaceState({}, '', url);
  }

  /**
   * Redirect to conversations page with search query
   */
  redirectToConversations(query) {
    const conversationsUrl = new URL('/admin/conversations', window.location.origin);
    conversationsUrl.searchParams.set('search', encodeURIComponent(query));
    window.location.href = conversationsUrl.toString();
  }

  /**
   * Clear the search input
   */
  clearSearch() {
    if (this.searchInput) {
      this.searchInput.value = '';
      this.updateUrlWithSearch('');
    }
  }

  /**
   * Set search query programmatically
   */
  setSearchQuery(query) {
    if (this.searchInput) {
      this.searchInput.value = query || '';
    }
  }

  /**
   * Get current search query
   */
  getSearchQuery() {
    return this.searchInput ? this.searchInput.value.trim() : '';
  }
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.globalSearch = new GlobalSearch();
});

// Export for module use
export { GlobalSearch };