/**
 * Data Table Component - Sortable, paginated table with search and export functionality
 * 
 * @class DataTable
 * @extends EventTarget
 * 
 * @example
 * const table = new DataTable({
 *   columns: [
 *     { key: 'name', title: 'Name', sortable: true },
 *     { key: 'email', title: 'Email', sortable: true },
 *     { key: 'status', title: 'Status', sortable: false }
 *   ],
 *   data: [
 *     { name: 'John Doe', email: 'john@example.com', status: 'Active' },
 *     { name: 'Jane Smith', email: 'jane@example.com', status: 'Inactive' }
 *   ],
 *   pagination: true,
 *   pageSize: 10,
 *   searchable: true,
 *   selectable: true,
 *   exportable: true
 * });
 * 
 * table.on('rowSelect', (e) => {
 *   console.log('Selected rows:', e.detail.selectedRows);
 * });
 * 
 * document.body.appendChild(table.element);
 */
export class DataTable extends EventTarget {
  /**
   * Create a DataTable instance
   * @param {Object} options - Table configuration options
   * @param {Array} options.columns - Column definitions
   * @param {Array} [options.data=[]] - Table data
   * @param {boolean} [options.pagination=true] - Enable pagination
   * @param {number} [options.pageSize=10] - Items per page
   * @param {boolean} [options.searchable=true] - Enable search
   * @param {boolean} [options.selectable=false] - Enable row selection
   * @param {boolean} [options.exportable=false] - Enable CSV export
   * @param {string} [options.className=''] - Additional CSS classes
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      columns: [],
      data: [],
      pagination: true,
      pageSize: 10,
      searchable: true,
      selectable: false,
      exportable: false,
      className: '',
      ...options
    };
    
    this.originalData = [...this.options.data];
    this.filteredData = [...this.options.data];
    this.selectedRows = new Set();
    this.currentPage = 1;
    this.sortColumn = null;
    this.sortDirection = 'asc';
    this.searchTerm = '';
    
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
    container.className = `data-table ${this.options.className}`.trim();
    
    container.innerHTML = `
      <div class="table-toolbar">
        ${this.options.searchable ? `
          <div class="table-search">
            <input type="text" class="search-input" placeholder="Search..." />
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </div>
        ` : ''}
        <div class="table-actions">
          ${this.options.selectable ? '<button class="btn btn-outline clear-selection-btn" style="display: none;">Clear Selection</button>' : ''}
        </div>
      </div>
      
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              ${this.options.selectable ? '<th class="select-column"><input type="checkbox" class="select-all" /></th>' : ''}
              ${this.options.columns.map(col => `
                <th class="${col.sortable !== false ? 'sortable' : ''}" data-key="${col.key}">
                  ${col.title}
                  ${col.sortable !== false ? '<span class="sort-indicator"></span>' : ''}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody class="table-body">
          </tbody>
        </table>
      </div>
      
      ${this.options.pagination ? `
        <div class="table-pagination">
          <div class="pagination-info" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="current-range"></span>
              <select class="page-size-select">
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
              </select>
            </div>
            ${this.options.exportable ? '<button class="btn btn-outline export-btn">Export CSV</button>' : ''}
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
    // Search
    const searchInput = this.element.querySelector('.search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.setSearch(e.target.value);
      });
    }
    
    // Sort
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
      
      const clearBtn = this.element.querySelector('.clear-selection-btn');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => this.clearSelection());
      }
    }
    
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
    
    // Export
    const exportBtn = this.element.querySelector('.export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportCSV());
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
    const startIndex = this.options.pagination ? (this.currentPage - 1) * this.options.pageSize : 0;
    const endIndex = this.options.pagination ? startIndex + this.options.pageSize : this.filteredData.length;
    const pageData = this.filteredData.slice(startIndex, endIndex);
    
    tbody.innerHTML = pageData.map((row, index) => {
      const actualIndex = startIndex + index;
      const isSelected = this.selectedRows.has(actualIndex);
      
      return `
        <tr class="${isSelected ? 'selected' : ''}">
          ${this.options.selectable ? `<td class="select-column"><input type="checkbox" class="row-select" data-index="${actualIndex}" ${isSelected ? 'checked' : ''} /></td>` : ''}
          ${this.options.columns.map(col => `<td>${this.formatCellValue(row[col.key], col, row)}</td>`).join('')}
        </tr>
      `;
    }).join('');
  }

  /**
   * Format cell value
   * @private
   * @param {*} value - Cell value
   * @param {Object} column - Column definition
   * @returns {string} Formatted value
   */
  formatCellValue(value, column, row) {
    if (column.formatter && typeof column.formatter === 'function') {
      return column.formatter(value, row);
    }
    return value != null ? String(value) : '';
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
   * Set search term and filter data
   * @param {string} term - Search term
   */
  setSearch(term) {
    this.searchTerm = term.toLowerCase();
    this.applyFilters();
    this.currentPage = 1;
    this.render();
    
    this.dispatchEvent(new CustomEvent('search', {
      detail: { term: this.searchTerm, resultCount: this.filteredData.length }
    }));
  }

  /**
   * Apply search filters
   * @private
   */
  applyFilters() {
    if (!this.searchTerm) {
      this.filteredData = [...this.originalData];
      return;
    }
    
    this.filteredData = this.originalData.filter(row => {
      return this.options.columns.some(col => {
        const value = row[col.key];
        return value != null && String(value).toLowerCase().includes(this.searchTerm);
      });
    });
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
      
      // Convert to strings for comparison
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
      detail: { selectedRows: Array.from(this.selectedRows) }
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
      detail: { selectedRows: Array.from(this.selectedRows) }
    }));
  }

  /**
   * Clear all selections
   */
  clearSelection() {
    this.selectedRows.clear();
    this.updateSelectionUI();
    this.dispatchEvent(new CustomEvent('rowSelect', {
      detail: { selectedRows: [] }
    }));
  }

  /**
   * Update selection UI
   * @private
   */
  updateSelectionUI() {
    const selectAllCheckbox = this.element.querySelector('.select-all');
    const rowCheckboxes = this.element.querySelectorAll('.row-select');
    const clearBtn = this.element.querySelector('.clear-selection-btn');
    
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
    
    // Update clear button
    if (clearBtn) {
      clearBtn.style.display = this.selectedRows.size > 0 ? 'block' : 'none';
    }
    
    // Update row styling
    this.renderRows();
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
   * Set table data
   * @param {Array} data - New table data
   */
  setData(data) {
    this.originalData = [...data];
    this.applyFilters();
    this.selectedRows.clear();
    this.currentPage = 1;
    this.render();
  }

  /**
   * Export table data to CSV
   */
  exportCSV() {
    const headers = this.options.columns.map(col => col.title);
    const rows = this.filteredData.map(row => 
      this.options.columns.map(col => {
        const value = row[col.key];
        return value != null ? String(value).replace(/"/g, '""') : '';
      })
    );
    
    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'table-export.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    
    this.dispatchEvent(new CustomEvent('export', {
      detail: { format: 'csv', rowCount: this.filteredData.length }
    }));
  }

  /**
   * Get selected row data
   * @returns {Array} Selected row data
   */
  getSelectedData() {
    return Array.from(this.selectedRows).map(index => this.filteredData[index]);
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

export default DataTable;