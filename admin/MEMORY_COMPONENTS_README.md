# Memory Management Components

This directory contains reusable frontend components for memory management in the compassionate AI companion system. These components are designed to help caregivers manage memories about elderly individuals with dementia.

## Components Overview

### 1. MemoryTable (`memory-table.js`)
A sortable, paginated table component for displaying memory data with actions.

**Features:**
- Sortable columns (key, category, updated date)
- Pagination with configurable page sizes
- Row selection with bulk operations
- Edit/delete action buttons
- Responsive design
- Search and filter integration

**Usage:**
```javascript
import { MemoryTable } from './components/memory-table.js';

const table = new MemoryTable({
  data: memoriesArray,
  selectable: true,
  pageSize: 10,
  onEdit: (memory) => console.log('Edit:', memory),
  onDelete: (memory) => console.log('Delete:', memory)
});

document.getElementById('container').appendChild(table.element);
```

### 2. MemoryModal (`memory-modal.js`)
Modal dialog for creating and editing memories with validation.

**Features:**
- Form validation with real-time feedback
- Loading states during save operations
- Category descriptions and guidance
- Keyboard navigation and accessibility
- Edit and create modes

**Usage:**
```javascript
import { MemoryModal } from './components/memory-modal.js';

const modal = new MemoryModal();

modal.on('save', (e) => {
  const { memory, isEdit } = e.detail;
  // Handle save operation
  modal.hide();
});

// Create new memory
modal.show();

// Edit existing memory
modal.show(existingMemory);
```

### 3. MemoryFilters (`memory-filters.js`)
Filter bar with search input and category filtering.

**Features:**
- Debounced search input
- Category filter chips with counts
- Active filter display with removal
- Clear all functionality
- Result count display

**Usage:**
```javascript
import { MemoryFilters } from './components/memory-filters.js';

const filters = new MemoryFilters({
  categories: ['family', 'health', 'preferences', 'topics_to_avoid', 'general'],
  placeholder: 'Search memories...'
});

filters.on('filter', (e) => {
  const { searchTerm, selectedCategories } = e.detail;
  // Apply filters to data
});

document.getElementById('container').appendChild(filters.element);
```

### 4. CategoryBadge (`category-badge.js`)
Color-coded badges for memory categories.

**Features:**
- Category-specific colors and descriptions
- Multiple sizes (small, medium, large)
- Interactive and removable variants
- Static utility methods for badge creation
- Category validation and formatting

**Usage:**
```javascript
import { CategoryBadge } from './components/category-badge.js';

// Create basic badge
const badge = CategoryBadge.create('family');

// Create interactive badge
const interactiveBadge = CategoryBadge.create('health', null, {
  interactive: true,
  onClick: (category, element) => console.log(`Clicked ${category}`)
});

// Create removable badge
const removableBadge = CategoryBadge.create('preferences', null, {
  removable: true,
  onRemove: (category, element) => element.remove()
});
```

### 5. MemoryManager (`memory-components.js`)
Complete memory management interface orchestrating all components.

**Features:**
- Full CRUD operations with API integration
- Component orchestration and event handling
- Loading states and error handling
- Unified interface for all memory operations

**Usage:**
```javascript
import { MemoryManager } from './components/memory-components.js';

const manager = new MemoryManager({
  container: document.getElementById('memory-container'),
  apiEndpoint: '/api/memories',
  selectable: true,
  pageSize: 10
});

manager.on('memoryCreated', (e) => {
  console.log('Memory created:', e.detail.memory);
});
```

## Category System

The components use a standardized category system for organizing memories:

| Category | Color | Description |
|----------|-------|-------------|
| `family` | Blue | Information about family members, relationships, and important family events |
| `health` | Green | Medical conditions, medications, allergies, and health-related preferences |
| `preferences` | Purple | Personal likes, dislikes, hobbies, interests, and comfort preferences |
| `topics_to_avoid` | Red | Sensitive subjects or topics that may cause distress or discomfort |
| `general` | Gray | Other important information that doesn't fit into specific categories |

## CSS Classes and Styling

### Component Structure
```css
.memory-manager           /* Main container */
├── .memory-header        /* Header with title and actions */
├── .memory-filters       /* Filter bar container */
│   ├── .filters-top      /* Search and controls */
│   └── .filters-bottom   /* Category filters */
├── .memory-table         /* Table container */
│   ├── .table-container  /* Scrollable table wrapper */
│   └── .table-pagination /* Pagination controls */
└── .memory-modal         /* Modal dialog */
    ├── .modal-header     /* Modal title and close */
    ├── .modal-body       /* Form content */
    └── .modal-footer     /* Action buttons */
```

### Category Badge Classes
```css
.category-badge                    /* Base badge class */
.category-badge.category-{type}    /* Category-specific styling */
.category-badge.size-{size}        /* Size variants */
.category-badge[role="button"]     /* Interactive badges */
```

### Responsive Design
- Mobile-first approach with breakpoints at 768px and 480px
- Stack layouts on small screens
- Adjust font sizes and spacing
- Optimize touch targets for mobile

## Event System

All components extend `EventTarget` and emit custom events:

### MemoryTable Events
- `rowSelect` - Row selection changed
- `sort` - Column sort applied
- `pageChange` - Page navigation
- `edit` - Edit button clicked
- `delete` - Delete button clicked

