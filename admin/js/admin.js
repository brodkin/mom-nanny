/**
 * Admin Dashboard JavaScript
 * Main application logic and interactions
 */

class AdminDashboard {
  constructor() {
    this.init();
    this.bindEvents();
    this.loadInitialData();
  }

  init() {
    // Initialize theme
    this.initializeTheme();
    
    // Initialize sidebar
    this.initializeSidebar();
    
    // Initialize tooltips
    this.initializeTooltips();
    
    // Initialize animations
    this.initializeAnimations();
    
    // Initialize collapsible components
    this.initializeCollapsibles();
    
    console.log('🚀 Admin Dashboard initialized');
    
    // Initialize dashboard-specific features if on dashboard page
    if (window.location.pathname.includes('dashboard')) {
      this.initializeDashboardFeatures();
    }
  }

  bindEvents() {
    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => this.toggleSidebar());
    }

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    // Search functionality
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.target.value = '';
          this.handleSearch('');
        }
      });
    }

    // User profile dropdown
    const userProfile = document.querySelector('.user-profile');
    if (userProfile) {
      userProfile.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdown(userProfile);
      });
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
      this.closeAllDropdowns();
    });

    // Navigation links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => this.handleNavigation(e, link));
    });

    // Modal handlers
    const modalTriggers = document.querySelectorAll('[data-modal]');
    modalTriggers.forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        const modalId = trigger.getAttribute('data-modal');
        this.openModal(modalId);
      });
    });

    // Modal close buttons
    const modalCloses = document.querySelectorAll('.modal-close, .modal-overlay');
    modalCloses.forEach(close => {
      close.addEventListener('click', (e) => {
        if (e.target === close) {
          this.closeModals();
        }
      });
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));

    // Window resize
    window.addEventListener('resize', () => this.handleResize());

    // Scroll animations
    window.addEventListener('scroll', () => this.handleScroll());
  }

  initializeTheme() {
    const savedTheme = localStorage.getItem('admin-theme') || 'light';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme === 'system' ? (prefersDark ? 'dark' : 'light') : savedTheme;
    
    this.setTheme(theme);
    
    // Update theme toggle state
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.classList.toggle('dark', theme === 'dark');
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (localStorage.getItem('admin-theme') === 'system') {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('admin-theme', theme);
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
    
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.classList.toggle('dark', newTheme === 'dark');
    }

    // Add animation
    document.body.style.transition = 'background-color 0.3s ease';
    setTimeout(() => {
      document.body.style.transition = '';
    }, 300);

    this.showToast('Theme updated', `Switched to ${newTheme} mode`, 'success');
  }

  initializeSidebar() {
    const sidebarState = localStorage.getItem('sidebar-collapsed') === 'true';
    const layout = document.querySelector('.admin-layout');
    
    if (sidebarState && layout) {
      layout.classList.add('sidebar-collapsed');
    }
  }

  toggleSidebar() {
    const layout = document.querySelector('.admin-layout');
    const sidebar = document.querySelector('.admin-sidebar');
    
    if (!layout) return;

    const isCollapsed = layout.classList.contains('sidebar-collapsed');
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
      // Mobile: Toggle sidebar visibility
      sidebar.classList.toggle('sidebar-open');
      const overlay = document.querySelector('.layout-overlay');
      if (overlay) {
        overlay.classList.toggle('sidebar-open');
      }
    } else {
      // Desktop: Toggle collapsed state
      layout.classList.toggle('sidebar-collapsed');
      localStorage.setItem('sidebar-collapsed', !isCollapsed);
    }

    // Animate sidebar icons
    this.animateSidebarToggle();
  }

  animateSidebarToggle() {
    const navIcons = document.querySelectorAll('.nav-icon');
    navIcons.forEach((icon, index) => {
      icon.style.animation = `pulse 0.3s ease ${index * 0.1}s`;
      setTimeout(() => {
        icon.style.animation = '';
      }, 300 + (index * 100));
    });
  }

  handleNavigation(e, link) {
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(navLink => {
      navLink.classList.remove('active');
    });

    // Add active class to clicked link
    link.classList.add('active');

    // Store active page
    const page = link.getAttribute('data-page') || link.getAttribute('href');
    if (page && page !== '#') {
      localStorage.setItem('active-page', page);
      
      // Update page content (if using SPA)
      this.loadPageContent(page);
    }

    // Add ripple effect
    this.addRippleEffect(link, e);
  }

  addRippleEffect(element, event) {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    ripple.classList.add('ripple-effect');
    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      transform: scale(0);
      animation: ripple 0.6s linear;
      pointer-events: none;
    `;

    element.style.position = 'relative';
    element.appendChild(ripple);

    setTimeout(() => {
      ripple.remove();
    }, 600);
  }

  handleSearch(query) {
    const searchResults = this.performSearch(query);
    this.displaySearchResults(searchResults);
    
    // Store search query
    if (query) {
      this.addToSearchHistory(query);
    }
  }

  performSearch(query) {
    if (!query.trim()) return [];

    const searchableItems = [
      { title: 'Dashboard', url: '#dashboard', category: 'Navigation' },
      { title: 'Call Logs', url: '#calls', category: 'Navigation' },
      { title: 'Users', url: '#users', category: 'Navigation' },
      { title: 'Settings', url: '#settings', category: 'Navigation' },
      { title: 'Analytics', url: '#analytics', category: 'Navigation' },
      { title: 'System Status', url: '#status', category: 'Monitoring' },
      { title: 'Theme Settings', action: 'toggle-theme', category: 'Settings' },
      { title: 'User Profile', action: 'user-profile', category: 'Account' },
    ];

    return searchableItems.filter(item =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
    );
  }

  displaySearchResults(results) {
    // This would typically update a search results dropdown
    console.log('Search results:', results);
  }

  addToSearchHistory(query) {
    const history = JSON.parse(localStorage.getItem('search-history') || '[]');
    if (!history.includes(query)) {
      history.unshift(query);
      if (history.length > 10) history.pop();
      localStorage.setItem('search-history', JSON.stringify(history));
    }
  }

  toggleDropdown(trigger) {
    const dropdown = trigger.querySelector('.dropdown') || trigger.nextElementSibling;
    if (!dropdown) return;

    const isOpen = dropdown.classList.contains('dropdown-open');
    
    // Close all other dropdowns
    this.closeAllDropdowns();

    if (!isOpen) {
      dropdown.classList.add('dropdown-open');
      dropdown.style.animation = 'fadeInDown 0.2s ease forwards';
    }
  }

  closeAllDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown-open');
    dropdowns.forEach(dropdown => {
      dropdown.style.animation = 'fadeInUp 0.2s ease forwards';
      setTimeout(() => {
        dropdown.classList.remove('dropdown-open');
        dropdown.style.animation = '';
      }, 200);
    });
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.add('modal-open');
    document.body.style.overflow = 'hidden';

    // Focus management
    const firstFocusable = modal.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
      firstFocusable.focus();
    }

    // Add to modal stack
    if (!this.modalStack) this.modalStack = [];
    this.modalStack.push(modalId);
  }

  closeModals() {
    const openModals = document.querySelectorAll('.modal-overlay.modal-open');
    openModals.forEach(modal => {
      modal.classList.remove('modal-open');
    });

    document.body.style.overflow = '';
    this.modalStack = [];
  }

  handleKeyboard(e) {
    // Escape key closes modals and dropdowns
    if (e.key === 'Escape') {
      this.closeModals();
      this.closeAllDropdowns();
    }

    // Cmd/Ctrl + K opens search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.focus();
      }
    }

    // Cmd/Ctrl + B toggles sidebar
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      this.toggleSidebar();
    }

    // Cmd/Ctrl + Shift + T toggles theme
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'T') {
      e.preventDefault();
      this.toggleTheme();
    }
  }

  handleResize() {
    const isMobile = window.innerWidth <= 768;
    const sidebar = document.querySelector('.admin-sidebar');
    const overlay = document.querySelector('.layout-overlay');

    if (!isMobile && sidebar) {
      // Close mobile sidebar on desktop resize
      sidebar.classList.remove('sidebar-open');
      if (overlay) {
        overlay.classList.remove('sidebar-open');
      }
    }

    // Update chart dimensions if needed
    this.resizeCharts();
  }

  handleScroll() {
    const scrollElements = document.querySelectorAll('.scroll-fade-in');
    const windowHeight = window.innerHeight;

    scrollElements.forEach(element => {
      const elementTop = element.getBoundingClientRect().top;
      const elementVisible = 150;

      if (elementTop < windowHeight - elementVisible) {
        element.classList.add('is-visible');
      }
    });
  }

  initializeTooltips() {
    const tooltipElements = document.querySelectorAll('[title], [data-tooltip]');
    
    tooltipElements.forEach(element => {
      const tooltipText = element.getAttribute('data-tooltip') || element.getAttribute('title');
      if (!tooltipText) return;

      // Remove default title to prevent browser tooltip
      element.removeAttribute('title');

      element.addEventListener('mouseenter', () => {
        this.showTooltip(element, tooltipText);
      });

      element.addEventListener('mouseleave', () => {
        this.hideTooltips();
      });
    });
  }

  showTooltip(element, text) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    tooltip.style.cssText = `
      position: absolute;
      background: var(--bg-glass);
      backdrop-filter: blur(20px);
      color: var(--text-primary);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      font-size: var(--text-xs);
      z-index: var(--z-tooltip);
      pointer-events: none;
      opacity: 0;
      transition: opacity var(--transition-fast);
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--border-primary);
    `;

    document.body.appendChild(tooltip);

    // Position tooltip
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    let top = rect.top - tooltipRect.height - 8;

    // Keep tooltip in viewport
    if (left < 8) left = 8;
    if (left + tooltipRect.width > window.innerWidth - 8) {
      left = window.innerWidth - tooltipRect.width - 8;
    }
    if (top < 8) {
      top = rect.bottom + 8;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    // Fade in
    requestAnimationFrame(() => {
      tooltip.style.opacity = '1';
    });

    this.currentTooltip = tooltip;
  }

  hideTooltips() {
    if (this.currentTooltip) {
      this.currentTooltip.style.opacity = '0';
      setTimeout(() => {
        if (this.currentTooltip && this.currentTooltip.parentNode) {
          this.currentTooltip.parentNode.removeChild(this.currentTooltip);
        }
        this.currentTooltip = null;
      }, 200);
    }
  }

  initializeAnimations() {
    // Stagger animation for sidebar navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach((item, index) => {
      item.style.opacity = '0';
      item.style.transform = 'translateX(-20px)';
      item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      
      setTimeout(() => {
        item.style.opacity = '1';
        item.style.transform = 'translateX(0)';
      }, index * 100);
    });

    // Animate stats cards
    const statCards = document.querySelectorAll('.stat-card');
    this.animateCounters(statCards);

    // Initialize scroll animations
    this.handleScroll();
  }

  initializeCollapsibles() {
    // Auto-initialize all elements with data-collapsible attribute
    const collapsibleElements = document.querySelectorAll('[data-collapsible]');
    
    collapsibleElements.forEach(element => {
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
      
      // Create the collapsible instance
      // We'll use dynamic import for better module loading
      if (window.Collapsible) {
        new window.Collapsible(options);
      } else {
        // If Collapsible isn't loaded globally, try to load it
        import('./components/collapsible.js').then(module => {
          new module.default(options);
        }).catch(err => {
          console.warn('Collapsible component not available:', err);
        });
      }
    });
    
    console.log(`🔄 Initialized ${collapsibleElements.length} collapsible sections`);
  }

  animateCounters(elements) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const counter = entry.target.querySelector('.stat-value');
          if (counter && !counter.dataset.animated) {
            this.animateNumber(counter);
            counter.dataset.animated = 'true';
          }
        }
      });
    });

    elements.forEach(element => observer.observe(element));
  }

  animateNumber(element) {
    const target = parseInt(element.textContent.replace(/[^0-9]/g, ''));
    const duration = 2000;
    const start = Date.now();
    const startValue = 0;

    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(startValue + (target - startValue) * easeOutQuart);
      
      element.textContent = current.toLocaleString();
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        element.textContent = target.toLocaleString();
      }
    };

    animate();
  }

  loadPageContent(page) {
    // This would load page content via AJAX in a real application
    console.log(`Loading page: ${page}`);
    
    // Update breadcrumb
    this.updateBreadcrumb(page);
    
    // Show loading state
    this.showPageLoading();
    
    // Simulate loading delay
    setTimeout(() => {
      this.hidePageLoading();
      this.showToast('Navigation', `Loaded ${page} page`, 'success');
    }, 500);
  }

  updateBreadcrumb(page) {
    const breadcrumb = document.querySelector('.breadcrumb');
    if (!breadcrumb) return;

    const pageName = page.charAt(1).toUpperCase() + page.slice(2);
    const currentItem = breadcrumb.querySelector('.breadcrumb-current');
    
    if (currentItem) {
      currentItem.textContent = pageName;
    }
  }

  showPageLoading() {
    const main = document.querySelector('.admin-main');
    if (!main) return;

    const loader = document.createElement('div');
    loader.className = 'page-loader';
    loader.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner-large"></div>
        <div class="loading-text">Loading page...</div>
      </div>
    `;
    loader.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--bg-overlay);
      backdrop-filter: blur(4px);
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    main.style.position = 'relative';
    main.appendChild(loader);
  }

  hidePageLoading() {
    const loader = document.querySelector('.page-loader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => {
        loader.remove();
      }, 300);
    }
  }

  showToast(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} animate-slide-in`;
    toast.innerHTML = `
      <div class="toast-header">
        <h4 class="toast-title">${title}</h4>
        <button class="toast-close" onclick="window.adminDashboard.removeToast(this.parentElement.parentElement)">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M.293.293a1 1 0 011.414 0L8 6.586 14.293.293a1 1 0 111.414 1.414L9.414 8l6.293 6.293a1 1 0 01-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 01-1.414-1.414L6.586 8 .293 1.707a1 1 0 010-1.414z"/>
          </svg>
        </button>
      </div>
      <div class="toast-body">${message}</div>
    `;

    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    container.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
      this.removeToast(toast);
    }, 5000);
  }

  removeToast(toast) {
    if (!toast || !toast.parentNode) return;

    const container = toast.parentNode;
    const allToasts = Array.from(container.children);
    const toastIndex = allToasts.indexOf(toast);
    const toastsBelow = allToasts.slice(toastIndex + 1);

    // Calculate the height of the toast being removed BEFORE starting animations
    const toastHeight = toast.offsetHeight;
    const toastMargin = 12; // var(--space-3) = 12px from CSS
    const totalHeightRemoved = toastHeight + toastMargin;

    // Start slide-out animation for the toast being removed
    toast.classList.add('animate-slide-out');
    
    // Immediately start slide-up animation for remaining toasts
    toastsBelow.forEach((remainingToast) => {
      remainingToast.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      remainingToast.style.transform = `translateY(-${totalHeightRemoved}px)`;
    });

    // After slide-out animation completes (400ms), remove the toast
    setTimeout(() => {
      toast.remove();
      
      // Reset transforms on remaining toasts after both animations complete
      setTimeout(() => {
        toastsBelow.forEach((remainingToast) => {
          if (remainingToast.parentNode) { // Check toast still exists
            remainingToast.style.transition = '';
            remainingToast.style.transform = '';
          }
        });
      }, 50); // Small delay to ensure DOM is updated

      // Remove container if empty
      if (container.children.length === 0) {
        container.remove();
      }
    }, 400); // Wait for slide-out animation to complete
  }

  loadInitialData() {
    // Simulate loading dashboard data
    this.loadSystemStats();
    this.loadRecentActivity();
    this.loadNotifications();
  }

  loadSystemStats() {
    // Simulate API call
    const stats = {
      totalCalls: 1247,
      activeSessions: 23,
      systemUptime: 99.9,
      responseTime: 142
    };

    this.updateStats(stats);
  }

  updateStats(stats) {
    const updateStat = (selector, value, suffix = '') => {
      const element = document.querySelector(selector);
      if (element) {
        element.textContent = value + suffix;
      }
    };

    updateStat('[data-stat="total-calls"]', stats.totalCalls.toLocaleString());
    updateStat('[data-stat="active-sessions"]', stats.activeSessions);
    updateStat('[data-stat="system-uptime"]', stats.systemUptime, '%');
    updateStat('[data-stat="response-time"]', stats.responseTime, 'ms');
  }

  loadRecentActivity() {
    // Simulate activity feed data
    const activities = [
      {
        user: 'System',
        action: 'Call completed successfully',
        time: '2 minutes ago',
        type: 'success'
      },
      {
        user: 'Admin',
        action: 'Settings updated',
        time: '15 minutes ago',
        type: 'info'
      },
      {
        user: 'System',
        action: 'New user registered',
        time: '1 hour ago',
        type: 'success'
      }
    ];

    this.updateActivityFeed(activities);
  }

  updateActivityFeed(activities) {
    const activityList = document.querySelector('.activity-list');
    if (!activityList) return;

    activityList.innerHTML = activities.map(activity => `
      <div class="activity-item animate-fade-in">
        <div class="avatar avatar-sm">
          ${activity.user.charAt(0)}
        </div>
        <div class="activity-content">
          <div class="activity-text">${activity.action}</div>
          <div class="activity-time">${activity.time}</div>
        </div>
      </div>
    `).join('');
  }

  loadNotifications() {
    // Check for any system notifications
    const hasUpdates = Math.random() > 0.7;
    
    if (hasUpdates) {
      setTimeout(() => {
        this.showToast('System Update', 'A new system update is available', 'info');
      }, 2000);
    }
  }

  // Test method for toast notifications
  testToastPositioning() {
    const types = ['success', 'info', 'warning', 'error'];
    const messages = [
      { title: 'Success', message: 'Operation completed successfully' },
      { title: 'Information', message: 'New updates are available' },
      { title: 'Warning', message: 'Please review your settings' },
      { title: 'Error', message: 'An error occurred' }
    ];
    
    types.forEach((type, index) => {
      setTimeout(() => {
        this.showToast(messages[index].title, messages[index].message, type);
      }, index * 1000);
    });
  }

  resizeCharts() {
    // Placeholder for chart resize logic
    console.log('Resizing charts...');
  }

  initializeDashboardFeatures() {
    // Dashboard-specific initialization
    console.log('🎯 Initializing dashboard-specific features');
    
    // Add keyboard shortcuts for dashboard
    this.bindDashboardKeyboardShortcuts();
    
    // Enable auto-refresh status updates
    this.updateDashboardStatus();
  }

  bindDashboardKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Dashboard-specific shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'r':
            e.preventDefault();
            if (window.dashboardReal && typeof window.dashboardReal.loadAllData === 'function') {
              window.dashboardReal.loadAllData();
              this.showToast('Dashboard Refreshed', 'Data has been updated', 'success');
            }
            break;
        }
      }
    });
  }

  updateDashboardStatus() {
    // Update the real-time status indicator
    const statusElement = document.getElementById('real-time-status');
    if (statusElement) {
      const now = new Date();
      const timeString = now.toLocaleTimeString();
      
      // Update every minute
      setInterval(() => {
        const updateElement = document.getElementById('last-update');
        if (updateElement && window.dashboardReal) {
          const timeSinceUpdate = Math.floor((new Date() - window.dashboardReal.lastUpdate) / 1000);
          if (timeSinceUpdate < 60) {
            updateElement.textContent = 'Just now';
          } else if (timeSinceUpdate < 3600) {
            updateElement.textContent = `${Math.floor(timeSinceUpdate / 60)}m ago`;
          } else {
            updateElement.textContent = `${Math.floor(timeSinceUpdate / 3600)}h ago`;
          }
        }
      }, 60000);
    }
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.adminDashboard = new AdminDashboard();
  
  // Add ripple animation keyframe after DOM is ready
  const style = document.createElement('style');
  style.textContent = `
    @keyframes ripple {
      to {
        transform: scale(4);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
});