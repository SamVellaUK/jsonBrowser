# Search System Refactor - Change Document

## Overview
Refactor the search system to be fully state-driven with auto-expansion to search results. The current implementation has complex DOM inspection logic that's fragile and unreliable. The new implementation will use the state object as the single source of truth.

## Current Problems
1. Search tries to find DOM elements that don't exist (collapsed content)
2. Complex visibility detection through DOM inspection
3. Race conditions between expansion and highlighting
4. Fragile async coordination between multiple systems
5. Inconsistent behavior when table structure changes

## New Architecture

### State-Driven Design
- `state.expansionState` tracks what's expanded/collapsed
- `state.searchState` tracks search results and current position
- DOM is rendered from state, never inspected for state
- Partial re-rendering for efficient expansion

## Detailed Changes

### 1. State Object Updates

#### File: `main.js`
```javascript
// ADD to state object:
export const state = {
  // ... existing properties ...
  
  // NEW: Track expansion state
  expansionState: {
    // Key format: "rowIndex-path"
    // Value: boolean (true = expanded, false/undefined = collapsed)
    // Example: "0-raw_event": true, "0-raw_event.requestParameters": false
  },
  
  // NEW: Search state
  searchState: {
    query: "",
    results: [],           // Array of SearchResult objects
    currentIndex: -1,      // Current result index (-1 = none selected)
    isExpanding: false     // Prevent concurrent expansions
  }
}

// ADD: Reset function for data changes
export function resetSearchState() {
  state.expansionState = {};
  state.searchState = {
    query: "",
    results: [],
    currentIndex: -1,
    isExpanding: false
  };
}
```

#### Update existing fetchJSON function:
```javascript
window.fetchJSON = async function() {
  // ... existing code ...
  
  // ADD: Reset search state when data changes
  resetSearchState();
  
  // ... rest of existing code ...
};
```

### 2. New Search Engine

#### File: `search-engine.js` (NEW FILE)
```javascript
import { state } from './main.js';
import { resolvePath, splitJsonPath } from './Utils.js';

/**
 * SearchResult class - represents a single search match
 */
export class SearchResult {
  constructor(rowIndex, path, value, matchStart, matchEnd) {
    this.rowIndex = rowIndex;
    this.path = path;
    this.value = String(value);
    this.matchStart = matchStart;
    this.matchEnd = matchEnd;
    this.id = `${rowIndex}-${path}-${matchStart}`;
  }
}

/**
 * Pure data search - no DOM involved
 */
export class SearchEngine {
  static search(query) {
    const results = [];
    const lowerQuery = query.toLowerCase().trim();
    
    if (!lowerQuery) return results;
    
    state.data.forEach((row, rowIndex) => {
      SearchEngine._searchInObject(row, '', rowIndex, lowerQuery, results);
    });
    
    // Sort by document order (row, then path depth)
    return results.sort((a, b) => {
      if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
      return SearchEngine._getPathDepth(a.path) - SearchEngine._getPathDepth(b.path);
    });
  }
  
  static _searchInObject(obj, basePath, rowIndex, query, results) {
    if (obj == null) return;
    
    if (typeof obj !== 'object') {
      // Primitive value - check for matches
      const value = String(obj);
      const lowerValue = value.toLowerCase();
      let index = lowerValue.indexOf(query);
      
      while (index !== -1) {
        results.push(new SearchResult(
          rowIndex, 
          basePath, 
          value, 
          index, 
          index + query.length
        ));
        index = lowerValue.indexOf(query, index + 1);
      }
      return;
    }
    
    if (Array.isArray(obj)) {
      obj.forEach((item, idx) => {
        const itemPath = basePath ? `${basePath}[${idx}]` : `[${idx}]`;
        SearchEngine._searchInObject(item, itemPath, rowIndex, query, results);
      });
    } else {
      Object.entries(obj).forEach(([key, value]) => {
        const keyPath = basePath ? `${basePath}.${key}` : key;
        SearchEngine._searchInObject(value, keyPath, rowIndex, query, results);
      });
    }
  }
  
  static _getPathDepth(path) {
    return (path.match(/[.\[]/g) || []).length;
  }
}
```

### 3. Visibility Manager