### MemoryModal Events
- `show` - Modal opened
- `hide` - Modal closed
- `save` - Save/submit button clicked

### MemoryFilters Events
- `filter` - Filter criteria changed
- `clear` - All filters cleared

### MemoryManager Events
- `memoriesLoaded` - Initial data loaded
- `memoryCreated` - New memory created
- `memoryUpdated` - Existing memory updated
- `memoryDeleted` - Memory deleted
- `selectionChange` - Selection changed
- `notification` - Success/error messages

## Accessibility Features

### Keyboard Navigation
- Tab order follows logical flow
- Enter/Space activation for buttons
- Escape to close modals and clear searches
- Arrow keys for pagination

### Screen Reader Support
- Semantic HTML structure
- ARIA labels and descriptions
- Role attributes for interactive elements
- Live regions for dynamic content updates

### Visual Accessibility
- High contrast color schemes
- Focus indicators on all interactive elements
- Consistent visual hierarchy
- Scalable fonts and spacing

## API Integration

The components expect a REST API with the following endpoints:

### Memory Endpoints
```
GET    /api/memories          # List all memories
POST   /api/memories          # Create new memory
PUT    /api/memories/:id      # Update existing memory
DELETE /api/memories/:id      # Delete memory
```

### Memory Data Structure
```javascript
{
  id: number,                    // Unique identifier
  key: string,                   // Memory key (unique)
  content: string,               // Memory content
  category: string,              // Category (family, health, etc.)
  created_at: string,            // ISO date string
  updated_at: string,            // ISO date string
  last_accessed?: string         // Optional last access time
}
```

## Integration Examples

### Basic Integration
```javascript
import { MemoryTable, MemoryFilters } from './memory-components.js';

// Create components
const filters = new MemoryFilters();
const table = new MemoryTable({ data: memories });

// Connect filter to table
filters.on('filter', (e) => {
  const { searchTerm, selectedCategories } = e.detail;
  table.filter(searchTerm, selectedCategories[0] || '');
});

// Append to DOM
document.getElementById('filters').appendChild(filters.element);
document.getElementById('table').appendChild(table.element);
```

### Advanced Integration with API
```javascript
import { MemoryManager } from './memory-components.js';

const manager = new MemoryManager({
  container: document.getElementById('app'),
  apiEndpoint: '/api/memories'
});

// Handle notifications
manager.on('notification', (e) => {
  const { type, message } = e.detail;
  showToast(type, message);
});
```

## Testing

### Demo Page
A comprehensive demo page is available at `memory-components-demo.html` that demonstrates:
- All component features and configurations
- Event handling and interactions
- Mock API integration
- Responsive behavior

### Manual Testing Checklist
- [ ] Create, edit, and delete memories
- [ ] Search and filter functionality
- [ ] Sort table columns
- [ ] Pagination navigation
- [ ] Category badge interactions
- [ ] Modal form validation
- [ ] Keyboard navigation
- [ ] Mobile responsiveness
- [ ] Screen reader compatibility

## Development Guidelines

### Code Style
- ES6+ modules with explicit imports/exports
- Consistent naming conventions (camelCase for variables, kebab-case for CSS)
- Comprehensive JSDoc documentation
- Error handling with graceful degradation

### Performance Considerations
- Debounced search input (300ms)
- Virtualized rendering for large datasets
- Efficient DOM updates with targeted re-renders
- CSS transitions for smooth animations

### Browser Support
- Modern browsers with ES6+ support
- Chrome 70+, Firefox 65+, Safari 12+, Edge 79+
- Graceful degradation for older browsers
- No external dependencies required

## Customization

### Theming
Components use CSS custom properties for theming:
```css
:root {
  --color-primary: #6366f1;
  --bg-primary: #ffffff;
  --text-primary: #111827;
  /* ... other theme variables */
}
```

### Component Options
Most components accept configuration options:
```javascript
const table = new MemoryTable({
  selectable: true,
  pagination: true,
  pageSize: 25,
  className: 'custom-table'
});
```

### Event Customization
Components emit cancelable events for custom handling:
```javascript
modal.on('save', (e) => {
  if (!validateCustomRules(e.detail.memory)) {
    e.preventDefault(); // Cancel default save
    showCustomError();
  }
});
```

## Troubleshooting

### Common Issues

1. **Components not rendering**
   - Check console for import errors
   - Ensure CSS is properly loaded
   - Verify container elements exist

2. **Events not firing**
   - Check event listener registration
   - Verify event names match documentation
   - Use `addEventListener` instead of `on` for debugging

3. **Styling issues**
   - Ensure CSS custom properties are defined
   - Check for CSS conflicts with existing styles
   - Verify CSS file load order

4. **API integration problems**
   - Check network requests in browser DevTools
   - Verify API endpoint URLs and methods
   - Ensure CORS headers are configured

### Debug Mode
Enable debug logging:
```javascript
// Add to console to enable debug logging
window.memoryComponentsDebug = true;
```

## Future Enhancements

- Virtual scrolling for large datasets
- Drag-and-drop memory organization
- Bulk operations (import/export)
- Advanced search with filters
- Memory timeline visualization
- Conflict resolution for concurrent edits