// state.js

// Reactive state management
export const createReactiveState = (initial) => {
    const listeners = new Set();
    const state = new Proxy(initial, {
      set(target, key, value) {
        const oldValue = target[key];
        if (oldValue !== value) {
          if ((key === 'expandedPaths' || key === 'allPossibleColumns') && value instanceof Set && oldValue instanceof Set) { // Updated for allPossibleColumns
             if (value.size !== oldValue.size || ![...value].every(item => oldValue.has(item))) {
                target[key] = value;
                listeners.forEach(fn => fn(key, value));
             }
          } else if (key === 'visibleColumns' && Array.isArray(value) && Array.isArray(oldValue)) {
              if (value.length !== oldValue.length || value.some((item, i) => item !== oldValue[i])) {
                  target[key] = value;
                  listeners.forEach(fn => fn(key, value));
              }
          }
          else {
            target[key] = value;
            listeners.forEach(fn => fn(key, value));
          }
        }
        return true;
      }
    });
    
    state.subscribe = (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    };
    
    state.notify = (changedKey = null) => { 
      listeners.forEach(fn => fn(changedKey));
    };
    
    return state;
  };
  
  // Application state
 export const state = createReactiveState({
    data: [],
    searchQuery: '',
    expandedPaths: new Set(),
    visibleColumns: [],
    sortBy: null,
    sortDirection: 'asc',
    showPaths: false,
    searchResults: [],
    currentSearchIndex: -1,
    showSqlModal: false,
    sqlDialect: 'snowflake', // Default to Snowflake
    editModeActive: false,
    showJsonModal: false,       // Controls visibility of the JSON edit modal
    rawJsonEditContent: '',   // Holds the string content of the JSON editor
    jsonValidationMessage: '', // Message for JSON validation status
    showPromoteKeyPopover: false, 
    promoteKeyPopoverContext: null, 
    allPossibleColumns: new Set(),    // NEW: Stores all discovered column paths
    showAddColumnPopover: false,      // NEW: Controls visibility of "Add Column" popover
    addColumnPopoverAnchor: null,     // NEW: Anchor element for "Add Column" popover
    showCsvModal: false,          // Controls visibility of the CSV export modal
    csvOutputContent: '',       // Holds the generated CSV string
  });