#### File: `visibility-manager.js` (NEW FILE)
```javascript
import { state } from './main.js';
import { splitJsonPath } from './Utils.js';

/**
 * Manages visibility state - pure state operations
 */
export class VisibilityManager {
  /**
   * Check if a search result is currently visible
   */
  static isResultVisible(result) {
    return VisibilityManager.isPathVisible(result.path, result.rowIndex);
  }
  
  /**
   * Check if a path is visible (all parents expanded)
   */
  static isPathVisible(path, rowIndex) {
    if (!path.includes('.') && !path.includes('[')) {
      // Top-level column - always visible if it's in column order
      return state.columnState.order.includes(path);
    }
    
    const pathSegments = splitJsonPath(path);
    let currentPath = '';
    
    // Check each parent level
    for (let i = 0; i < pathSegments.length - 1; i++) {
      const segment = pathSegments[i];
      
      if (segment.startsWith('[') && segment.endsWith(']')) {
        currentPath = currentPath + segment;
      } else {
        currentPath = currentPath ? `${currentPath}.${segment}` : segment;
      }
      
      const expansionKey = `${rowIndex}-${currentPath}`;
      
      // If this level isn't expanded, path is not visible
      if (!state.expansionState[expansionKey]) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Get the expansion path - all parent paths that need to be expanded
   */
  static getExpansionPath(targetPath, rowIndex) {
    const pathSegments = splitJsonPath(targetPath);
    const expansionSteps = [];
    let currentPath = '';
    
    for (let i = 0; i < pathSegments.length - 1; i++) {
      const segment = pathSegments[i];
      
      if (segment.startsWith('[') && segment.endsWith(']')) {
        currentPath = currentPath + segment;
      } else {
        currentPath = currentPath ? `${currentPath}.${segment}` : segment;
      }
      
      const expansionKey = `${rowIndex}-${currentPath}`;
      
      // Only add if not already expanded
      if (!state.expansionState[expansionKey]) {
        expansionSteps.push({
          path: currentPath,
          key: expansionKey,
          rowIndex: rowIndex
        });
      }
    }
    
    return expansionSteps;
  }
}
```

### 4. Path Expander

#### File: `path-expander.js` (NEW FILE)
```javascript
import { state } from './main.js';
import { VisibilityManager } from './visibility-manager.js';
import { resolvePath } from './Utils.js';
import { renderNestedTable } from './TableRenderer.js';

/**
 * Handles expansion through state updates and partial re-rendering
 */
export class PathExpander {
  /**
   * Expand path to make result visible
   */
  static async expandToResult(result) {
    if (state.searchState.isExpanding) {
      console.log('⏸️ Expansion already in progress, skipping');
      return;
    }
    
    state.searchState.isExpanding = true;
    
    try {
      const expansionSteps = VisibilityManager.getExpansionPath(result.path, result.rowIndex);
      
      console.log(`🔧 Expanding ${expansionSteps.length} levels for: ${result.path}`);
      
      for (const step of expansionSteps) {
        await PathExpander._expandSingleLevel(step);
      }
      
      console.log(`✅ Expansion complete for: ${result.path}`);
    } catch (error) {
      console.error(`❌ Expansion failed for ${result.path}:`, error);
    } finally {
      state.searchState.isExpanding = false;
    }
  }
  
  /**
   * Expand a single level
   */
  static async _expandSingleLevel(step) {
    console.log(`📂 Expanding level: ${step.path}`);
    
    // Update state first
    state.expansionState[step.key] = true;
    
    // Find the nested container
    const container = document.querySelector(
      `[data-row-index="${step.rowIndex}"] [data-parent-path="${step.path}"] .nested-content`
    );
    
    if (!container) {
      console.warn(`⚠️  Container not found for: ${step.path}`);
      return;
    }
    
    // Re-render the nested content
    const data = resolvePath(state.data[step.rowIndex], step.path);
    if (data && typeof data === 'object') {
      const nestedTable = renderNestedTable(data, step.path, step.rowIndex);
      container.innerHTML = '';
      container.appendChild(nestedTable);
      container.style.display = 'block';
      
      // Update toggle button
      const toggle = container.parentElement?.querySelector('.toggle-nest');
      if (toggle) {
        toggle.textContent = '[-]';
      }
      
      console.log(`✅ Rendered nested content for: ${step.path}`);
    }
    
    // Small delay to let DOM update
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
```

