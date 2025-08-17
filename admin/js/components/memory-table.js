/**
 * Memory Table Component - Reusable table component for memory management
 * 
 * @class MemoryTable
 * @extends EventTarget
 * 
 * @example
 * const memoryTable = new MemoryTable({
 *   data: memoriesArray,
 *   selectable: true,
 *   onEdit: (memory) => console.log('Edit:', memory),
 *   onDelete: (memory) => console.log('Delete:', memory)
 * });
 * 
 * memoryTable.on('rowSelect', (e) => {
 *   console.log('Selected memories:', e.detail.selectedMemories);
 * });
 * 
 * document.getElementById('memory-container').appendChild(memoryTable.element);
 */
export class MemoryTable extends EventTarget {
  /**
   * Create a MemoryTable instance
   * @param {Object} options - Table configuration options
   * @param {Array} [options.data=[]] - Memory data array
   * @param {boolean} [options.selectable=false] - Enable row selection
   * @param {boolean} [options.pagination=true] - Enable pagination
   * @param {number} [options.pageSize=10] - Items per page
   * @param {Function} [options.onEdit] - Edit callback function
   * @param {Function} [options.onDelete] - Delete callback function
   * @param {string} [options.className=''] - Additional CSS classes
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      data: [],
      selectable: false,
      pagination: true,
      pageSize: 10,
      onEdit: null,
      onDelete: null,
      className: '',
      ...options
    };
    
    this.originalData = [...this.options.data];
    this.filteredData = [...this.options.data];
    this.selectedRows = new Set();
    this.currentPage = 1;
    this.sortColumn = 'updated_at';
    this.sortDirection = 'desc';
    
    this.element = this.createElement();
    this.bindEvents();
    this.render();
  }

  /**
   * Create the table DOM element
   * @private
   * @returns {HTMLElement} The table container element
   */
  createElement() {
    const container = document.createElement('div');
    container.className = `memory-table ${this.options.className}`.trim();
    
    container.innerHTML = `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              ${this.options.selectable ? '<th class="select-column"><input type="checkbox" class="select-all" /></th>' : ''}
              <th class="sortable" data-key="key">
                Memory Key
                <span class="sort-indicator"></span>
              </th>
              <th class="sortable" data-key="category">
                Category
                <span class="sort-indicator"></span>
              </th>
              <th class="sortable" data-key="updated_at">
                Updated
                <span class="sort-indicator sort-desc"></span>
              </th>
              <th class="actions-column">Actions</th>
            </tr>
          </thead>
          <tbody class="table-body">
          </tbody>
        </table>
      </div>
      
      ${this.options.pagination ? `
        <div class="table-pagination">
          <div class="pagination-info">
            <span class="current-range"></span>
            <select class="page-size-select">
              <option value="10">10 per page</option>
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
            </select>
          </div>
          <div class="pagination-controls">
            <button class="page-btn" data-action="first">First</button>
            <button class="page-btn" data-action="prev">Previous</button>
            <span class="page-numbers"></span>
            <button class="page-btn" data-action="next">Next</button>
            <button class="page-btn" data-action="last">Last</button>
          </div>
        </div>
      ` : ''}
    `;
    
    return container;
  }

  /**
   * Bind event listeners
   * @private
   */
  bindEvents() {
    // Sort functionality
    this.element.addEventListener('click', (e) => {
      const th = e.target.closest('th.sortable');
      if (th) {
        const key = th.dataset.key;
        this.sort(key);
      }
    });
    
    // Row selection
    if (this.options.selectable) {
      this.element.addEventListener('change', (e) => {
        if (e.target.classList.contains('select-all')) {
          this.selectAll(e.target.checked);
        } else if (e.target.classList.contains('row-select')) {
          this.selectRow(e.target.dataset.index, e.target.checked);
        }
      });
    }
    
    // Action buttons
    this.element.addEventListener('click', (e) => {
      const btn = e.target.closest('.action-btn');
      if (btn) {
        const action = btn.dataset.action;
        const index = parseInt(btn.dataset.index);
        const memory = this.getCurrentPageData()[index];
        
        if (action === 'edit' && this.options.onEdit) {
          this.options.onEdit(memory);
        } else if (action === 'delete' && this.options.onDelete) {
          this.options.onDelete(memory);
        }
        
        // Emit custom event
        this.dispatchEvent(new CustomEvent(action, {
          detail: { memory, index }
        }));
      }
    });
    
    // Pagination
    if (this.options.pagination) {
      this.element.addEventListener('click', (e) => {
        const btn = e.target.closest('.page-btn');
        if (btn) {
          const action = btn.dataset.action;
          this.handlePaginationAction(action, btn.dataset.page);
        }
      });
      
      const pageSizeSelect = this.element.querySelector('.page-size-select');
      if (pageSizeSelect) {
        pageSizeSelect.value = this.options.pageSize;
        pageSizeSelect.addEventListener('change', (e) => {
          this.setPageSize(parseInt(e.target.value));
        });
      }
    }
  }

