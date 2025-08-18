/**
 * Memory Management Components - Reusable components for memory management
 * 
 * This module exports all memory-related components for easy importing:
 * - MemoryTable: Sortable, paginated table for displaying memories
 * - MemoryModal: Modal dialog for creating and editing memories
 * - MemoryFilters: Filter bar with search and category filtering
 * - CategoryBadge: Color-coded badges for memory categories
 * 
 * @example
 * // Import individual components
 * import { MemoryTable, MemoryModal } from './memory-components.js';
 * 
 * // Or import all components
 * import * as MemoryComponents from './memory-components.js';
 * 
 * // Create a complete memory management interface
 * const memoryManager = new MemoryComponents.MemoryManager({
 *   container: document.getElementById('memory-container'),
 *   apiEndpoint: '/api/memories'
 * });
 */

import { MemoryTable } from './memory-table.js';
import { MemoryModal } from './memory-modal.js';
import { MemoryFilters } from './memory-filters.js';
import { CategoryBadge } from './category-badge.js';

/**
 * Memory Manager - Complete memory management interface
 * Orchestrates all memory components to provide a full-featured interface
 * 
 * @class MemoryManager
 * @extends EventTarget
 */
export class MemoryManager extends EventTarget {
  /**
   * Create a MemoryManager instance
   * @param {Object} options - Configuration options
   * @param {HTMLElement} options.container - Container element
   * @param {string} [options.apiEndpoint='/api/memories'] - API endpoint for memory operations
   * @param {boolean} [options.selectable=true] - Enable memory selection
   * @param {number} [options.pageSize=10] - Default page size
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      apiEndpoint: '/api/memories',
      selectable: true,
      pageSize: 10,
      ...options
    };
    
    if (!this.options.container) {
      throw new Error('Container element is required');
    }
    
    this.container = this.options.container;
    this.memories = [];
    this.isLoading = false;
    
    this.initializeComponents();
    this.bindEvents();
    this.render();
    
    // Load initial data
    this.loadMemories();
  }

  /**
   * Initialize all components
   * @private
   */
  initializeComponents() {
    // Create filters component
    this.filters = new MemoryFilters({
      categories: ['family', 'health', 'preferences', 'topics_to_avoid', 'general'],
      placeholder: 'Search memories by key or content...'
    });
    
    // Create table component
    this.table = new MemoryTable({
      selectable: this.options.selectable,
      pageSize: this.options.pageSize,
      onEdit: (memory) => this.editMemory(memory),
      onDelete: (memory) => this.deleteMemory(memory)
    });
    
    // Create modal component
    this.modal = new MemoryModal();
  }

  /**
   * Bind component events
   * @private
   */
  bindEvents() {
    // Filter events
    this.filters.on('filter', (e) => {
      const { searchTerm, selectedCategories } = e.detail;
      this.filterMemories(searchTerm, selectedCategories);
    });
    
    // Table events
    this.table.on('rowSelect', (e) => {
      this.dispatchEvent(new CustomEvent('selectionChange', {
        detail: { selectedMemories: e.detail.selectedMemories }
      }));
    });
    
    this.table.on('edit', (e) => {
      this.editMemory(e.detail.memory);
    });
    
    this.table.on('delete', (e) => {
      this.deleteMemory(e.detail.memory);
    });
    
    // Modal events
    this.modal.on('save', (e) => {
      this.saveMemory(e.detail.memory, e.detail.isEdit);
    });
  }

  /**
   * Render the complete interface
   * @private
   */
  render() {
    this.container.innerHTML = `
      <div class="memory-manager">
        <div class="memory-header">
          <div class="header-content">
            <h2 class="memory-title">Memory Management</h2>
            <div class="header-actions">
              <button class="btn btn-primary add-memory-btn">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                Add Memory
              </button>
            </div>
          </div>
        </div>
        
        <div class="memory-filters-container"></div>
        
        <div class="memory-content">
          <div class="memory-table-container"></div>
        </div>
        
        <div class="memory-loading" style="display: none;">
          <div class="loading-spinner">
            <svg class="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
            <span>Loading memories...</span>
          </div>
        </div>
      </div>
    `;
    
    // Append components
    const filtersContainer = this.container.querySelector('.memory-filters-container');
    const tableContainer = this.container.querySelector('.memory-table-container');
    
    filtersContainer.appendChild(this.filters.element);
    tableContainer.appendChild(this.table.element);
    
    // Bind header actions
    const addBtn = this.container.querySelector('.add-memory-btn');
    addBtn.addEventListener('click', () => this.addMemory());
  }

