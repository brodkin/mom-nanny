/**
 * Memory Management Page - JavaScript functionality
 * 
 * Provides comprehensive memory management interface including:
 * - Statistics display and real-time updates
 * - Memory table with search, filtering, and pagination
 * - Add, edit, and delete memory operations
 * - Modal dialogs for memory management
 * 
 * Integrates with existing admin components and maintains
 * visual consistency with the compassionate care theme.
 */

import { Notification } from './components/components.js';

/**
 * Memory Manager - Main class for handling memory operations
 */
class MemoryManager {
  constructor() {
    this.memories = [];
    this.filteredMemories = [];
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.totalPages = 0;
    this.sortField = 'key';
    this.sortDirection = 'asc';
    this.searchQuery = '';
    this.categoryFilter = '';
    this.stats = {
      totalMemories: 0,
      categoriesUsed: 0,
      lastUpdated: null,
      recentAccess: 0
    };
    
    this.initializeEventListeners();
    this.loadMemoriesAndStats();
    
    // Auto-refresh every 30 seconds
    setInterval(() => this.loadStats(), 30000);
  }

  /**
   * Initialize event listeners for the page
   */
  initializeEventListeners() {
    // Page actions
    document.getElementById('add-memory-btn')?.addEventListener('click', () => this.showAddMemoryModal());
    document.getElementById('add-first-memory')?.addEventListener('click', () => this.showAddMemoryModal());
    document.getElementById('refresh-memories')?.addEventListener('click', () => this.loadMemoriesAndStats());
    document.getElementById('retry-loading')?.addEventListener('click', () => this.loadMemoriesAndStats());

    // Search and filter
    document.getElementById('memory-search')?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.applyFiltersAndSearch();
    });
    
    document.getElementById('category-filter')?.addEventListener('change', (e) => {
      this.categoryFilter = e.target.value;
      this.applyFiltersAndSearch();
    });

    // Pagination
    document.getElementById('prev-page')?.addEventListener('click', () => this.goToPage(this.currentPage - 1));
    document.getElementById('next-page')?.addEventListener('click', () => this.goToPage(this.currentPage + 1));

    // Table sorting
    document.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const field = th.dataset.sort;
        this.sortTable(field);
      });
    });

    // Table action buttons (using event delegation)
    document.getElementById('memory-table-body')?.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button) return;
      
      const row = button.closest('tr');
      const memoryKey = row?.dataset.memoryKey;
      
      if (!memoryKey) return;
      
      if (button.classList.contains('btn-view')) {
        this.viewMemory(memoryKey);
      } else if (button.classList.contains('btn-edit')) {
        this.editMemory(memoryKey);
      } else if (button.classList.contains('btn-delete')) {
        this.deleteMemory(memoryKey);
      }
    });

    // Page number clicks (using event delegation)
    document.getElementById('page-numbers')?.addEventListener('click', (e) => {
      const button = e.target.closest('.page-number');
      if (button && !button.disabled) {
        const page = parseInt(button.dataset.page);
        if (page) this.goToPage(page);
      }
    });
  }

  /**
   * Load memories and statistics from the API
   */
  async loadMemoriesAndStats() {
    try {
      this.showLoadingState();
      
      // Load in parallel for better performance
      const [_memoriesResponse, _statsResponse] = await Promise.all([
        this.loadMemories(),
        this.loadStats()
      ]);
      
      this.hideLoadingState();
      this.applyFiltersAndSearch();
      
    } catch (error) {
      console.error('Error loading memories and stats:', error);
      this.showErrorState();
      Notification.error('Failed to load memory data', {
        description: 'Please try refreshing the page or contact support if the issue persists.',
        duration: 8000
      });
    }
  }

  /**
   * Load memories from the API
   */
  async loadMemories() {
    const response = await fetch('/api/admin/memories?limit=1000'); // Load all for client-side filtering
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    this.memories = data.data.memories || [];
    return data;
  }

  /**
   * Load statistics from the API
   */
  async loadStats() {
    const response = await fetch('/api/admin/memories/stats');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    this.stats = data.data;
    this.updateStatsDisplay();
    return data;
  }

  /**
   * Update statistics display
   */
  updateStatsDisplay() {
    const totalEl = document.getElementById('total-memories');
    const categoriesEl = document.getElementById('memory-categories');
    const lastUpdatedEl = document.getElementById('last-updated');
    const recentAccessEl = document.getElementById('recent-access');

    if (totalEl) totalEl.textContent = this.stats.totalMemories?.toLocaleString() || '0';
    if (categoriesEl) categoriesEl.textContent = this.stats.categoriesUsed || '0';
    
    if (lastUpdatedEl) {
      if (this.stats.lastUpdated) {
        const date = new Date(this.stats.lastUpdated);
        lastUpdatedEl.textContent = this.formatRelativeTime(date);
      } else {
        lastUpdatedEl.textContent = 'Never';
      }
    }
    
    if (recentAccessEl) recentAccessEl.textContent = this.stats.recentAccess || '0';
  }

  /**
   * Apply search and filter to memories
   */
  applyFiltersAndSearch() {
    let filtered = [...this.memories];
    
    // Apply search
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(memory => 
        memory.key.toLowerCase().includes(query) ||
        memory.content.toLowerCase().includes(query) ||
        memory.category.toLowerCase().includes(query)
      );
    }
    
    // Apply category filter
    if (this.categoryFilter) {
      filtered = filtered.filter(memory => memory.category === this.categoryFilter);
    }
    
    this.filteredMemories = filtered;
    this.totalPages = Math.ceil(filtered.length / this.itemsPerPage);
    this.currentPage = Math.min(this.currentPage, Math.max(1, this.totalPages));
    
    this.renderTable();
    this.updatePagination();
  }

  /**
   * Sort table by field
   */
  sortTable(field) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    
    this.filteredMemories.sort((a, b) => {
      let valueA = a[field];
      let valueB = b[field];
      
      // Handle dates
      if (field.includes('date') || field.includes('time') || field === 'last_accessed') {
        valueA = new Date(valueA).getTime() || 0;
        valueB = new Date(valueB).getTime() || 0;
      }
      
      // Handle strings
      if (typeof valueA === 'string') {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }
      
      const comparison = valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
    
    this.updateSortIcons();
    this.renderTable();
  }

  /**
   * Update sort icons in table headers
   */
  updateSortIcons() {
    document.querySelectorAll('th.sortable').forEach(th => {
      const _icon = th.querySelector('.sort-icon');
      th.classList.remove('sorted-asc', 'sorted-desc');
      
      if (th.dataset.sort === this.sortField) {
        th.classList.add(`sorted-${this.sortDirection}`);
      }
    });
  }

  /**
   * Render the memory table
   */
  renderTable() {
    const tbody = document.getElementById('memory-table-body');
    const tableContainer = document.getElementById('memory-table-container');
    const emptyState = document.getElementById('memories-empty');
    
    if (!tbody) return;
    
    // Show empty state if no memories
    if (this.filteredMemories.length === 0) {
      tableContainer.style.display = 'none';
      emptyState.style.display = 'flex';
      document.getElementById('memory-pagination').style.display = 'none';
      return;
    }
    
    // Show table
    tableContainer.style.display = 'block';
    emptyState.style.display = 'none';
    
    // Calculate page items
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageItems = this.filteredMemories.slice(startIndex, endIndex);
    
    // Render rows
    tbody.innerHTML = pageItems.map(memory => `
      <tr data-memory-key="${this.escapeHtml(memory.key)}">
        <td>
          <div class="memory-key" title="${this.escapeHtml(memory.key)}">
            ${this.escapeHtml(memory.key)}
          </div>
        </td>
        <td>
          <span class="category-badge ${memory.category}">
            ${this.escapeHtml(memory.category)}
          </span>
        </td>
        <td>
          <div class="content-preview" title="${this.escapeHtml(memory.content)}">
            ${this.escapeHtml(memory.content)}
          </div>
        </td>
        <td>
          <time datetime="${memory.last_accessed || ''}" title="${memory.last_accessed ? new Date(memory.last_accessed).toLocaleString() : 'Never'}">
            ${memory.last_accessed ? this.formatRelativeTime(new Date(memory.last_accessed)) : 'Never'}
          </time>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-outline btn-sm btn-view" title="View details">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
            </button>
            <button class="btn btn-outline btn-sm btn-edit" title="Edit memory">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            <button class="btn btn-outline btn-sm btn-danger btn-delete" title="Delete memory">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  /**
   * Update pagination controls
   */
  updatePagination() {
    const paginationContainer = document.getElementById('memory-pagination');
    const paginationText = document.getElementById('pagination-text');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageNumbers = document.getElementById('page-numbers');
    
    if (!paginationContainer) return;
    
    // Show/hide pagination
    if (this.filteredMemories.length <= this.itemsPerPage) {
      paginationContainer.style.display = 'none';
      return;
    }
    
    paginationContainer.style.display = 'flex';
    
    // Update pagination text
    const startItem = Math.min((this.currentPage - 1) * this.itemsPerPage + 1, this.filteredMemories.length);
    const endItem = Math.min(this.currentPage * this.itemsPerPage, this.filteredMemories.length);
    
    if (paginationText) {
      paginationText.textContent = `Showing ${startItem}-${endItem} of ${this.filteredMemories.length} memories`;
    }
    
    // Update buttons
    if (prevBtn) {
      prevBtn.disabled = this.currentPage <= 1;
    }
    
    if (nextBtn) {
      nextBtn.disabled = this.currentPage >= this.totalPages;
    }
    
    // Update page numbers
    if (pageNumbers) {
      pageNumbers.innerHTML = this.generatePageNumbers();
    }
  }

  /**
   * Generate page number buttons
   */
  generatePageNumbers() {
    const pages = [];
    const maxVisible = 5;
    
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisible - 1);
    
    // Adjust start if we're near the end
    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === this.currentPage;
      pages.push(`
        <button 
          class="page-number ${isActive ? 'active' : ''}" 
          data-page="${i}"
          ${isActive ? 'disabled' : ''}
        >
          ${i}
        </button>
      `);
    }
    
    return pages.join('');
  }

  /**
   * Go to specific page
   */
  goToPage(page) {
    if (page < 1 || page > this.totalPages) return;
    
    this.currentPage = page;
    this.renderTable();
    this.updatePagination();
  }

  /**
   * Show loading state
   */
  showLoadingState() {
    document.getElementById('memories-loading')?.style.setProperty('display', 'flex');
    document.getElementById('memories-error')?.style.setProperty('display', 'none');
    document.getElementById('memory-table-container')?.style.setProperty('display', 'none');
    document.getElementById('memories-empty')?.style.setProperty('display', 'none');
  }

  /**
   * Hide loading state
   */
  hideLoadingState() {
    document.getElementById('memories-loading')?.style.setProperty('display', 'none');
  }

  /**
   * Show error state
   */
  showErrorState() {
    document.getElementById('memories-loading')?.style.setProperty('display', 'none');
    document.getElementById('memories-error')?.style.setProperty('display', 'flex');
    document.getElementById('memory-table-container')?.style.setProperty('display', 'none');
    document.getElementById('memories-empty')?.style.setProperty('display', 'none');
  }

  /**
   * Show add memory modal
   */
  async showAddMemoryModal() {
    const modal = document.getElementById('memory-modal');
    const form = document.getElementById('memory-form');
    const modalTitle = modal.querySelector('.modal-title');
    const submitBtn = modal.querySelector('.submit-btn .btn-text');
    
    // Reset form and modal
    form.reset();
    modalTitle.textContent = 'Add Memory';
    submitBtn.textContent = 'Save Memory';
    
    // Clear any previous errors
    this.clearFormErrors();
    
    // Show modal
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    
    // Focus first input
    setTimeout(() => {
      document.getElementById('memory-key').focus();
    }, 100);
    
    // Setup event listeners if not already done
    this.setupModalEventListeners();
  }

  /**
   * Setup modal event listeners
   */
  setupModalEventListeners() {
    const modal = document.getElementById('memory-modal');
    const form = document.getElementById('memory-form');
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('[data-action="cancel"]');
    const overlay = modal.querySelector('.modal-overlay');
    
    // Close modal events
    const closeModal = () => {
      modal.style.display = 'none';
      document.body.classList.remove('modal-open');
    };
    
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);
    
    // Form submit
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAddMemory();
    });
    
    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        closeModal();
      }
    });
  }

  /**
   * Setup view modal event listeners
   */
  setupViewModalEventListeners(memoryKey) {
    const modal = document.getElementById('view-memory-modal');
    const closeBtn = modal.querySelector('.modal-close');
    const editBtn = modal.querySelector('[data-action="edit"]');
    const closeFooterBtn = modal.querySelector('[data-action="close"]');
    const overlay = modal.querySelector('.modal-overlay');
    
    // Close modal function
    const closeModal = () => {
      modal.style.display = 'none';
      document.body.classList.remove('modal-open');
    };
    
    // Remove existing listeners to prevent duplicates
    const newCloseBtn = closeBtn.cloneNode(true);
    const newEditBtn = editBtn.cloneNode(true);
    const newCloseFooterBtn = closeFooterBtn.cloneNode(true);
    const newOverlay = overlay.cloneNode(true);
    
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
    editBtn.parentNode.replaceChild(newEditBtn, editBtn);
    closeFooterBtn.parentNode.replaceChild(newCloseFooterBtn, closeFooterBtn);
    overlay.parentNode.replaceChild(newOverlay, overlay);
    
    // Add event listeners
    newCloseBtn.addEventListener('click', closeModal);
    newCloseFooterBtn.addEventListener('click', closeModal);
    newOverlay.addEventListener('click', closeModal);
    
    // Edit button
    newEditBtn.addEventListener('click', () => {
      closeModal();
      this.editMemory(memoryKey);
    });
    
    // Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  /**
   * Clear form validation errors
   */
  clearFormErrors() {
    const errorElements = document.querySelectorAll('.form-error');
    const inputElements = document.querySelectorAll('.form-input, .form-textarea, .form-select');
    
    errorElements.forEach(el => {
      el.style.display = 'none';
      el.textContent = '';
    });
    
    inputElements.forEach(el => {
      el.classList.remove('error');
    });
  }

  /**
   * Handle add memory form submission
   */
  async handleAddMemory() {
    const form = document.getElementById('memory-form');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    
    const key = document.getElementById('memory-key').value.trim();
    const category = document.getElementById('memory-category').value;
    const content = document.getElementById('memory-content').value.trim();
    
    try {
      const response = await fetch('/api/admin/memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key, category, content })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add memory');
      }
      
      // Close modal
      const modal = document.getElementById('memory-modal');
      modal.style.display = 'none';
      document.body.classList.remove('modal-open');
      
      Notification.success('Memory added successfully', {
        description: `Added "${key}" to the memory system`
      });
      
      this.loadMemoriesAndStats();
      
    } catch (error) {
      console.error('Error adding memory:', error);
      Notification.error('Failed to add memory', {
        description: error.message
      });
    }
  }

  /**
   * View memory details
   */
  async viewMemory(key) {
    try {
      const response = await fetch(`/api/admin/memories/${encodeURIComponent(key)}`);
      
      if (!response.ok) {
        throw new Error('Failed to load memory details');
      }
      
      const data = await response.json();
      const memory = data.data;
      
      // Get the view modal elements
      const modal = document.getElementById('view-memory-modal');
      const modalTitle = modal.querySelector('.modal-title');
      const contentContainer = document.getElementById('view-memory-content');
      
      // Update modal title
      modalTitle.textContent = `Memory: ${memory.key}`;
      
      // Update modal content
      contentContainer.innerHTML = `
        <div class="detail-group">
          <label class="detail-label">Key</label>
          <div class="detail-value">${this.escapeHtml(memory.key)}</div>
        </div>
        
        <div class="detail-group">
          <label class="detail-label">Category</label>
          <div class="detail-value">
            <span class="category-badge ${memory.category}">
              ${this.escapeHtml(memory.category)}
            </span>
          </div>
        </div>
        
        <div class="detail-group">
          <label class="detail-label">Content</label>
          <div class="detail-value">${this.escapeHtml(memory.content)}</div>
        </div>
        
        <div class="detail-group">
          <label class="detail-label">Created</label>
          <div class="detail-value">${new Date(memory.created_at).toLocaleString()}</div>
        </div>
        
        <div class="detail-group">
          <label class="detail-label">Last Updated</label>
          <div class="detail-value">${memory.updated_at ? new Date(memory.updated_at).toLocaleString() : 'Never'}</div>
        </div>
        
        <div class="detail-group">
          <label class="detail-label">Last Accessed</label>
          <div class="detail-value">${memory.last_accessed ? new Date(memory.last_accessed).toLocaleString() : 'Never'}</div>
        </div>
      `;
      
      // Show modal
      modal.style.display = 'flex';
      document.body.classList.add('modal-open');
      
      // Setup event listeners for this modal
      this.setupViewModalEventListeners(key);
      
    } catch (error) {
      console.error('Error viewing memory:', error);
      Notification.error('Failed to load memory details', {
        description: error.message
      });
    }
  }

  /**
   * Edit memory
   */
  async editMemory(key) {
    try {
      const response = await fetch(`/api/admin/memories/${encodeURIComponent(key)}`);
      
      if (!response.ok) {
        throw new Error('Failed to load memory for editing');
      }
      
      const data = await response.json();
      const memory = data.data;
      
      // Get the modal elements
      const modal = document.getElementById('edit-memory-modal');
      const modalTitle = modal.querySelector('.modal-title');
      const keyInput = document.getElementById('edit-memory-key');
      const categorySelect = document.getElementById('edit-memory-category');
      const contentTextarea = document.getElementById('edit-memory-content');
      
      // Populate the modal with memory data
      modalTitle.textContent = `Edit Memory: ${memory.key}`;
      keyInput.value = memory.key;
      categorySelect.value = memory.category || '';
      contentTextarea.value = memory.content || '';
      
      // Setup event listeners for this modal
      this.setupEditModalEventListeners(key);
      
      // Show the modal
      modal.style.display = 'flex';
      document.body.classList.add('modal-open');
      
    } catch (error) {
      console.error('Error loading memory for editing:', error);
      Notification.error('Failed to load memory for editing', {
        description: error.message
      });
    }
  }

  setupEditModalEventListeners(originalKey) {
    const modal = document.getElementById('edit-memory-modal');
    const overlay = modal.querySelector('.modal-overlay');
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('[data-action="cancel"]');
    const saveBtn = modal.querySelector('[data-action="save"]');
    
    // Close modal function
    const closeModal = () => {
      modal.style.display = 'none';
      document.body.classList.remove('modal-open');
      // Clean up event listeners by replacing elements
      const newOverlay = overlay.cloneNode(true);
      const newCloseBtn = closeBtn.cloneNode(true);
      const newCancelBtn = cancelBtn.cloneNode(true);
      const newSaveBtn = saveBtn.cloneNode(true);
      
      overlay.parentNode.replaceChild(newOverlay, overlay);
      closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
      cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
      saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    };
    
    // Event listeners
    overlay.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    saveBtn.addEventListener('click', () => this.handleEditMemory(originalKey));
    
    // Escape key handler
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  /**
   * Handle edit memory form submission
   */
  async handleEditMemory(key) {
    const form = document.getElementById('edit-memory-form');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    
    const category = document.getElementById('edit-memory-category').value;
    const content = document.getElementById('edit-memory-content').value.trim();
    
    try {
      const response = await fetch(`/api/admin/memories/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ category, content })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update memory');
      }
      
      // Close the HTML modal
      const modal = document.getElementById('edit-memory-modal');
      modal.style.display = 'none';
      document.body.classList.remove('modal-open');
      
      Notification.success('Memory updated successfully', {
        description: `Updated "${key}" in the memory system`
      });
      
      this.loadMemoriesAndStats();
      
    } catch (error) {
      console.error('Error updating memory:', error);
      Notification.error('Failed to update memory', {
        description: error.message
      });
    }
  }

  /**
   * Delete memory with confirmation
   */
  async deleteMemory(key) {
    const confirmed = confirm(`Are you sure you want to delete the memory "${key}"? This action cannot be undone. The AI will no longer have access to this information.`);
    
    if (!confirmed) return;
    
    try {
      const response = await fetch(`/api/admin/memories/${encodeURIComponent(key)}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete memory');
      }
      
      Notification.success('Memory deleted successfully', {
        description: `Removed "${key}" from the memory system`
      });
      
      this.loadMemoriesAndStats();
      
    } catch (error) {
      console.error('Error deleting memory:', error);
      Notification.error('Failed to delete memory', {
        description: error.message
      });
    }
  }

  /**
   * Format relative time
   */
  formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSeconds < 60) return 'Just now';
    if (diffMinutes === 1) return '1 minute ago';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize memory manager when DOM is ready
let memoryManager;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    memoryManager = new MemoryManager();
  });
} else {
  memoryManager = new MemoryManager();
}

// Export for global access
window.memoryManager = memoryManager;

export default MemoryManager;