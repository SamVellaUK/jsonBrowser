import { initializeUI } from './ui.js';
import { renderTable } from './TableRenderer.js';
import { toggleAllNested, toggleJsonPaths } from './ui.js';
import { expandToPath, navigateToPath } from './PathExpander.js';
import { resolvePath, parsePathSegment, expandNestedPath } from './Utils.js';

// Make enhanced functions globally available
window.expandToPath = expandToPath;
window.navigateToPath = navigateToPath;
window.resolvePath = resolvePath;
window.parsePathSegment = parsePathSegment;
window.expandNestedPath = expandNestedPath;

// Enhanced state with filter support
export const state = {
  data: [],
  jsonStructure: {},
  editMode: false,
  showJsonPaths: false,
  ui: { scrollTop: 0 },
  columnState: {
    visibleColumns: [],
    order: [],
  },
  sortState: {
    path: null,
    direction: 'asc'
  },
  search: { matches: [], index: -1, domMatches: [], query: '' },
  // Enhanced: Track filter operations
  filterHistory: [],
  currentFilters: new Map() // path -> { field, value }
};

window.state = state;

export async function fetchData() {
  try {
    const response = await fetch('./JSON Output/samplejson.json');
    let data = await response.json();

    // Limit to the first 100 rows for performance
    state.data = data.slice(0, 100);

    // Auto-populate columns from first row
    const firstRow = state.data[0];
    if (firstRow) {
      const keys = Object.keys(firstRow);
      state.columnState.visibleColumns = keys.map(k => ({
        path: k,
        label: k,
        sourcePath: k
      }));
      state.columnState.order = [...keys];
    }

    return state.data;
  } catch (e) {
    document.getElementById('json-root').textContent = 'Failed to load JSON';
    console.error('Failed to fetch JSON:', e);
    return [];
  }
}

// Enhanced filter management functions
export function addFilter(path, field, value) {
  const filterKey = `${path}[${field}=${value}]`;
  state.currentFilters.set(path, { field, value, filterKey });
  state.filterHistory.push({ path, field, value, timestamp: Date.now() });
  
  console.log('Added filter:', { path, field, value });
  return filterKey;
}

export function removeFilter(path) {
  const removed = state.currentFilters.delete(path);
  console.log('Removed filter for path:', path, removed);
  return removed;
}

export function clearAllFilters() {
  const count = state.currentFilters.size;
  state.currentFilters.clear();
  console.log('Cleared', count, 'filters');
  return count;
}

export function getActiveFilters() {
  return Array.from(state.currentFilters.entries()).map(([path, filter]) => ({
    path,
    ...filter
  }));
}

// Enhanced path validation
export function validateFilterPath(path, field, value) {
  // Try to resolve the filter path against the first few rows
  const testRows = state.data.slice(0, 3);
  
  for (const row of testRows) {
    const arrayValue = resolvePath(row, path);
    if (Array.isArray(arrayValue)) {
      const filtered = arrayValue.find(item => 
        item && typeof item === 'object' && String(item[field]) === String(value)
      );
      if (filtered) {
        return true; // Found at least one match
      }
    }
  }
  
  return false; // No matches found
}

// Enhanced data exploration functions
export function exploreArrayStructure(path, maxSamples = 5) {
  const structures = new Map();
  const sampleCount = Math.min(maxSamples, state.data.length);
  
  for (let i = 0; i < sampleCount; i++) {
    const arrayValue = resolvePath(state.data[i], path);
    if (Array.isArray(arrayValue)) {
      arrayValue.forEach((item, index) => {
        if (item && typeof item === 'object') {
          const keys = Object.keys(item).sort();
          const keySignature = keys.join(',');
          
          if (!structures.has(keySignature)) {
            structures.set(keySignature, {
              keys,
              count: 0,
              sampleValues: {}
            });
          }
          
          const struct = structures.get(keySignature);
          struct.count++;
          
          // Collect sample values for each key
          keys.forEach(key => {
            if (!struct.sampleValues[key]) {
              struct.sampleValues[key] = new Set();
            }
            if (struct.sampleValues[key].size < 3) { // Limit samples
              struct.sampleValues[key].add(String(item[key]));
            }
          });
        }
      });
    }
  }
  
  return Array.from(structures.entries()).map(([signature, data]) => ({
    keySignature: signature,
    ...data,
    sampleValues: Object.fromEntries(
      Object.entries(data.sampleValues).map(([key, values]) => [
        key, Array.from(values)
      ])
    )
  }));
}

// Initialize the application
async function initializeApp() {
  console.log('Initializing enhanced JSON browser...');
  
  const data = await fetchData();
  
  if (data.length > 0) {
    console.log(`Loaded ${data.length} rows of data`);
    
    // Analyze the data structure for filtering capabilities
    const firstRow = data[0];
    const arrayPaths = findArrayPaths(firstRow);
    console.log('Found array paths:', arrayPaths);
    
    renderTable();
    initializeUI();
    
    console.log('Enhanced JSON browser initialized successfully');
  } else {
    console.error('No data loaded');
  }
}

// Helper function to find array paths in the data structure
function findArrayPaths(obj, basePath = '', maxDepth = 3) {
  const arrayPaths = [];
  
  function traverse(current, path, depth) {
    if (depth > maxDepth || !current || typeof current !== 'object') {
      return;
    }
    
    if (Array.isArray(current)) {
      arrayPaths.push(path);
      // Also check first item for nested arrays
      if (current.length > 0 && typeof current[0] === 'object') {
        traverse(current[0], `${path}[0]`, depth + 1);
      }
    } else {
      Object.entries(current).forEach(([key, value]) => {
        const newPath = path ? `${path}.${key}` : key;
        traverse(value, newPath, depth + 1);
      });
    }
  }
  
  traverse(obj, basePath, 0);
  return arrayPaths;
}

// Initialize when DOM is ready
window.addEventListener('DOMContentLoaded', initializeApp);

// Also run fetchData immediately for backward compatibility
fetchData();

// Make fetchJSON() available to the inline onclick in HTML
window.fetchJSON = async function() {
  console.log('Refreshing data...');
  
  // Clear filters when refreshing
  clearAllFilters();
  
  // Re-load the raw data & reset columnState
  await fetchData();

  // Re-draw the table
  renderTable();

  // Re-bind click handlers on the new table
  initializeUI();

  // Collapse all nested sections
  toggleAllNested(false);

  // Hide JSON-path overlays if they were on
  if (state.showJsonPaths) toggleJsonPaths();

  // Clear any search state + UI
  document.getElementById('search-box').value = '';
  document.getElementById('search-counter').textContent = '0 of 0';
  state.search.matches = [];
  state.search.domMatches = [];
  state.search.index = -1;

  // Reset scroll position
  const container = document.getElementById('table-container');
  if (container) container.scrollTop = 0;

  // Ensure the column-chooser modal is closed
  document.getElementById('column-chooser').style.display = 'none';
  
  console.log('Data refresh completed');
};

// Export enhanced functions for global access
window.addFilter = addFilter;
window.removeFilter = removeFilter;
window.clearAllFilters = clearAllFilters;
window.getActiveFilters = getActiveFilters;
window.validateFilterPath = validateFilterPath;
window.exploreArrayStructure = exploreArrayStructure;