### 5. Search Highlighter

#### File: `search-highlighter.js` (NEW FILE)
```javascript
import { state } from './main.js';
import { VisibilityManager } from './visibility-manager.js';

/**
 * Handles highlighting of search results in DOM
 */
export class SearchHighlighter {
  constructor() {
    this.highlightedElements = new Map(); // element -> original HTML
    this.currentHighlight = null;
  }
  
  /**
   * Highlight all visible results
   */
  highlightVisibleResults() {
    this.clearHighlights();
    
    if (!state.searchState.query) return;
    
    const visibleResults = state.searchState.results.filter(result => 
      VisibilityManager.isResultVisible(result)
    );
    
    console.log(`🎨 Highlighting ${visibleResults.length} visible results`);
    
    visibleResults.forEach(result => {
      this._highlightResult(result);
    });
  }
  
  /**
   * Highlight current result with special styling
   */
  highlightCurrentResult() {
    // Remove previous current highlight
    if (this.currentHighlight) {
      this.currentHighlight.classList.remove('highlight-current');
      this.currentHighlight = null;
    }
    
    const currentResult = state.searchState.results[state.searchState.currentIndex];
    if (!currentResult) return;
    
    // Find the highlight span for this result
    const selector = `[data-match-id="${currentResult.id}"]`;
    const span = document.querySelector(selector);
    
    if (span) {
      span.classList.add('highlight-current');
      this.currentHighlight = span;
      
      // Scroll to result
      span.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  
  /**
   * Highlight a single result
   */
  _highlightResult(result) {
    const element = this._findElementForResult(result);
    if (!element) return;
    
    // Store original HTML if not already done
    if (!this.highlightedElements.has(element)) {
      this.highlightedElements.set(element, element.innerHTML);
    }
    
    // Create highlighted version
    const text = this._getElementText(element);
    const highlightedHTML = this._createHighlightedHTML(text, state.searchState.query, result.id);
    
    element.innerHTML = highlightedHTML;
  }
  
  /**
   * Find DOM element for search result
   */
  _findElementForResult(result) {
    const selectors = [
      `tr[data-row-index="${result.rowIndex}"] td[data-path="${result.path}"]`,
      `td[data-path="${result.path}"][data-row-index="${result.rowIndex}"]`,
      `tr[data-row-index="${result.rowIndex}"] td[data-column-path="${result.path}"]`,
      `div[data-row-index="${result.rowIndex}"] td[data-path="${result.path}"]`
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    
    return null;
  }
  
  /**
   * Get clean text content from element
   */
  _getElementText(element) {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentNode;
          if (parent.classList?.contains('promote-button') || 
              parent.classList?.contains('json-path')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let text = '';
    let node;
    while (node = walker.nextNode()) {
      text += node.nodeValue;
    }
    
    return text.trim();
  }
  
  /**
   * Create highlighted HTML
   */
  _createHighlightedHTML(text, query, matchId) {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    let result = '';
    let lastIndex = 0;
    let index = lowerText.indexOf(lowerQuery);
    
    while (index !== -1) {
      // Add text before highlight
      result += this._escapeHtml(text.substring(lastIndex, index));
      
      // Add highlighted text
      const matchText = text.substring(index, index + query.length);
      result += `<span class="highlight" data-match-id="${matchId}">${this._escapeHtml(matchText)}</span>`;
      
      lastIndex = index + query.length;
      index = lowerText.indexOf(lowerQuery, lastIndex);
    }
    
    // Add remaining text
    result += this._escapeHtml(text.substring(lastIndex));
    return result;
  }
  
  /**
   * Clear all highlights
   */
  clearHighlights() {
    this.highlightedElements.forEach((originalHTML, element) => {
      if (element.parentNode) {
        element.innerHTML = originalHTML;
      }
    });
    
    this.highlightedElements.clear();
    this.currentHighlight = null;
  }
  
  /**
   * Escape HTML
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
```

### 6. Main Search Controller