  /**
   * Render the table
   * @private
   */
  render() {
    this.renderRows();
    if (this.options.pagination) {
      this.renderPagination();
    }
  }

  /**
   * Render table rows
   * @private
   */
  renderRows() {
    const tbody = this.element.querySelector('.table-body');
    const pageData = this.getCurrentPageData();
    
    tbody.innerHTML = pageData.map((memory, index) => {
      const actualIndex = this.getActualIndex(index);
      const isSelected = this.selectedRows.has(actualIndex);
      
      return `
        <tr class="${isSelected ? 'selected' : ''}" data-memory-id="${memory.id}">
          ${this.options.selectable ? `
            <td class="select-column">
              <input type="checkbox" class="row-select" data-index="${actualIndex}" ${isSelected ? 'checked' : ''} />
            </td>
          ` : ''}
          <td class="memory-key">
            <div class="key-content">
              <span class="key-text">${this.escapeHtml(memory.key)}</span>
              <div class="content-preview">${this.escapeHtml(this.truncateText(memory.content, 100))}</div>
            </div>
          </td>
          <td class="memory-category">
            <span class="category-badge category-${memory.category}">${this.formatCategory(memory.category)}</span>
          </td>
          <td class="memory-updated">
            ${this.formatDate(memory.updated_at)}
          </td>
          <td class="actions-column">
            <div class="action-buttons">
              <button class="action-btn btn-icon" data-action="edit" data-index="${index}" title="Edit memory">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                </svg>
              </button>
              <button class="action-btn btn-icon" data-action="delete" data-index="${index}" title="Delete memory">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Get current page data
   * @private
   * @returns {Array} Current page data
   */
  getCurrentPageData() {
    if (!this.options.pagination) {
      return this.filteredData;
    }
    
    const startIndex = (this.currentPage - 1) * this.options.pageSize;
    const endIndex = startIndex + this.options.pageSize;
    return this.filteredData.slice(startIndex, endIndex);
  }

  /**
   * Get actual index in filtered data
   * @private
   * @param {number} pageIndex - Index within current page
   * @returns {number} Actual index in filtered data
   */
  getActualIndex(pageIndex) {
    if (!this.options.pagination) {
      return pageIndex;
    }
    return (this.currentPage - 1) * this.options.pageSize + pageIndex;
  }

  /**
   * Sort table by column
   * @param {string} key - Column key to sort by
   */
  sort(key) {
    if (this.sortColumn === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = key;
      this.sortDirection = 'asc';
    }
    
    this.filteredData.sort((a, b) => {
      let aVal = a[key];
      let bVal = b[key];
      
      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      // Special handling for dates
      if (key === 'updated_at' || key === 'created_at') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
        const result = aVal - bVal;
        return this.sortDirection === 'asc' ? result : -result;
      }
      
      // String comparison
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
      
      const result = aVal.localeCompare(bVal);
      return this.sortDirection === 'asc' ? result : -result;
    });
    
    this.updateSortIndicators();
    this.currentPage = 1;
    this.render();
    
    this.dispatchEvent(new CustomEvent('sort', {
      detail: { column: key, direction: this.sortDirection }
    }));
  }

  /**
   * Update sort indicators
   * @private
   */
  updateSortIndicators() {
    this.element.querySelectorAll('.sort-indicator').forEach(indicator => {
      const th = indicator.closest('th');
      const key = th.dataset.key;
      
      indicator.className = 'sort-indicator';
      if (key === this.sortColumn) {
        indicator.className += ` sort-${this.sortDirection}`;
      }
    });
  }

  /**
   * Handle pagination actions
   * @private
   * @param {string} action - Pagination action
   * @param {string} [page] - Page number for page action
   */
  handlePaginationAction(action, page) {
    const totalPages = Math.ceil(this.filteredData.length / this.options.pageSize);
    
    switch (action) {
      case 'first':
        this.currentPage = 1;
        break;
      case 'prev':
        this.currentPage = Math.max(1, this.currentPage - 1);
        break;
      case 'next':
        this.currentPage = Math.min(totalPages, this.currentPage + 1);
        break;
      case 'last':
        this.currentPage = totalPages;
        break;
      case 'page':
        this.currentPage = parseInt(page);
        break;
    }
    
    this.render();
    this.dispatchEvent(new CustomEvent('pageChange', {
      detail: { page: this.currentPage, totalPages }
    }));
  }

  /**
   * Render pagination controls
   * @private
   */
  renderPagination() {
    const totalPages = Math.ceil(this.filteredData.length / this.options.pageSize);
    const startItem = (this.currentPage - 1) * this.options.pageSize + 1;
    const endItem = Math.min(this.currentPage * this.options.pageSize, this.filteredData.length);
    
    // Update info
    const rangeSpan = this.element.querySelector('.current-range');
    if (rangeSpan) {
      rangeSpan.textContent = `${startItem}-${endItem} of ${this.filteredData.length}`;
    }
    
    // Update page numbers
    const pageNumbers = this.element.querySelector('.page-numbers');
    if (pageNumbers) {
      pageNumbers.innerHTML = this.generatePageNumbers(totalPages);
    }
    
    // Update button states
    const firstBtn = this.element.querySelector('[data-action="first"]');
    const prevBtn = this.element.querySelector('[data-action="prev"]');
    const nextBtn = this.element.querySelector('[data-action="next"]');
    const lastBtn = this.element.querySelector('[data-action="last"]');
    
    if (firstBtn) firstBtn.disabled = this.currentPage === 1;
    if (prevBtn) prevBtn.disabled = this.currentPage === 1;
    if (nextBtn) nextBtn.disabled = this.currentPage === totalPages;
    if (lastBtn) lastBtn.disabled = this.currentPage === totalPages;
  }

  /**
   * Generate page number buttons
   * @private
   * @param {number} totalPages - Total number of pages
   * @returns {string} HTML for page numbers
   */
  generatePageNumbers(totalPages) {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(`
        <button class="page-btn ${i === this.currentPage ? 'active' : ''}" data-action="page" data-page="${i}">
          ${i}
        </button>
      `);
    }
    
    return pages.join('');
  }

  /**
   * Select/deselect all rows
   * @param {boolean} selected - Whether to select all rows
   */
  selectAll(selected) {
    if (selected) {
      for (let i = 0; i < this.filteredData.length; i++) {
        this.selectedRows.add(i);
      }
    } else {
      this.selectedRows.clear();
    }
    
    this.updateSelectionUI();
    this.dispatchEvent(new CustomEvent('rowSelect', {
      detail: { selectedMemories: this.getSelectedMemories() }
    }));
  }

  /**
   * Select/deselect a row
   * @param {number} index - Row index
   * @param {boolean} selected - Whether row is selected
   */
  selectRow(index, selected) {
    if (selected) {
      this.selectedRows.add(parseInt(index));
    } else {
      this.selectedRows.delete(parseInt(index));
    }
    
    this.updateSelectionUI();
    this.dispatchEvent(new CustomEvent('rowSelect', {
      detail: { selectedMemories: this.getSelectedMemories() }
    }));
  }

  /**
   * Update selection UI
   * @private
   */
  updateSelectionUI() {
    const selectAllCheckbox = this.element.querySelector('.select-all');
    const rowCheckboxes = this.element.querySelectorAll('.row-select');
    
    // Update checkboxes
    rowCheckboxes.forEach(checkbox => {
      const index = parseInt(checkbox.dataset.index);
      checkbox.checked = this.selectedRows.has(index);
    });
    
    // Update select all checkbox
    if (selectAllCheckbox) {
      const totalVisible = this.filteredData.length;
      const selectedVisible = Array.from(this.selectedRows).filter(index => index < totalVisible).length;
      
      selectAllCheckbox.checked = selectedVisible === totalVisible && totalVisible > 0;
      selectAllCheckbox.indeterminate = selectedVisible > 0 && selectedVisible < totalVisible;
    }
    
    // Update row styling
    this.renderRows();
  }

  /**
   * Get selected memory data
   * @returns {Array} Selected memory data
   */
  getSelectedMemories() {
    return Array.from(this.selectedRows).map(index => this.filteredData[index]).filter(Boolean);
  }

  /**
   * Set table data
   * @param {Array} data - New memory data
   */
  setData(data) {
    this.originalData = [...data];
    this.filteredData = [...data];
    this.selectedRows.clear();
    this.currentPage = 1;
    this.render();
  }

  /**
   * Filter data by search term and category
   * @param {string} searchTerm - Search term
   * @param {string} [category] - Category filter
   */
  filter(searchTerm = '', category = '') {
    this.filteredData = this.originalData.filter(memory => {
      const matchesSearch = !searchTerm || 
        memory.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memory.content.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = !category || memory.category === category;
      
      return matchesSearch && matchesCategory;
    });
    
    this.currentPage = 1;
    this.selectedRows.clear();
    this.render();
    
    this.dispatchEvent(new CustomEvent('filter', {
      detail: { searchTerm, category, resultCount: this.filteredData.length }
    }));
  }

  /**
   * Set page size
   * @param {number} size - New page size
   */
  setPageSize(size) {
    this.options.pageSize = size;
    this.currentPage = 1;
    this.render();
  }

  /**
   * Format category for display
   * @private
   * @param {string} category - Category value
   * @returns {string} Formatted category
   */
  formatCategory(category) {
    return category.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  /**
   * Format date for display
   * @private
   * @param {string} dateString - Date string
   * @returns {string} Formatted date
   */
  formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Truncate text to specified length
   * @private
   * @param {string} text - Text to truncate
   * @param {number} length - Maximum length
   * @returns {string} Truncated text
   */
  truncateText(text, length) {
    if (!text || text.length <= length) return text;
    return text.substring(0, length) + '...';
  }

  /**
   * Escape HTML characters
   * @private
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (!text) return '';
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
   * Destroy the table and clean up
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

export default MemoryTable;