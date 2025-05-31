# JSON Browser Design Document

## Purpose

A **stable, feature-complete JSON browser** designed to be compiled into a Groovy script for DataGrip integration. This allows developers to:

1. **Analyze JSON** embedded in database table columns
2. **Explore nested structures** interactively
3. **Promote JSON elements** to top-level columns
4. **Generate SQL helpers** based on their selections

## Architecture Overview

This follows a **simplified, state-driven architecture** designed for **zero breaking changes**. Every modification should be additive and backwards compatible.

### Core Principles

1. **Feature Completeness** - All required features already exist
2. **Zero Breaking Changes** - Modifications are additive only
3. **Single State Tree** - One reactive object manages everything
4. **Declarative Rendering** - State changes trigger view updates
5. **DataGrip Ready** - Designed for Groovy script compilation

## File Structure

```
/
├── basic.html      # Entry point and DOM structure
├── basic.css       # All styling (no JavaScript dependencies)
├── basic.js        # Complete application logic
└── JSON Output/
    └── samplejson.json  # Test data source
```

## Core Features (Feature Complete)

### ✅ **Search System**
- Real-time full-text search across all JSON data
- Navigation with ← → buttons and Enter key
- Auto-expansion of nested paths to show hidden results
- Current result highlighting with red border
- Hidden results counter: "(X hidden)"

### ✅ **Column Management**
- Modal interface for selecting visible columns
- Discovery of all nested JSON paths automatically
- Drag-like reordering with ↑↓ buttons
- Add/remove columns from any nested level
- Checkbox interface for bulk selection

### ✅ **SQL Generation**
- PostgreSQL, MySQL, SQL Server dialect support
- Smart nested JSON path conversion
- Copy to clipboard functionality
- Real-time updates when columns change

### ✅ **Data Exploration**
- Expandable nested objects and arrays
- Expand All / Collapse All functionality
- JSON path display toggle
- Click-to-expand interface
- Smooth CSS transitions

### ✅ **Table Features**
- Column sorting (click headers)
- Row numbering
- Responsive design
- Hover effects and visual feedback

## State Management

### State Schema (STABLE - DO NOT MODIFY STRUCTURE)
```javascript
const state = {
  // Data Layer
  data: [],              // Raw JSON from database
  allColumns: [],        // All discovered nested paths
  visibleColumns: [],    // Currently shown columns
  
  // Search Layer
  searchQuery: '',       // Current search term
  searchResults: [],     // Array of {rowIndex, path, value}
  currentSearchIndex: -1,// Active result index
  
  // UI Layer
  expandedPaths: Set(),  // Set of "rowIndex-path" keys
  sortBy: null,          // Current sort column
  sortDirection: 'asc',  // 'asc' or 'desc'
  showPaths: false,      // JSON path visibility toggle
  
  // Modal Layer
  showColumnModal: false,
  showSqlModal: false,
  sqlDialect: 'postgresql'
};
```

## DataGrip Integration Requirements

### Input Format
```javascript
// DataGrip will provide JSON data as:
const jsonData = [
  { column1: "value", json_column: { nested: "data" } },
  // ... more rows
];
```

### Output Requirements
```sql
-- Generated SQL must be valid for target database
SELECT 
  "column1",
  "json_column"->>'nested' AS "json_column_nested"
FROM your_table_name;
```

### Groovy Script Considerations
- No external dependencies (single file compilation)
- Self-contained HTML/CSS/JS
- Standard browser APIs only
- No ES6 modules (use regular script tags)

## Change Guidelines

### 🟢 **SAFE Changes (Allowed)**

#### Bug Fixes Only
```javascript
// Fix existing functionality that's broken
// Example: Fix search highlighting
const highlightText = (text, query, isActive = false) => {
  // Fix regex escaping bug
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\# JSON Browser Design Document

## Architecture Overview

This JSON Browser follows a **simplified, state-driven architecture** designed to be maintainable, performant, and easy to extend. The design prioritizes clarity over complexity.

### Core Principles

1. **Single Source of Truth** - All application state lives in one reactive object
2. **Unidirectional Data Flow** - State changes trigger view updates automatically
3. **Pure Functions** - Rendering functions are stateless and predictable
4. **Event Delegation** - Single event handler manages all user interactions
5. **Minimal Abstractions** - Simple, direct code over complex patterns

## File Structure

```
/
├── basic.html      # Entry point and DOM structure
├── basic.css       # All styling and visual design
├── basic.js        # All application logic and state management
└── JSON Output/
    └── samplejson.json  # Data source