#### File: `search-controller.js` (NEW FILE)
```javascript
import { state } from './main.js';
import { SearchEngine } from './search-engine.js';
import { VisibilityManager } from './visibility-manager.js';
import { PathExpander } from './path-expander.js';
import { SearchHighlighter } from './search-highlighter.js';

/**
 * Main search controller - coordinates all search operations
 */
export class SearchController {
  constructor() {
    this.highlighter = new SearchHighlighter();
  }
  
  /**
   * Perform search
   */
  async performSearch(query) {
    console.log(`🔍 Searching for: "${query}"`);
    
    // Update state
    state.searchState.query = query.trim();
    state.searchState.currentIndex = -1;
    
    if (!state.searchState.query) {
      state.searchState.results = [];
      this.highlighter.clearHighlights();
      this._updateCounter();
      return;
    }
    
    // Search data
    state.searchState.results = SearchEngine.search(state.searchState.query);
    
    console.log(`📊 Found ${state.searchState.results.length} total results`);
    
    // Highlight visible results immediately
    this.highlighter.highlightVisibleResults();
    
    // Update counter
    this._updateCounter();
    
    // Navigate to first result
    if (state.searchState.results.length > 0) {
      await this.navigateToResult(0);
    }
  }
  
  /**
   * Navigate to specific result
   */
  async navigateToResult(index) {
    if (index < 0 || index >= state.searchState.results.length) return;
    
    state.searchState.currentIndex = index;
    const result = state.searchState.results[index];
    
    console.log(`🧭 Navigating to result ${index + 1}: ${result.path}`);
    
    if (VisibilityManager.isResultVisible(result)) {
      // Already visible - just highlight
      this.highlighter.highlightCurrentResult();
    } else {
      // Need expansion
      console.log(`🔧 Result not visible, expanding...`);
      await PathExpander.expandToResult(result);
      
      // Re-highlight all results (new content may be visible)
      this.highlighter.highlightVisibleResults();
      
      // Highlight current
      this.highlighter.highlightCurrentResult();
    }
    
    this._updateCounter();
  }
  
  /**
   * Navigate to next result
   */
  async navigateNext() {
    if (state.searchState.results.length === 0) return;
    
    const nextIndex = (state.searchState.currentIndex + 1) % state.searchState.results.length;
    await this.navigateToResult(nextIndex);
  }
  
  /**
   * Navigate to previous result
   */
  async navigatePrevious() {
    if (state.searchState.results.length === 0) return;
    
    const prevIndex = (state.searchState.currentIndex - 1 + state.searchState.results.length) % state.searchState.results.length;
    await this.navigateToResult(prevIndex);
  }
  
  /**
   * Clear search
   */
  clearSearch() {
    state.searchState.query = '';
    state.searchState.results = [];
    state.searchState.currentIndex = -1;
    
    this.highlighter.clearHighlights();
    this._updateCounter();
  }
  
  /**
   * Re-apply search after table changes
   */
  reapplySearch() {
    if (state.searchState.query) {
      this.highlighter.highlightVisibleResults();
      if (state.searchState.currentIndex >= 0) {
        this.highlighter.highlightCurrentResult();
      }
    }
  }
  
  /**
   * Update search counter display
   */
  _updateCounter() {
    const counter = document.getElementById('search-counter');
    if (!counter) return;
    
    const total = state.searchState.results.length;
    const current = state.searchState.currentIndex >= 0 ? state.searchState.currentIndex + 1 : 0;
    
    // Count visible results
    const visible = state.searchState.results.filter(result => 
      VisibilityManager.isResultVisible(result)
    ).length;
    
    const hidden = total - visible;
    
    let text = `${current} of ${total}`;
    if (hidden > 0) {
      text += ` (${hidden} hidden)`;
    }
    
    counter.textContent = text;
  }
}

// Global instance
let searchController = null;

/**
 * Initialize search system
 */
export function initializeSearch() {
  searchController = new SearchController();
  console.log('🚀 State-driven search initialized');
  return searchController;
}

/**
 * Public API functions
 */
export function performSearch(query) {
  if (!searchController) searchController = initializeSearch();
  return searchController.performSearch(query);
}

export function navigateSearch(direction) {
  if (!searchController) return;
  
  if (direction === 'next') {
    return searchController.navigateNext();
  } else if (direction === 'prev') {
    return searchController.navigatePrevious();
  }
}

export function clearSearch() {
  if (!searchController) return;
  searchController.clearSearch();
}

export function reapplySearch() {
  if (!searchController) return;
  searchController.reapplySearch();
}
```