  /**
   * Load memories from API
   * @private
   */
  async loadMemories() {
    this.setLoading(true);
    
    try {
      const response = await fetch(this.options.apiEndpoint);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      this.memories = await response.json();
      this.updateComponents();
      
      this.dispatchEvent(new CustomEvent('memoriesLoaded', {
        detail: { memories: this.memories }
      }));
    } catch (error) {
      console.error('Failed to load memories:', error);
      this.showError('Failed to load memories. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Filter memories based on search and categories
   * @private
   * @param {string} searchTerm - Search term
   * @param {Array} selectedCategories - Selected categories
   */
  filterMemories(searchTerm, selectedCategories) {
    this.table.filter(searchTerm, selectedCategories.length === 1 ? selectedCategories[0] : '');
    
    // Update filter counts
    const categoryCounts = this.calculateCategoryCounts();
    this.filters.setCategoryCounts(categoryCounts);
    
    // Update result count
    const filteredCount = this.table.filteredData.length;
    this.filters.setResultCount(filteredCount, this.memories.length);
  }

  /**
   * Calculate category counts
   * @private
   * @returns {Object} Category counts
   */
  calculateCategoryCounts() {
    const counts = {};
    this.memories.forEach(memory => {
      counts[memory.category] = (counts[memory.category] || 0) + 1;
    });
    return counts;
  }

  /**
   * Update all components with current data
   * @private
   */
  updateComponents() {
    this.table.setData(this.memories);
    
    const categoryCounts = this.calculateCategoryCounts();
    this.filters.setCategoryCounts(categoryCounts);
    this.filters.setResultCount(this.memories.length, this.memories.length);
  }

  /**
   * Add new memory
   */
  addMemory() {
    this.modal.show();
  }

  /**
   * Edit existing memory
   * @param {Object} memory - Memory to edit
   */
  editMemory(memory) {
    this.modal.show(memory);
  }

  /**
   * Delete memory with confirmation
   * @param {Object} memory - Memory to delete
   */
  async deleteMemory(memory) {
    const confirmed = await this.showConfirmation(
      'Delete Memory',
      `Are you sure you want to delete the memory "${memory.key}"? This action cannot be undone.`,
      'Delete',
      'Cancel'
    );
    
    if (!confirmed) return;
    
    this.setLoading(true);
    
    try {
      const response = await fetch(`${this.options.apiEndpoint}/${memory.id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Remove from local data
      this.memories = this.memories.filter(m => m.id !== memory.id);
      this.updateComponents();
      
      this.showSuccess(`Memory "${memory.key}" deleted successfully.`);
      
      this.dispatchEvent(new CustomEvent('memoryDeleted', {
        detail: { memory }
      }));
    } catch (error) {
      console.error('Failed to delete memory:', error);
      this.showError('Failed to delete memory. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Save memory (create or update)
   * @private
   * @param {Object} memory - Memory data to save
   * @param {boolean} isEdit - Whether this is an edit operation
   */
  async saveMemory(memory, isEdit) {
    this.setLoading(true);
    
    try {
      const url = isEdit 
        ? `${this.options.apiEndpoint}/${memory.id}`
        : this.options.apiEndpoint;
      
      const method = isEdit ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(memory)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const savedMemory = await response.json();
      
      if (isEdit) {
        // Update existing memory
        const index = this.memories.findIndex(m => m.id === savedMemory.id);
        if (index !== -1) {
          this.memories[index] = savedMemory;
        }
      } else {
        // Add new memory
        this.memories.push(savedMemory);
      }
      
      this.updateComponents();
      this.modal.hide();
      
      const action = isEdit ? 'updated' : 'created';
      this.showSuccess(`Memory "${savedMemory.key}" ${action} successfully.`);
      
      this.dispatchEvent(new CustomEvent(isEdit ? 'memoryUpdated' : 'memoryCreated', {
        detail: { memory: savedMemory }
      }));
    } catch (error) {
      console.error('Failed to save memory:', error);
      this.showError('Failed to save memory. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Set loading state
   * @private
   * @param {boolean} loading - Whether in loading state
   */
  setLoading(loading) {
    this.isLoading = loading;
    
    const loadingElement = this.container.querySelector('.memory-loading');
    const contentElement = this.container.querySelector('.memory-content');
    
    if (loading) {
      loadingElement.style.display = 'flex';
      contentElement.style.opacity = '0.5';
      contentElement.style.pointerEvents = 'none';
    } else {
      loadingElement.style.display = 'none';
      contentElement.style.opacity = '1';
      contentElement.style.pointerEvents = 'auto';
    }
  }

  /**
   * Show success message
   * @private
   * @param {string} message - Success message
   */
  showSuccess(message) {
    // Implementation depends on notification system
    console.log('Success:', message);
    // Could emit event for parent to handle
    this.dispatchEvent(new CustomEvent('notification', {
      detail: { type: 'success', message }
    }));
  }

  /**
   * Show error message
   * @private
   * @param {string} message - Error message
   */
  showError(message) {
    // Implementation depends on notification system
    console.error('Error:', message);
    // Could emit event for parent to handle
    this.dispatchEvent(new CustomEvent('notification', {
      detail: { type: 'error', message }
    }));
  }

  /**
   * Show confirmation dialog
   * @private
   * @param {string} title - Dialog title
   * @param {string} message - Confirmation message
   * @param {string} confirmText - Confirm button text
   * @param {string} cancelText - Cancel button text
   * @returns {Promise<boolean>} Whether user confirmed
   */
  async showConfirmation(title, message, confirmText, cancelText) {
    // Simple implementation - could be enhanced with modal component
    return confirm(`${title}\n\n${message}`);
  }

  /**
   * Get selected memories
   * @returns {Array} Selected memory objects
   */
  getSelectedMemories() {
    return this.table.getSelectedMemories();
  }

  /**
   * Refresh memories from server
   */
  refresh() {
    this.loadMemories();
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
   * Destroy the memory manager and clean up
   */
  destroy() {
    this.filters.destroy();
    this.table.destroy();
    this.modal.destroy();
    
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// Export all components
export { MemoryTable } from './memory-table.js';
export { MemoryModal } from './memory-modal.js';
export { MemoryFilters } from './memory-filters.js';
export { CategoryBadge } from './category-badge.js';

// Default export for convenience
export default {
  MemoryTable,
  MemoryModal,
  MemoryFilters,
  CategoryBadge,
  MemoryManager
};