```

## State Management

### State Schema
```javascript
const state = {
  // Data
  data: [],              // Raw JSON data
  allColumns: [],        // All discovered column paths
  visibleColumns: [],    // Currently displayed columns
  
  // UI State
  searchQuery: '',       // Current search term
  searchResults: [],     // Search matches
  currentSearchIndex: -1,// Active search result
  expandedPaths: Set,    // Expanded nested objects
  sortBy: null,          // Sort column
  sortDirection: 'asc',  // Sort direction
  showPaths: false,      // Show JSON paths toggle
  
  // Modal State
  showColumnModal: false,
  showSqlModal: false,
  sqlDialect: 'postgresql'
}
```

### Reactive Updates
- State changes automatically trigger UI re-renders via Proxy
- No manual DOM manipulation - declarative rendering only
- Pure functions ensure predictable updates

## Data Flow

```
User Action → Event Handler → State Update → Reactive Re-render → DOM Update
```

### Example Flow:
1. User types in search box
2. `handleEvent('search')` updates `state.searchQuery`
3. Proxy detects change, triggers `render()`
4. `render()` calls `renderHeader()` with new search results
5. DOM updates with highlighted matches

## Key Components

### 1. Data Processing
- **`flatten(obj)`** - Converts nested JSON to searchable flat structure
- **`getValue(obj, path)`** - Safely extracts values using dot notation paths
- **`getAllColumns(data)`** - Discovers all possible column paths from sample data

### 2. Search System
- **`performSearch(data, query)`** - Full-text search across all data
- **`expandToResult(result)`** - Auto-expands paths to show hidden search results
- **`highlightText(text, query)`** - Adds HTML highlighting to matches

### 3. Rendering Pipeline
- **`render()`** - Main render function that updates entire UI
- **`renderHeader()`** - Search box, controls, counters
- **`renderTable()`** - Main data table with sorting
- **`renderCell()`** - Individual cell with expand/collapse logic
- **`renderNestedObject()`** - Nested table for expanded objects

### 4. SQL Generation
- **`generateSQL(dialect)`** - Converts column selections to SQL queries
- Supports PostgreSQL, MySQL, SQL Server dialects
- Handles nested JSON path extraction syntax

## Change Guidelines

### 🟢 **Safe Changes (Low Risk)**

#### CSS Styling Changes
```css
/* Modify colors, spacing, fonts in basic.css */
.header { background: #your-color; }
.highlight { background: #your-highlight; }
```

#### Adding New Modal Dialogs
```javascript
// 1. Add state
state.showNewModal = false;

// 2. Add render function
const renderNewModal = () => {
  if (!state.showNewModal) return '';
  return `<div class="modal">...</div>`;
};

// 3. Add to main render
const render = () => {
  document.getElementById('app').innerHTML = `
    ${renderHeader()}
    ${renderTable()}
    ${renderNewModal()}  // Add here
  `;
};

// 4. Add event handlers
case 'show-new-modal':
  state.showNewModal = true;
  break;
```

#### Adding New Button Actions
```javascript
// 1. Add button to renderHeader()
<button data-action="your-action">Your Button</button>

// 2. Add handler to handleEvent()
case 'your-action':
  // Your logic here
  break;
```

### 🟡 **Moderate Changes (Medium Risk)**

#### Modifying Search Behavior
```javascript
// Extend performSearch() function
const performSearch = (data, query) => {
  // Add your search logic
  // Keep existing structure: [{ rowIndex, path, value }]
};
```

#### Adding New Column Types
```javascript
// Modify renderCell() to handle new data types
const renderCell = (value, path, rowIndex) => {
  // Add new conditions for your data type
  if (isYourNewType(value)) {
    return renderYourNewType(value);
  }
  // Keep existing logic
};
```

#### Extending SQL Generation
```javascript
// Add new dialect to generateSQL()
if (dialect === 'your-database') {
  const sqlColumns = columns.map(col => {
    // Your SQL syntax
  });
  return `SELECT ${sqlColumns.join(',')} FROM ${tableName};`;
}
```

### 🔴 **High Risk Changes (Requires Careful Planning)**

#### Changing State Structure
- **Impact**: Affects entire application
- **Approach**: 
  1. Plan migration strategy
  2. Update all state references
  3. Test thoroughly
  4. Consider backward compatibility

#### Modifying Reactive System
- **Impact**: Core functionality
- **Approach**:
  1. Understand current Proxy implementation
  2. Test with small changes first
  3. Ensure all listeners still work

#### Replacing Rendering System
- **Impact**: Entire UI
- **Approach**:
  1. Consider incremental migration
  2. Maintain same state interface
  3. Test with subset of components first

## Development Workflow

### 1. Understanding the Change
- **What**: Clearly define what you want to change
- **Why**: Understand the business requirement
- **How**: Choose the appropriate approach from guidelines above

### 2. Making Changes

#### For CSS Changes:
```bash
# Edit basic.css
# Test in browser
# No restart needed
```

#### For Logic Changes:
```bash
# Edit basic.js
# Refresh browser
# Check console for errors
# Test all affected features
```

#### For Data Source Changes:
```bash
# Replace JSON Output/samplejson.json
# Or modify fetch() call in init()
# Refresh browser
```

### 3. Testing Checklist
- [ ] Search functionality works
- [ ] Column selection works
- [ ] SQL generation works
- [ ] Expand/collapse works
- [ ] Sorting works
- [ ] No console errors
- [ ] Responsive design intact

## Common Patterns

### Adding New State
```javascript
// 1. Add to initial state
const state = createReactiveState({
  // existing state...
  yourNewProperty: defaultValue
});

// 2. Use in render functions
const renderSomething = () => {
  return state.yourNewProperty ? 'shown' : 'hidden';
};

// 3. Update in event handlers
case 'your-action':
  state.yourNewProperty = newValue;
  break;
```

### Adding New Event Types
```javascript
// 1. Add data-action attribute to HTML
<button data-action="your-new-action">Click Me</button>

// 2. Handle in handleEvent()
case 'your-new-action':
  // Your logic
  state.notify(); // If you need to force re-render
  break;
```

### Adding New Render Functions
```javascript
const renderYourComponent = () => {
  return `
    <div class="your-component">
      ${state.someProperty}
    </div>
  `;
};

// Include in main render()
const render = () => {
  document.getElementById('app').innerHTML = `
    ${renderHeader()}
    ${renderYourComponent()}
    ${renderTable()}
  `;
};
```

## Debugging Guide

### State Issues
```javascript
// Add to browser console
console.log('Current state:', state);
console.log('Search results:', state.searchResults);
console.log('Visible columns:', state.visibleColumns);
```

### Render Issues
```javascript
// Test individual render functions
console.log(renderHeader());
console.log(renderTable());
```

### Event Issues
```javascript
// Add logging to handleEvent()
const handleEvent = (e) => {
  console.log('Event:', e.target.dataset.action, e.target.dataset);
  // existing logic...
};
```

## Performance Considerations

### Current Optimizations
- Lazy rendering of nested content
- Limited column sampling for discovery
- CSS transitions for animations
- Event delegation for efficiency

### Scaling Guidelines
- **Small datasets** (< 1MB): Current approach works well
- **Medium datasets** (1-10MB): Consider virtual scrolling
- **Large datasets** (> 10MB): Consider server-side processing

## Extension Points

### Custom Data Sources
```javascript
// Replace init() function to load from:
// - API endpoints
// - Local files
// - Other formats (CSV, XML)
```

### Custom Renderers
```javascript
// Add to renderCell() for:
// - Images
// - Links
// - Custom formatting
// - Interactive widgets
```

### Custom Export Formats
```javascript
// Extend beyond SQL:
// - CSV export
// - Excel export
// - JSON schemas
// - API documentation
```

## Anti-Patterns to Avoid

### ❌ Don't Do This
```javascript
// Direct DOM manipulation
document.getElementById('something').innerHTML = 'value';

// Multiple state objects
const uiState = {};
const dataState = {};

// Complex class hierarchies
class SearchManager extends BaseManager {}

// Manual event listeners
element.addEventListener('click', handler);
```

### ✅ Do This Instead
```javascript
// Update state, let reactive system handle DOM
state.someProperty = 'value';

// Single state object
state.someProperty = 'value';

// Simple functions
const handleSearch = (query) => { /* logic */ };

// Event delegation
data-action="search" // handled by single listener
```

## Conclusion

This design prioritizes **simplicity and maintainability** over complex patterns. When in doubt:

1. **Follow the existing patterns** shown in the codebase
2. **Keep changes small and focused**
3. **Test thoroughly** before considering complete
4. **Document your changes** for future maintainers

The goal is a JSON browser that's **easy to understand, modify, and extend** without requiring deep architectural knowledge.');
  // ... rest of function unchanged
};
```

#### CSS Styling Improvements
```css
/* Improve visual design without changing structure */
.highlight.current {
  background: #ff5722;
  border: 2px solid #d32f2f; /* Add better visibility */
}
```

#### Performance Optimizations
```javascript
// Optimize existing functions without changing interfaces
const getAllColumns = (data) => {
  // Sample fewer rows for better performance
  const sampleSize = Math.min(2, data.length); // Reduced from 3
  // ... rest unchanged
};
```

### 🔴 **FORBIDDEN Changes**

#### State Structure Changes
```javascript
// ❌ DON'T ADD NEW STATE PROPERTIES
state.newFeature = something;

// ❌ DON'T CHANGE EXISTING STATE TYPES
state.expandedPaths = []; // Was a Set, now array - BREAKS EVERYTHING

// ❌ DON'T RENAME STATE PROPERTIES
state.searchTerm = ''; // Was searchQuery - BREAKS SEARCH
```

#### Function Signature Changes
```javascript
// ❌ DON'T CHANGE FUNCTION PARAMETERS
renderCell(value, path, rowIndex, newParam); // Added param - BREAKS CALLERS

// ❌ DON'T CHANGE RETURN TYPES
performSearch(data, query); // Must return [{rowIndex, path, value}]
```

#### Event Handler Changes
```javascript
// ❌ DON'T CHANGE data-action VALUES
<button data-action="new-name">  <!-- Was "search-next" - BREAKS HANDLERS -->

// ❌ DON'T CHANGE EVENT STRUCTURE
handleEvent(e) {
  const { action } = e.target.dataset; // Must stay this way
}
```

## Development Workflow

### 1. Bug Identification
```javascript
// Before fixing, understand:
// - What is broken?
// - What should it do?
// - Which function is responsible?
```

### 2. Surgical Fixes
```javascript
// Fix the minimum code necessary
// Don't refactor surrounding code
// Don't "improve" working code
```

### 3. Testing Protocol
- [ ] Search still works (type, navigate, highlight)
- [ ] Column selection still works (modal, checkboxes, reorder)
- [ ] SQL generation still works (all dialects, copy)
- [ ] Expand/collapse still works (click, expand all)
- [ ] Sorting still works (click headers)
- [ ] No console errors
- [ ] No broken visual elements

## Current Known Issues (To Fix)

Based on the split files, likely issues include:

### Module Loading
```javascript
// basic.js probably has module issues
// Fix: Ensure no ES6 modules, use regular scripts
```

### Event Binding
```javascript
// Event listeners may not be attached properly
// Fix: Ensure handleEvent is called on all interactions
```

### CSS Loading
```javascript
// Styles may not apply correctly
// Fix: Verify CSS file loads before JS executes
```

### Data Loading
```javascript
// JSON fetch may fail
// Fix: Proper error handling and fallback data
```

## Groovy Compilation Strategy

### Single File Output
```groovy
// Compile to single .groovy file containing:
// 1. HTML template as string
// 2. CSS as embedded <style>
// 3. JavaScript as embedded <script>
// 4. DataGrip integration hooks
```

### Integration Points
```groovy
class JsonBrowser {
  static String generateHtml(List<Map> jsonData) {
    // Return complete HTML with data embedded
  }
  
  static String getSqlForColumns(List<String> columns, String dialect) {
    // Return SQL string for selected columns
  }
}
```

## Success Criteria

### Feature Parity
- All original features work exactly as before
- No regressions in functionality
- Same user experience

### DataGrip Ready
- Compiles to single Groovy script
- Integrates with DataGrip export system
- Generates valid SQL for target databases

### Zero Breaking Changes
- Any JSON data that worked before still works
- All user interactions behave identically
- All generated SQL remains valid

## Anti-Patterns (STRICTLY FORBIDDEN)

### ❌ Feature Additions
```javascript
// Don't add new features
// Don't "improve" existing features
// Don't add configuration options
```

### ❌ Architectural Changes
```javascript
// Don't change the reactive system
// Don't modify the rendering pipeline
// Don't alter the event system
```

### ❌ "Improvements"
```javascript
// Don't optimize working code
// Don't refactor for "better" patterns
// Don't add abstractions
```

## Motto

**"If it ain't broke, don't fix it. If it is broke, fix ONLY what's broken."**

The goal is a **stable, reliable tool** that developers can trust in their DataGrip workflows, not a showcase of the latest JavaScript patterns.