### 7. Integration Changes

#### File: `ui.js`
```javascript
// REPLACE existing search imports:
// OLD: import { performSearch, navigateSearch, applySearchHighlightsToNewContent } from './search.js';
// NEW:
import { performSearch, navigateSearch, clearSearch, reapplySearch } from './search-controller.js';

// REPLACE in initializeSearchUI function:
function initializeSearchUI() {
  const searchBox = document.getElementById('search-box');
  const searchButton = document.getElementById('search-button');
  const searchNext = document.getElementById('search-next');
  const searchPrev = document.getElementById('search-prev');

  if (searchBox) {
    searchBox.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const query = searchBox.value.trim();
        performSearch(query);
      }
    });

    searchBox.addEventListener('input', (event) => {
      const query = event.target.value.trim();
      if (query === '') {
        clearSearch();
      }
    });
  }

  if (searchButton) {
    searchButton.addEventListener('click', () => {
      const query = searchBox?.value.trim() || '';
      performSearch(query);
    });
  }

  if (searchNext) {
    searchNext.addEventListener('click', () => {
      navigateSearch('next');
    });
  }

  if (searchPrev) {
    searchPrev.addEventListener('click', () => {
      navigateSearch('prev');
    });
  }
}

// REPLACE all instances of applySearchHighlightsToNewContent() with:
// reapplySearch();
```

#### File: `TableRenderer.js`
```javascript
// ADD import:
import { reapplySearch } from './search-controller.js';

// REPLACE all instances of:
// OLD: applySearchHighlightsToNewContent()
// NEW: reapplySearch()

// This affects functions like:
// - renderTable() (at the end)
// - promoteField() (at the end)  
// - demoteField() (at the end)
// - renderBodyOnly() (at the end)
```

### 8. File Deletions

#### Remove These Files:
- `search.js` (replaced by new modular files)
- Any existing search-related files that are no longer needed

### 9. CSS Updates

#### File: `styles.css`
```css
/* ADD: Enhanced current highlight styling */
.highlight-current {
  box-shadow: 0 0 0 2px #ffcc00 inset !important;
  animation: pulse-highlight 1s ease-in-out;
}

@keyframes pulse-highlight {
  0% { background-color: #fff3b0; }
  50% { background-color: #ffeb3b; }
  100% { background-color: #fff3b0; }
}

/* EXISTING highlight styles remain the same */
.highlight {
  background-color: #ffffcc !important;
}
```

## Testing Plan

### Phase 1: Basic Search
1. Test search finds results in visible columns
2. Test highlighting works correctly
3. Test navigation between visible results
4. Test counter display

### Phase 2: Expansion
1. Test search finds results in collapsed content
2. Test auto-expansion works step by step
3. Test highlighting after expansion
4. Test navigation to expanded results

### Phase 3: Edge Cases
1. Test with deeply nested paths
2. Test with array indices and filters
3. Test multiple results in same nested structure
4. Test search clearing and re-searching

### Phase 4: Integration
1. Test with column promotion/demotion
2. Test with table sorting
3. Test with data refresh
4. Test with expand/collapse all

## Migration Strategy

1. **Phase 1**: Create all new files alongside existing ones
2. **Phase 2**: Update imports in ui.js and TableRenderer.js to use new system
3. **Phase 3**: Test thoroughly with existing functionality
4. **Phase 4**: Remove old search.js file
5. **Phase 5**: Clean up any remaining references

## Rollback Plan

If issues arise, simply:
1. Revert the import changes in ui.js and TableRenderer.js
2. Keep the old search.js file until new system is proven stable
3. The new files don't affect existing functionality until imported

## Success Criteria

✅ Search finds all matches in data (not just visible content)
✅ Auto-expansion works reliably for nested results  
✅ Navigation between results is smooth and predictable
✅ State remains consistent across all operations
✅ Performance is acceptable (no perceptible lag)
✅ No regression in existing table functionality