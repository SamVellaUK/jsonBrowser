// --- START OF FILE basic.js ---

import { generateSQL } from './sqlGenerator.js';

// Reactive state management
const createReactiveState = (initial) => {
    const listeners = new Set();
    const state = new Proxy(initial, {
      set(target, key, value) {
        const oldValue = target[key];
        if (oldValue !== value) {
          if (key === 'expandedPaths' && value instanceof Set && oldValue instanceof Set) {
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
  const state = createReactiveState({
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
  });

// Focus Management
let previouslyFocusedElement = null;

function openModalFocus(modalElementQuerySelector) {
    previouslyFocusedElement = document.activeElement;
    // Ensure render is complete before focusing
    requestAnimationFrame(() => {
        const modal = document.querySelector(modalElementQuerySelector);
        if (modal) {
            const firstFocusableElement = modal.querySelector(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (firstFocusableElement) {
                firstFocusableElement.focus();
            }
            // Add focus trap event listener
            modal.addEventListener('keydown', trapFocusInModal);
        }
    });
}

function closeModalFocus(modalElementQuerySelector) {
    const modal = document.querySelector(modalElementQuerySelector);
    if (modal) {
        modal.removeEventListener('keydown', trapFocusInModal);
    }
    if (previouslyFocusedElement) {
        previouslyFocusedElement.focus();
        previouslyFocusedElement = null;
    }
}

function trapFocusInModal(e) {
    if (e.key !== 'Tab') return;

    const modal = e.currentTarget; // The modal element itself
    const focusableElements = Array.from(
        modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter(el => el.offsetParent !== null && !el.disabled); // Filter for visible and non-disabled elements

    if (focusableElements.length === 0) return;

    const firstFocusableElement = focusableElements[0];
    const lastFocusableElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) { // Shift + Tab
        if (document.activeElement === firstFocusableElement) {
            lastFocusableElement.focus();
            e.preventDefault();
        }
    } else { // Tab
        if (document.activeElement === lastFocusableElement) {
            firstFocusableElement.focus();
            e.preventDefault();
        }
    }
}
  
  // Utility functions
const escapeStringForDataAttribute = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&') // Escape ampersands
            .replace(/"/g, '"'); // Escape double quotes
};

  const flatten = (obj, prefix = '', result = []) => {
    if (!obj || typeof obj !== 'object') {
      if (prefix) result.push({ path: prefix, value: obj });
      return result;
    }
    
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const arrayPath = prefix ? `${prefix}[${index}]` : `[${index}]`;
        if (item && typeof item === 'object') {
          flatten(item, arrayPath, result);
        } else {
          result.push({ path: arrayPath, value: item });
        }
      });
    } else {
      Object.entries(obj).forEach(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object') {
          flatten(value, path, result);
        } else {
          result.push({ path, value });
        }
      });
    }
    
    return result;
  };

  const getAllObjectPaths = (obj, currentPath = '', allPaths = []) => {
    if (obj && typeof obj === 'object') {
        // Only add the path if it's not the initial empty path (for the root object itself).
        // We are interested in paths *within* the rowData that can be expanded.
        if (currentPath) {
            allPaths.push(currentPath);
        }

        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                const newPath = currentPath ? `${currentPath}[${index}]` : `[${index}]`;
                getAllObjectPaths(item, newPath, allPaths);
            });
        } else {
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    const newPath = currentPath ? `${currentPath}.${key}` : key;
                    getAllObjectPaths(obj[key], newPath, allPaths);
                }
            }
        }
    }
    return allPaths;
  };
  
  const getValue = (obj, path) => {
    if (!obj || !path) return undefined;
    
    try {
        if (!path.includes('.') && !path.includes('[')) {
            return obj[path];
        }

        let processedPath = path.replace(/\[(\d+)\]/g, '.$1'); 
        const pathSegments = processedPath.split('.');
        
        let current = obj;
        const arraySelectorRegex = /^(\w+)\[(.+?)="([^"]*)"\]$/; 

        for (const segment of pathSegments) {
            if (current == null) return undefined;

            const selectorMatch = segment.match(arraySelectorRegex);
            
            if (selectorMatch) {
                const arrayNameInSegment = selectorMatch[1];
                const keyField = selectorMatch[2]; 
                const keyValue = selectorMatch[3].replace(/\\"/g, '"'); 
                
                const arrayItself = current[arrayNameInSegment];
                if (!Array.isArray(arrayItself)) return undefined; 
                
                const foundItem = arrayItself.find(item => item && typeof item === 'object' && String(item[keyField]) === keyValue);
                if (!foundItem) return undefined; 
                current = foundItem; 
            } else {
                current = current[segment];
            }
        }
        return current;
    } catch (e) {
        return undefined;
    }
  };
  
  const highlightText = (text, query, isActive = false) => {
    if (text === null || text === undefined) text = '';
    if (!query) return String(text);
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return String(text).replace(regex, `<span class="highlight ${isActive ? 'current' : ''}">$1</span>`);
  };
  
  const performSearch = (data, query) => {
    if (!query) return [];
    const results = [];
    data.forEach((row, rowIndex) => {
      const flattened = flatten(row); 
      flattened.forEach(({ path, value }) => {
        const strValue = String(value).toLowerCase();
        if (strValue.includes(query.toLowerCase())) {
          results.push({ rowIndex, path, value: String(value) });
        }
      });
    });
    return results;
  };
    
  const scrollToCurrentSearchResult = () => {
    const currentResultElement = document.querySelector('.highlight.current');
    if (currentResultElement) {
      currentResultElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center', 
        inline: 'nearest' 
      });
    }
  };
  
  const expandToResult = (result) => {
    try {
      const pathParts = result.path.replace(/\[(\d+)\]/g, '.$1').split('.');
      let currentPath = '';
      let needsExpandedPathNotify = false;
      
      pathParts.forEach((part, index) => {
        currentPath = index === 0 ? part : `${currentPath}.${part}`;
        const objectPathForExpansion = currentPath.replace(/\.(\d+)(?=\.|$)/g, '[$1]');
        const value = getValue(state.data[result.rowIndex], objectPathForExpansion);
        if (index < pathParts.length - 1 && value && typeof value === 'object') {
          if (!state.expandedPaths.has(`${result.rowIndex}-${objectPathForExpansion}`)) {
              state.expandedPaths.add(`${result.rowIndex}-${objectPathForExpansion}`);
              needsExpandedPathNotify = true;
          }
        }
      });
      
      const finalValue = getValue(state.data[result.rowIndex], result.path);
       if (finalValue && typeof finalValue === 'object' && !state.expandedPaths.has(`${result.rowIndex}-${result.path}`)) {
           state.expandedPaths.add(`${result.rowIndex}-${result.path}`);
           needsExpandedPathNotify = true;
       }
  
      const rootColumn = result.path.split(/[.\[]/)[0];
      let columnChanged = false;
      const newVisibleColumns = [...state.visibleColumns];
  
      if (!newVisibleColumns.includes(result.path) && !newVisibleColumns.includes(rootColumn)) {
          newVisibleColumns.push(rootColumn);
          columnChanged = true;
      }
      
      if (columnChanged) {
          state.visibleColumns = newVisibleColumns; 
      }
  
      if (needsExpandedPathNotify) {
          state.notify('expandedPaths'); 
      }
      
      requestAnimationFrame(scrollToCurrentSearchResult);
  
    } catch (e) {
      console.warn('Error expanding to result:', e);
    }
  };
    
  const renderHeader = () => {
    const hiddenCount = state.searchResults.filter(result => {
        const rootColumn = result.path.split(/[.\[]/)[0];
        return !state.visibleColumns.includes(rootColumn) && !state.visibleColumns.includes(result.path);
      }
    ).length;
  
    return `
      <div class="header">
        <input 
          aria-label="Search JSON content"
          id="json-browser-search-box" 
          type="text" 
          class="search-box" 
          placeholder="Search (Press Enter)" 
          value="${escapeStringForDataAttribute(state.searchQuery)}"
          data-action="search"
        >
        <div class="search-nav">
          <button aria-label="Previous search result" data-action="search-prev" ${state.searchResults.length === 0 ? 'disabled' : ''}>←</button>
          <button aria-label="Next search result" data-action="search-next" ${state.searchResults.length === 0 ? 'disabled' : ''}>→</button>
        </div>
        <div class="controls">
          <button data-action="expand-all">Expand All</button>
          <button data-action="collapse-all">Collapse All</button>
          <button data-action="toggle-paths" class="${state.showPaths ? 'active' : ''}">
            Paths
          </button>
          <button data-action="toggle-edit-mode" class="${state.editModeActive ? 'active' : ''}">
            ${state.editModeActive ? 'Done Editing' : 'Edit Mode'}
          </button>
          <button data-action="show-sql">SQL</button>
          <button data-action="show-json">View/Edit Data</button>
        </div>
        <div class="search-info" role="status" aria-live="polite" aria-atomic="true">
          ${state.searchResults.length > 0 
            ? `${state.currentSearchIndex + 1} of ${state.searchResults.length}${hiddenCount > 0 ? `<span class="hidden-indicator">(${hiddenCount} hidden)</span>` : ''}` 
            : state.searchQuery && state.searchResults.length === 0 ? 'No matches' : `${state.data.length} rows`}
        </div>
      </div>
    `;
  };
  
  const renderCell = (value, path, rowIndex, isNestedCall = false) => {
    const isExpandable = value && typeof value === 'object';
    const expandKey = `${rowIndex}-${path}`;
    const isExpanded = state.expandedPaths.has(expandKey);
    
    let displayValue = (value === null || value === undefined) ? '' : String(value);
    if (isExpandable) {
        displayValue = Array.isArray(value) 
            ? `Array(${value.length})` 
            : `Object(${Object.keys(value).length})`;
    }
  
    let cellContent = '';
    
    const currentResult = state.searchResults[state.currentSearchIndex];
    const isCurrentMatchInCell = currentResult &&
      currentResult.rowIndex === rowIndex &&
      currentResult.path === path;

    // Generate a unique ID for aria-controls
    const nestedContentId = `nested-content-${rowIndex}-${path.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  
    if (isExpandable) {
      const nestedDivContent = isExpanded ? renderNestedObject(value, path, rowIndex) : '';
      cellContent = `
        <div 
          class="expandable" 
          data-action="toggle" 
          data-path="${escapeStringForDataAttribute(path)}" 
          data-row="${rowIndex}"
          role="button"
          tabindex="0"
          aria-expanded="${isExpanded ? 'true' : 'false'}"
          aria-controls="${nestedContentId}">
          <span class="toggle" aria-hidden="true">${isExpanded ? '−' : '+'}</span>
          ${highlightText(displayValue, state.searchQuery, isCurrentMatchInCell && !isExpanded)}
        </div>
        <div class="nested ${isExpanded ? 'expanded' : ''}" id="${nestedContentId}" data-parent-path="${escapeStringForDataAttribute(path)}" data-row-index-for-nested="${rowIndex}">
          ${nestedDivContent}
        </div>
      `;
    } else { 
      let promoteButtonHtml = '';
      const isPrimitive = value !== null && value !== undefined && typeof value !== 'object';
      if (state.editModeActive && isPrimitive && isNestedCall) { 
        promoteButtonHtml = `
          <button 
            class="promote-btn" 
            data-action="promote-value" 
            data-path-to-value="${escapeStringForDataAttribute(path)}" 
            data-row-index="${rowIndex}"
            aria-label="Promote '${escapeStringForDataAttribute(path)}' to column"
            title="Promote '${escapeStringForDataAttribute(path)}' to column"
          >+</button>`;
      }
      cellContent = highlightText(displayValue, state.searchQuery, isCurrentMatchInCell) + promoteButtonHtml;
    }
    
    const pathDisplay = state.showPaths ? `<div class="path-display">${path}</div>` : '';
    
    if (!isNestedCall) {
        return `<td class="${path === 'id' ? 'col-id' : ''}"><div>${cellContent}</div>${pathDisplay}</td>`;
    }
    return `<div>${cellContent}</div>`; 
  };
  
  const renderNestedObject = (obj, basePath, rowIndex) => {
    if (!obj || typeof obj !== 'object') {
      const currentResult = state.searchResults[state.currentSearchIndex];
      const isCurrentMatch = currentResult && 
        currentResult.rowIndex === rowIndex && 
        currentResult.path === basePath;
      
      let promoteButtonHtml = '';
      const isPrimitive = obj !== null && obj !== undefined && typeof obj !== 'object';
      if (state.editModeActive && isPrimitive) { 
        promoteButtonHtml = `
          <button 
            class="promote-btn" 
            data-action="promote-value" 
            data-path-to-value="${escapeStringForDataAttribute(basePath)}" 
            data-row-index="${rowIndex}"
            aria-label="Promote '${escapeStringForDataAttribute(basePath)}' to column"
            title="Promote '${escapeStringForDataAttribute(basePath)}' to column"
          >+</button>`;
      }
      return `<div>${highlightText(String(obj || ''), state.searchQuery, isCurrentMatch)}${promoteButtonHtml}</div>`;
    }
    
    let rows = '';
    let tableHtml = '';

    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        return '<div><i>(empty array)</i></div>';
      }

      const firstItem = obj[0];
      let isArrayOfObjects = typeof firstItem === 'object' && firstItem !== null && !Array.isArray(firstItem);

      if (isArrayOfObjects) {
        const columnKeys = new Set();
        const sampleSize = Math.min(obj.length, 10); 
        for (let i = 0; i < sampleSize; i++) {
            if (typeof obj[i] === 'object' && obj[i] !== null && !Array.isArray(obj[i])) {
                Object.keys(obj[i]).forEach(key => columnKeys.add(key));
            }
        }
        if (columnKeys.size === 0) {
             if (obj.every(item => typeof item === 'object' && item !== null && !Array.isArray(item) && Object.keys(item).length === 0)) {
                isArrayOfObjects = false; 
             } else {
                isArrayOfObjects = false;
             }
        }
        
        if (isArrayOfObjects) { 
            const headers = Array.from(columnKeys).sort(); 

            let headerRow = '<tr>'; 
            headers.forEach(header => {
                const currentResult = state.searchResults[state.currentSearchIndex];
                const isHeaderMatch = currentResult && state.searchQuery &&
                                    header.toLowerCase().includes(state.searchQuery.toLowerCase()) &&
                                    currentResult.path.startsWith(basePath);
                headerRow += `<th>${highlightText(header, state.searchQuery, isHeaderMatch)}</th>`;
            });
            headerRow += '</tr>';

            let bodyRows = obj.map((item, index) => {
                const itemBasePath = `${basePath}[${index}]`;
                let rowCells = ``; 

                if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                    headers.forEach(key => {
                        const cellPath = `${itemBasePath}.${key}`;
                        const cellContent = renderCell(item[key], cellPath, rowIndex, true); 
                        const pathDisplay = state.showPaths ? `<div class="path-display">${cellPath}</div>` : '';
                        rowCells += `<td>${cellContent}${pathDisplay}</td>`;
                    });
                } else { 
                    const cellContent = renderCell(item, itemBasePath, rowIndex, true);
                    const pathDisplay = state.showPaths ? `<div class="path-display">${itemBasePath}</div>` : '';
                    rowCells += `<td colspan="${headers.length}">${cellContent}${pathDisplay}</td>`;
                }
                return `<tr>${rowCells}</tr>`;
            }).join('');
            tableHtml = `<table class="nested-table"><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>`;
        }
      } 
      
      if (!isArrayOfObjects) { 
        rows = obj.map((item, index) => {
          const itemPath = `${basePath}[${index}]`;
          const itemContent = renderCell(item, itemPath, rowIndex, true); 
          const pathDisplay = state.showPaths ? `<div class="path-display">${itemPath}</div>` : '';
          return `
            <tr>
              <td class="row-number">[${index}]</td>
              <td>${itemContent}${pathDisplay}</td> 
            </tr>
          `;
        }).join('');
        tableHtml = `<table class="nested-table"><tbody>${rows}</tbody></table>`;
      }
    } else {  
        rows = Object.entries(obj).map(([key, value]) => {
          const itemPath = `${basePath}.${key}`;
          const valueContent = renderCell(value, itemPath, rowIndex, true); 
          const pathDisplay = state.showPaths ? `<div class="path-display">${itemPath}</div>` : '';
          const currentResult = state.searchResults[state.currentSearchIndex];
          const isKeyMatch = currentResult && state.searchQuery &&
            key.toLowerCase().includes(state.searchQuery.toLowerCase()) && 
            currentResult.path.startsWith(basePath);
        return `
            <tr>
              <td><div><strong>${highlightText(key, state.searchQuery, isKeyMatch)}</strong></div></td>
              <td>${valueContent}${pathDisplay}</td>
            </tr>
        `;
        }).join('');
        tableHtml = `<table class="nested-table"><tbody>${rows}</tbody></table>`;
    }
    return tableHtml;
  };
  
  const renderTable = () => {
    if (state.data.length === 0 && !state.showJsonModal) { // Don't show "No data" if modal is open for input
      return '<div class="no-results" role="status" aria-live="polite">No data available. Click "View/Edit Data" to load or paste data.</div>';
    }
    if (state.data.length === 0 && state.showJsonModal) {
        return ''; // Don't render table if modal is open and data is empty
    }
  
    const sortedData = [...state.data];
    if (state.sortBy) {
      sortedData.sort((a, b) => {
        const aVal = getValue(a, state.sortBy);
        const bVal = getValue(b, state.sortBy);
        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            comparison = aVal - bVal;
        } else if (typeof aVal === 'string' && typeof bVal === 'string') {
            comparison = aVal.localeCompare(bVal);
        } else {
            comparison = String(aVal).localeCompare(String(bVal));
        }
        return state.sortDirection === 'asc' ? comparison : -comparison;
      });
    }
  
    return `
      <div class="json-table">
        <table>
          <thead>
            <tr>
              <th class="row-number"><div>#</div></th>
              ${state.visibleColumns.map(col => {
                let removeButtonHtml = '';
                const draggableAttribute = state.editModeActive ? 'draggable="true"' : '';
                const thStyles = state.editModeActive ? 'cursor: grab;' : '';

                if (state.editModeActive) {
                    removeButtonHtml = `
                      <button 
                          class="remove-col-btn-header" 
                          data-action="remove-column-header" 
                          data-column="${encodeURIComponent(col)}"
                          aria-label="Remove column '${escapeStringForDataAttribute(col)}'" 
                          title="Remove column '${escapeStringForDataAttribute(col)}'" 
                      >−</button>`;
                }
                return `
                <th 
                  role="button"
                  tabindex="0"
                  data-action="sort" 
                  data-column="${encodeURIComponent(col)}" 
                  class="${state.sortBy === col ? `sorted ${state.sortDirection}` : ''} ${col.toLowerCase() === 'id' ? 'col-id' : ''}"
                  ${draggableAttribute}
                  style="${thStyles}"
                  aria-sort="${state.sortBy === col ? (state.sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}"
                >
                  <div>
                    ${col}
                    ${removeButtonHtml}
                  </div>
                  ${state.showPaths ? `<div class="path-display">${col}</div>` : ''}
                </th>
              `}).join('')}
            </tr>
          </thead>
          <tbody>
            ${sortedData.map((row, index) => {
              const originalRowIndex = state.data.indexOf(row); 
              return `
              <tr>
                <td class="row-number"><div>${index + 1}</div></td>
                ${state.visibleColumns.map(col => 
                  renderCell(getValue(row, col), col, originalRowIndex, false) 
                ).join('')}
              </tr>
            `}).join('')}
          </tbody>
        </table>
      </div>
    `;
  };
    
  const renderSqlModal = () => {
    if (!state.showSqlModal) return '';
    return `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="sql-modal-title">
        <div id="sql-modal-content-wrapper" class="modal-content" style="width: 900px;">
          <div class="modal-header">
            <h3 id="sql-modal-title">Generated SQL</h3>
            <div>
              <select data-action="change-dialect" style="margin-right: 10px;">
                <option value="snowflake" ${state.sqlDialect === 'snowflake' ? 'selected' : ''}>Snowflake</option>
                <option value="postgresql" ${state.sqlDialect === 'postgresql' ? 'selected' : ''}>PostgreSQL</option>
              </select>
              <button data-action="copy-sql" style="margin-right: 10px;">Copy</button>
              <button class="close-btn" data-action="close-sql" aria-label="Close SQL modal">×</button>
            </div>
          </div>
          <textarea class="sql-output" readonly>${generateSQL(state.visibleColumns, state.sqlDialect)}</textarea>
        </div>
      </div>
    `;
  };

  const renderJsonModal = () => {
    if (!state.showJsonModal) return '';
    return `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="json-modal-title">
        <div id="json-modal-content" class="modal-content" style="width: 900px; height: 80vh; display: flex; flex-direction: column;">
          <div class="modal-header">
            <h3 id="json-modal-title">Raw Data (JSON, CSV, TSV)</h3>
            <button class="close-btn" data-action="close-json" aria-label="Close raw data modal">×</button>
          </div>
          <textarea 
              id="json-edit-area" 
              class="json-edit-output" 
              aria-label="Raw JSON, CSV, or TSV editor"
              style="flex-grow: 1; width: 100%; resize: none; margin-bottom: 10px; font-family: 'Consolas', monospace;"
              placeholder="Paste JSON, CSV, or TSV data here, or load from file."
          >${state.rawJsonEditContent}</textarea>
          <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding-top:10px; border-top: 1px solid #eee;">
            <div class="json-modal-actions-left">
              <input type="file" id="json-file-input" accept=".json,.csv,.tsv,.txt" style="display: none;">
              <button data-action="trigger-file-load" style="margin-right: 10px;">Load File</button>
              <button data-action="select-all-json" style="margin-right: 10px;">Select All</button>
              <button data-action="copy-json" style="margin-right: 10px;">Copy</button>
              <button data-action="clear-json" style="margin-right: 10px;">Clear</button>
              <button data-action="validate-json">Validate JSON</button>
            </div>
            <div class="json-modal-actions-right">
                <button data-action="apply-json-changes" style="margin-left: 10px; background-color: #28a745; color:white; border:none; padding: 8px 12px; border-radius:4px; cursor:pointer;">Apply & Close</button>
            </div>
          </div>
           <span class="json-validation-status" role="status" aria-live="polite" aria-atomic="true" style="font-size: 12px; min-height: 1.2em; margin-top: 5px; text-align: right;">${state.jsonValidationMessage}</span>
        </div>
      </div>
    `;
  };

  const renderPromoteKeyPopover = () => {
    if (!state.showPromoteKeyPopover || !state.promoteKeyPopoverContext) {
        return '';
    }

    const {
        targetElementRect,
        pathToArrayElement, 
        valueFieldName,     
        siblingKeysAndValues
    } = state.promoteKeyPopoverContext;

    const popoverTop = targetElementRect.bottom + window.scrollY + 5;
    const popoverLeft = targetElementRect.left + window.scrollX;

    const popoverStyle = `
        position: absolute;
        top: ${popoverTop}px;
        left: ${popoverLeft}px;
        background-color: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 10px;
        z-index: 1050; 
        box-shadow: 0 2px 10px rgba(0,0,0,0.15);
        font-size: 0.9em;
        min-width: 200px;
    `;

    const arrayName = pathToArrayElement.substring(0, pathToArrayElement.lastIndexOf('['));
    const itemIdentifierInArray = pathToArrayElement.substring(pathToArrayElement.lastIndexOf('['));


    let content = `<div style="margin-bottom: 8px; font-weight: bold;">Promote field: <code>${valueFieldName}</code></div>`;
    content += `<div style="margin-bottom: 8px; font-size: 0.9em;">From item in <code>${arrayName}</code>. Identify this item by:</div>`;
    content += '<ul style="list-style: none; padding: 0; margin: 0;">';

    siblingKeysAndValues.forEach(skv => {
        let displayValue = String(skv.value);
        if (displayValue.length > 25) { 
            displayValue = displayValue.substring(0, 22) + "...";
        }
        content += `
            <li style="margin-bottom: 5px;">
                <button class="promote-popover-btn" data-action="confirm-promote-with-key" data-selected-key="${escapeStringForDataAttribute(skv.key)}">
                    ${skv.key}: "${escapeStringForDataAttribute(displayValue)}"
                </button>
            </li>`;
    });

    content += `
        <li style="margin-bottom: 5px;">
            <button class="promote-popover-btn" data-action="confirm-promote-with-key" data-selected-key="INDEX">
                Original position (<code>${itemIdentifierInArray}</code>)
            </button>
        </li>
    `;
    content += `
        <li style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 8px;">
            <button class="promote-popover-btn promote-popover-cancel-btn" data-action="cancel-promote-popover">Cancel</button>
        </li>
    `;
    content += '</ul>';

    return `<div class="promote-key-popover" style="${popoverStyle}">${content}</div>`;
  };

// Drag-and-drop state
let dragSourceElement = null;

// Drag-and-Drop Handlers for Column Reordering
function handleThDragStart(e) {
    if (!state.editModeActive) return;
    // `this` is the TH element
    this.classList.add('dragging');
    dragSourceElement = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.column); // dataset.column is already URI encoded
}

function handleThDragOver(e) {
    if (!state.editModeActive || !dragSourceElement) return;
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
    if (this !== dragSourceElement) { // `this` is the potential drop target
        this.classList.add('drag-over');
    }
    return false;
}

function handleThDragEnter(e) {
    if (!state.editModeActive || !dragSourceElement) return;
    e.preventDefault();
    // `this` is the TH element being entered
    if (this !== dragSourceElement) {
        this.classList.add('drag-over');
    }
}

function handleThDragLeave(e) {
    if (!state.editModeActive) return;
    // `this` is the TH element being left
    // Only remove drag-over if not part of the source or if moving to another child (less flickering)
    // A simpler approach: dragend cleans up all .drag-over, or mouse position check.
    // For now, just remove it from the element being left.
    this.classList.remove('drag-over');
}

function handleThDrop(e) {
    if (!state.editModeActive || !dragSourceElement) return;
    e.stopPropagation(); // Stops the browser from redirecting.
    e.preventDefault();  // Ensure drop is handled by us

    // `this` is the drop target TH
    this.classList.remove('drag-over');

    if (dragSourceElement !== this) {
        const sourceColumnEncoded = e.dataTransfer.getData('text/plain');
        const targetColumnEncoded = this.dataset.column;

        const sourceColumn = decodeURIComponent(sourceColumnEncoded);
        const targetColumn = decodeURIComponent(targetColumnEncoded);

        const currentCols = [...state.visibleColumns];
        const sourceIndex = currentCols.indexOf(sourceColumn);
        const targetIndex = currentCols.indexOf(targetColumn);

        if (sourceIndex !== -1 && targetIndex !== -1 && sourceIndex !== targetIndex) {
            const [movedItem] = currentCols.splice(sourceIndex, 1); // Remove item
            currentCols.splice(targetIndex, 0, movedItem);          // Insert item
            state.visibleColumns = currentCols; // This will trigger a re-render
        }
    }
    // dragSourceElement is reset in dragend
    return false;
}

function handleThDragEnd(e) {
    if (!state.editModeActive) return;
    // `this` is the TH element that was dragged
    this.classList.remove('dragging');
    
    // Clean up .drag-over from all th elements in this table head
    const tableHead = this.closest('thead');
    if (tableHead) {
        tableHead.querySelectorAll('th.drag-over').forEach(th => th.classList.remove('drag-over'));
    }
    
    dragSourceElement = null; // Reset the source element
}

  const render = () => {
    const appElement = document.getElementById('app');
    if (!appElement) return;
    
    const activeElement = document.activeElement;
    let activeElementId = activeElement ? activeElement.id : null;
    let selectionStart, selectionEnd;

    if (activeElement && (activeElement.id === 'json-browser-search-box' || activeElement.id === 'json-edit-area')) {
        selectionStart = activeElement.selectionStart;
        selectionEnd = activeElement.selectionEnd;
    }
  
    const jsonTableElement = appElement.querySelector('.json-table');
    let mainScrollLeft = 0;
    let mainScrollTop = 0;
  
    if (jsonTableElement) {
        mainScrollLeft = jsonTableElement.scrollLeft; 
        mainScrollTop = jsonTableElement.scrollTop;
    }
    
    appElement.innerHTML = `
      ${renderHeader()}
      ${renderTable()}
      ${renderSqlModal()} 
      ${renderJsonModal()}
      ${renderPromoteKeyPopover()}
    `;

if (state.showJsonModal) {
    const jsonEditArea = document.getElementById('json-edit-area');
    // Prefer modal content or fallback to textarea. Use the wrapper if available.
    const modalContentElement = document.getElementById('json-modal-content'); 
    const modalContentTarget = modalContentElement || jsonEditArea;
    
    if (modalContentTarget && !modalContentTarget.dataset.dndListenersAttached) {
        modalContentTarget.dataset.dndListenersAttached = 'true';

        const dragOverHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
            modalContentTarget.classList.add('drag-over-active'); // Use class for visual feedback
        };
        const dragLeaveHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            modalContentTarget.classList.remove('drag-over-active');
        };
        const dropHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            modalContentTarget.classList.remove('drag-over-active');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                const reader = new FileReader();
                reader.onload = (loadEvent) => {
                    state.rawJsonEditContent = loadEvent.target.result;
                    state.jsonValidationMessage = 'File dropped. Validate or Apply & Close.';
                    // If jsonEditArea is different from modalContentTarget, update its value too
                    if (jsonEditArea) jsonEditArea.value = state.rawJsonEditContent;
                };
                reader.onerror = () => {
                    state.jsonValidationMessage = '<span style="color: red;">Error reading dropped file.</span>';
                };
                reader.readAsText(file);
            }
        };

        modalContentTarget.addEventListener('dragover', dragOverHandler);
        modalContentTarget.addEventListener('dragleave', dragLeaveHandler);
        modalContentTarget.addEventListener('drop', dropHandler);

        // Store handlers to remove them later if needed, though re-rendering usually handles this
        modalContentTarget._dndHandlers = { dragOverHandler, dragLeaveHandler, dropHandler };
    }
} else {
    // Clean up if modal is not shown but listeners might have been attached
    const modalContentTarget = document.getElementById('json-modal-content') || document.getElementById('json-edit-area');
    if (modalContentTarget && modalContentTarget.dataset.dndListenersAttached) {
        if (modalContentTarget._dndHandlers) {
            modalContentTarget.removeEventListener('dragover', modalContentTarget._dndHandlers.dragOverHandler);
            modalContentTarget.removeEventListener('dragleave', modalContentTarget._dndHandlers.dragLeaveHandler);
            modalContentTarget.removeEventListener('drop', modalContentTarget._dndHandlers.dropHandler);
            delete modalContentTarget._dndHandlers;
        }
        delete modalContentTarget.dataset.dndListenersAttached;
        modalContentTarget.classList.remove('drag-over-active');
    }
}
  
    const newJsonTableElement = appElement.querySelector('.json-table');
    if (newJsonTableElement) {
        if (mainScrollTop !== undefined) newJsonTableElement.scrollTop = mainScrollTop;
        if (mainScrollLeft !== undefined) newJsonTableElement.scrollLeft = mainScrollLeft; 
    }

    // Add drag-and-drop listeners for column reordering if in edit mode
    if (state.editModeActive) {
        const thElements = appElement.querySelectorAll('table > thead > tr > th[data-column][draggable="true"]');
        thElements.forEach(th => {
            th.addEventListener('dragstart', handleThDragStart);
            th.addEventListener('dragenter', handleThDragEnter);
            th.addEventListener('dragover', handleThDragOver);
            th.addEventListener('dragleave', handleThDragLeave);
            th.addEventListener('drop', handleThDrop);
            th.addEventListener('dragend', handleThDragEnd);
        });
    }
  
    if (activeElementId) {
        const newActiveElement = document.getElementById(activeElementId);
        if (newActiveElement && document.activeElement !== newActiveElement) { // Avoid re-focusing if already focused
            newActiveElement.focus();
            if ((activeElementId === 'json-browser-search-box' || activeElementId === 'json-edit-area') && 
                selectionStart !== undefined && selectionEnd !== undefined) {
                try {
                    newActiveElement.setSelectionRange(selectionStart, selectionEnd);
                } catch (ex) { /* ignore */ }
            }
        }
    }
    if (state.showJsonModal) {
        const jsonEditArea = document.getElementById('json-edit-area');
        if (jsonEditArea && jsonEditArea.value !== state.rawJsonEditContent) {
            jsonEditArea.value = state.rawJsonEditContent; 
            if (activeElementId === 'json-edit-area' && newActiveElement === jsonEditArea) {
                 try {
                    jsonEditArea.setSelectionRange(selectionStart, selectionEnd);
                } catch (ex) {/* ignore */}
            }
        }
    }
  };
  

  
  const handleKeyboard = (e) => {
    const searchBoxFocused = e.target.matches('.search-box') || e.target.id === 'json-browser-search-box';
    const jsonEditAreaFocused = e.target.id === 'json-edit-area';
    const inModal = e.target.closest('.modal');
  
    if (searchBoxFocused) {
      if (e.key === 'Enter') {
        e.preventDefault(); 
        if (state.searchQuery !== e.target.value) {
             state.searchQuery = e.target.value;
        }
        
        if (state.searchQuery.trim() === '') {
            state.searchResults = [];
            state.currentSearchIndex = -1;
            return;
        }
  
        state.searchResults = performSearch(state.data, state.searchQuery);
        state.currentSearchIndex = state.searchResults.length > 0 ? 0 : -1;
        
        if (state.searchResults.length > 0) {
            expandToResult(state.searchResults[state.currentSearchIndex]); 
        }
      } else if (e.key === 'Escape') {
        e.preventDefault(); 
        state.searchQuery = '';
        e.target.value = ''; 
        state.searchResults = [];
        state.currentSearchIndex = -1;
      }
    }
    
    if (e.key === 'Escape') {
        if (state.showPromoteKeyPopover) {
            e.preventDefault();
            state.showPromoteKeyPopover = false;
            state.promoteKeyPopoverContext = null;
        } else if (state.showSqlModal && inModal) {
            e.preventDefault();
            closeModalFocus('.modal[aria-labelledby="sql-modal-title"]');
            state.showSqlModal = false;
        } else if (state.showJsonModal && inModal && !jsonEditAreaFocused) { // Allow Esc in textarea
            e.preventDefault();
            closeModalFocus('.modal[aria-labelledby="json-modal-title"]');
            state.showJsonModal = false;
            state.jsonValidationMessage = '';
        } else if (state.editModeActive && !searchBoxFocused && !jsonEditAreaFocused && !inModal) { 
            e.preventDefault();
            state.editModeActive = false;
        }
    }

    // Keyboard interaction for expand/collapse and sortable headers
    if ((e.key === 'Enter' || e.key === ' ') && 
        (e.target.matches('.expandable[role="button"]') || e.target.matches('th[role="button"]'))) {
        e.preventDefault();
        e.target.click(); // Simulate a click to trigger the existing action
    }
  };


// NEW: Robust CSV Parsing Logic
// Helper to process a single cell's value, attempting JSON parsing if applicable
function processCellValueForRecord(valueString) {
    const trimmedValue = typeof valueString === 'string' ? valueString.trim() : valueString;
    if (typeof trimmedValue === 'string' &&
        ((trimmedValue.startsWith('{') && trimmedValue.endsWith('}')) ||
         (trimmedValue.startsWith('[') && trimmedValue.endsWith(']')))) {
        try {
            return JSON.parse(trimmedValue);
        } catch (e1) {
            try {
                // Attempt to fix common "double quote escaping" issue
                const repairedJSONString = trimmedValue.replace(/""/g, '"');
                return JSON.parse(repairedJSONString);
            } catch (e2) {
                return valueString; // Keep as original string if all parsing fails
            }
        }
    }
    return valueString;
}

function robustParseCSV(csvString, delimiter = '\t') {
    const objects = [];
    let headers = [];
    
    let currentRow = [];
    let currentField = "";
    let inQuotedField = false;
    let i = 0;

    // Normalize line endings to \n and trim whitespace from the whole string
    csvString = csvString.replace(/\r\n?/g, '\n').trim();

    if (csvString === "") {
        return [];
    }

    while (i < csvString.length) {
        const char = csvString[i];

        if (inQuotedField) {
            if (char === '"') {
                // Check for escaped quote ("")
                if (i + 1 < csvString.length && csvString[i + 1] === '"') {
                    currentField += '"';
                    i++; // Consume the second quote of the pair
                } else {
                    // This is a closing quote for the field
                    inQuotedField = false;
                }
            } else {
                currentField += char; // Any character, including newline, is part of the quoted field
            }
        } else { // Not in a quoted field
            if (char === '"') {
                if (currentField === "") { 
                    inQuotedField = true;
                } else {
                    currentField += char; 
                }
            } else if (char === delimiter) {
                currentRow.push(currentField);
                currentField = "";
            } else if (char === '\n') {
                currentRow.push(currentField);
                currentField = "";

                if (headers.length === 0) {
                    headers = currentRow.map(h => h.trim());
                } else {
                    if (currentRow.some(val => val !== undefined && (typeof val === 'string' ? val.trim() !== '' : true))) {
                        const record = {};
                        headers.forEach((header, index) => {
                            const H = header || `_col_${index+1}`;
                            const rawValue = currentRow[index] !== undefined ? currentRow[index] : "";
                            record[H] = processCellValueForRecord(rawValue);
                        });
                        objects.push(record);
                    }
                }
                currentRow = [];
            } else {
                currentField += char;
            }
        }
        i++;
    }

    currentRow.push(currentField); 

    if (currentRow.length > 0) {
        if (headers.length === 0) { 
            headers = currentRow.map(h => h.trim());
        } else {
            if (currentRow.some(val => val !== undefined && (typeof val === 'string' ? val.trim() !== '' : true))) {
                const record = {};
                headers.forEach((header, index) => {
                    const H = header || `_col_${index+1}`;
                    const rawValue = currentRow[index] !== undefined ? currentRow[index] : "";
                    record[H] = processCellValueForRecord(rawValue);
                });
                objects.push(record);
            }
        }
    }
    
    if (headers.length > 0 && headers.every(h => h === '')) {
        console.warn("CSV Warning: All parsed headers are empty. CSV might be malformed or start with an empty line treated as headers.");
    }

    // Store last parsed headers, could be useful for "apply-json-changes"
    robustParseCSV.lastHeaders = headers;
    return objects;
}
robustParseCSV.lastHeaders = []; // Initialize static-like property


// Delimiter detection utility
function detectDelimiter(textSample) {
    if (!textSample || textSample.trim() === '') return ','; // Default for empty or whitespace only
    const firstLineBreak = textSample.indexOf('\n');
    const firstLine = firstLineBreak === -1 ? textSample.trim() : textSample.substring(0, firstLineBreak).trim();

    if (firstLine.length === 0) return ','; // Default if first line is empty after trim

    const delimiters = [
        { char: ',', count: (firstLine.match(/,/g) || []).length },
        { char: '\t', count: (firstLine.match(/\t/g) || []).length },
        { char: '|', count: (firstLine.match(/\|/g) || []).length },
        //{ char: ';', count: (firstLine.match(/;/g) || []).length }
        // Add other potential delimiters here if needed
    ];

    // Filter out delimiters with zero count
    const presentDelimiters = delimiters.filter(d => d.count > 0);

    if (presentDelimiters.length === 0) {
        // No common delimiters found in the first line.
        // This could be a single column CSV, or not a delimited file.
        // Defaulting to comma; robustParseCSV should handle single columns.
        return ',';
    }

    // Sort by count in descending order
    presentDelimiters.sort((a, b) => b.count - a.count);

    // The delimiter with the highest count is the most likely one.
    // Add a threshold: if the top delimiter count is very low (e.g., 1),
    // it might be less reliable. For simplicity, we'll take the top one for now.
    return presentDelimiters[0].char;
}

const init = async () => {
    try {
      let rawDataInput;
      let dataSuccessfullyLoaded = false;

      if (typeof jsonData !== 'undefined') {
        rawDataInput = jsonData;
        console.log("Global `jsonData` found. Processing...");
      } else {
        console.log("Global `jsonData` not found. Waiting for user input via modal.");
        rawDataInput = null; 
      }

      if (rawDataInput !== null) {
        if (Array.isArray(rawDataInput)) {
            state.data = rawDataInput; 
            dataSuccessfullyLoaded = true;
        } else if (typeof rawDataInput === 'string') {
            let parsedJsonAttempt;
            try {
                parsedJsonAttempt = JSON.parse(rawDataInput);
                if (Array.isArray(parsedJsonAttempt)) {
                    state.data = parsedJsonAttempt;
                } else if (typeof parsedJsonAttempt === 'object' && parsedJsonAttempt !== null) {
                    state.data = [parsedJsonAttempt];
                } else { 
                    const delimiter = detectDelimiter(rawDataInput.substring(0, Math.min(rawDataInput.length, 2000)));
                    console.log(`Initial string data parsed as non-object/array JSON, attempting CSV/TSV parse with delimiter: '${delimiter === '\t' ? '\\t' : delimiter}'`);
                    state.data = robustParseCSV(rawDataInput, delimiter); 
                }
                dataSuccessfullyLoaded = true;
            } catch (e) {
                console.warn("Initial data is a string but not valid JSON. Attempting CSV/TSV parse.");
                const delimiter = detectDelimiter(rawDataInput.substring(0, Math.min(rawDataInput.length, 2000)));
                console.log(`Attempting CSV/TSV parse with delimiter: '${delimiter === '\t' ? '\\t' : delimiter}'`);
                state.data = robustParseCSV(rawDataInput, delimiter); 
                dataSuccessfullyLoaded = true; 
            }
        } else if (typeof rawDataInput === 'object' && rawDataInput !== null) {
            state.data = [rawDataInput];
            dataSuccessfullyLoaded = true;
        }
      }

      if (!dataSuccessfullyLoaded || !Array.isArray(state.data)) {
          state.data = []; 
      }
      
      if (state.data.length === 0 && typeof jsonData === 'undefined') { 
        state.showJsonModal = true;
        state.rawJsonEditContent = '';
        state.jsonValidationMessage = 'Paste JSON, CSV, or TSV data, or load from file.';
      } else if (state.data.length > 0 && typeof state.data[0] === 'object' && state.data[0] !== null) {
         state.visibleColumns = Object.keys(state.data[0]);
      } else { // Data is empty or not array of objects
         state.visibleColumns = robustParseCSV.lastHeaders.length > 0 ? robustParseCSV.lastHeaders : [];
      }
      
      state.subscribe((changedKey) => {
          const wasSqlModalVisible = !!document.querySelector('.modal[aria-labelledby="sql-modal-title"]');
          const wasJsonModalVisible = !!document.querySelector('.modal[aria-labelledby="json-modal-title"]');

          render();

          // Handle opening modals and setting focus
          if (state.showSqlModal && !wasSqlModalVisible) {
              openModalFocus('.modal[aria-labelledby="sql-modal-title"]');
          }
          if (state.showJsonModal && !wasJsonModalVisible) {
              // Check if the active element is already inside the json modal (e.g., textarea from drag/drop)
              const jsonModal = document.querySelector('.modal[aria-labelledby="json-modal-title"]');
              if (!jsonModal || !jsonModal.contains(document.activeElement)) {
                openModalFocus('.modal[aria-labelledby="json-modal-title"]');
              }
          }
      }); 
      
      document.addEventListener('click', handleEvent);

      document.addEventListener('input', (e) => { 
        const target = e.target;
        
        if (target.id === 'json-browser-search-box') {
             if (target.value === '' && state.searchQuery !== '') { 
                state.searchQuery = ''; 
                state.searchResults = [];
                state.currentSearchIndex = -1;
            }
        } else if (target.id === 'json-edit-area') { 
            if (state.rawJsonEditContent !== target.value) {
                state.rawJsonEditContent = target.value;
            }
            if (state.jsonValidationMessage && (state.jsonValidationMessage.includes('red') || state.jsonValidationMessage.includes('green') || state.jsonValidationMessage.startsWith("Paste") || state.jsonValidationMessage.startsWith("File loaded"))) {
                state.jsonValidationMessage = ''; 
            }
        }
      });

      document.addEventListener('change', (e) => { 
        const target = e.target;
        if (target && target.dataset && target.dataset.action === "change-dialect") {
            handleEvent(e);
        } else if (target.id === 'json-file-input') { 
            const file = target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (loadEvent) => {
                    state.rawJsonEditContent = loadEvent.target.result;
                    state.jsonValidationMessage = 'File loaded. Validate JSON or Apply & Close.';
                    target.value = null; 
                };
                reader.onerror = () => {
                    state.jsonValidationMessage = '<span style="color: red;">Error reading file.</span>';
                    target.value = null; 
                };
                reader.readAsText(file);
            }
        }
      });
      document.addEventListener('keydown', handleKeyboard);
      
      render();
      
    } catch (error) {
      console.error('Initialization error:', error);
      const appElement = document.getElementById('app');
      if (appElement) {
        appElement.innerHTML = `
            <div class="no-results" style="color: red; border: 1px solid red; padding: 20px;">
                Error loading or initializing data: ${error.message}<br>
                Please check the console for more details.
            </div>`;
      }
    }
  };
  
  const handleEvent = (e) => {
    const eventTarget = e.target; 
    
    if (state.showPromoteKeyPopover) {
        const popoverElement = document.querySelector('.promote-key-popover');
        const clickedPromoteButton = eventTarget.closest('[data-action="promote-value"]');
        const clickedInsidePopover = popoverElement && popoverElement.contains(eventTarget);

        if (!clickedInsidePopover && !clickedPromoteButton) {
            state.showPromoteKeyPopover = false;
            state.promoteKeyPopoverContext = null;
        }
    }

    let target = eventTarget; 
    let action = target.dataset.action;
  
    if (!action && target.closest('[data-action]')) {
        target = target.closest('[data-action]');
        action = target.dataset.action;
    }
    if (!action) return; 
  
    const { path, row, column } = target.dataset; 
    
    switch (action) {
      case 'search': 
        if (state.searchQuery !== target.value) { 
          state.searchQuery = target.value;
          if (state.searchQuery === '') {
              state.searchResults = [];
              state.currentSearchIndex = -1;
          }
        }
        break;
        
      case 'search-next':
        if (state.searchResults.length > 0) {
          state.currentSearchIndex = (state.currentSearchIndex + 1) % state.searchResults.length;
          const result = state.searchResults[state.currentSearchIndex];
          expandToResult(result); 
        }
        break;
        
      case 'search-prev':
        if (state.searchResults.length > 0) {
          state.currentSearchIndex = (state.currentSearchIndex - 1 + state.searchResults.length) % state.searchResults.length;
          const result = state.searchResults[state.currentSearchIndex];
          expandToResult(result); 
        }
        break;
        
      case 'toggle':
        const expandKey = `${row}-${path}`; 
        if (state.expandedPaths.has(expandKey)) {
          state.expandedPaths.delete(expandKey);
        } else {
          state.expandedPaths.add(expandKey);
        }
        state.notify('expandedPaths'); 
        break;
        
      case 'expand-all':
        state.data.forEach((rowData, rowIndex) => {
          const expandablePaths = getAllObjectPaths(rowData); // Get all paths to objects/arrays
          expandablePaths.forEach(itemPath => {
            state.expandedPaths.add(`${rowIndex}-${itemPath}`);
          });
        });
        state.notify('expandedPaths');
        break;
        
      case 'collapse-all':
        state.expandedPaths.clear();
        state.notify('expandedPaths');
        break;
        
      case 'toggle-paths':
        state.showPaths = !state.showPaths;
        break;

      case 'toggle-edit-mode':
        state.editModeActive = !state.editModeActive;
        if (!state.editModeActive && state.showPromoteKeyPopover) {
            state.showPromoteKeyPopover = false;
            state.promoteKeyPopoverContext = null;
        }
        // If edit mode is toggled, re-render to add/remove draggable attributes and listeners
        // The render() call is already triggered by state change.
        break;

      case 'promote-value':
        const pathClicked = target.dataset.pathToValue; 
        const rowIndexForContext = parseInt(target.dataset.rowIndex);
        const rowData = state.data[rowIndexForContext]; 

        const lastDotIndex = pathClicked.lastIndexOf('.');
        
        if (lastDotIndex === -1) { 
            if (!state.visibleColumns.includes(pathClicked)) {
                state.visibleColumns = [...state.visibleColumns, pathClicked];
            }
            if (state.showPromoteKeyPopover) { 
                state.showPromoteKeyPopover = false;
                state.promoteKeyPopoverContext = null;
            }
            break; 
        }

        const parentObjectPath = pathClicked.substring(0, lastDotIndex); 
        const fieldName = pathClicked.substring(lastDotIndex + 1);      

        const arrayElementMatch = parentObjectPath.match(/^(.*)\[(\d+)\]$/); 

        if (arrayElementMatch) { 
            const pathToArrayElement = parentObjectPath; 
            const objectInArray = getValue(rowData, pathToArrayElement);

            if (objectInArray && typeof objectInArray === 'object' && !Array.isArray(objectInArray)) {
                const siblingKeysAndValues = [];
                for (const key in objectInArray) {
                    const val = objectInArray[key];
                    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
                        siblingKeysAndValues.push({ key, value: val });
                    }
                }

                if (siblingKeysAndValues.length > 0) {
                    state.promoteKeyPopoverContext = {
                        rowIndex: rowIndexForContext,
                        originalPathToValue: pathClicked,    
                        pathToArrayElement: pathToArrayElement, 
                        valueFieldName: fieldName,           
                        targetElementRect: target.getBoundingClientRect(),
                        siblingKeysAndValues
                    };
                    state.showPromoteKeyPopover = true;
                    return; 
                }
            }
        }
        
        if (!state.visibleColumns.includes(pathClicked)) {
            state.visibleColumns = [...state.visibleColumns, pathClicked];
        }
        if (state.showPromoteKeyPopover) { 
            state.showPromoteKeyPopover = false;
            state.promoteKeyPopoverContext = null;
        }
        break;

      case 'confirm-promote-with-key':
        if (!state.promoteKeyPopoverContext) break;

        const {
            rowIndex,
            originalPathToValue, 
            pathToArrayElement,  
            valueFieldName,      
        } = state.promoteKeyPopoverContext;
        
        const selectedKeyForId = target.dataset.selectedKey; 
        const rowDataForPromotion = state.data[rowIndex];
        let pathToPromote;

        if (selectedKeyForId === 'INDEX') {
            pathToPromote = originalPathToValue; 
        } else {
            const arrayBasePath = pathToArrayElement.substring(0, pathToArrayElement.lastIndexOf('[')); 
            const objectInArray = getValue(rowDataForPromotion, pathToArrayElement); 
            
            if (objectInArray && typeof objectInArray === 'object' && objectInArray.hasOwnProperty(selectedKeyForId)) {
                const identifyingKeyValue = String(objectInArray[selectedKeyForId]);
                const safeIdentifyingKeyValue = identifyingKeyValue.replace(/"/g, '\\"'); 
                pathToPromote = `${arrayBasePath}[${selectedKeyForId}="${safeIdentifyingKeyValue}"].${valueFieldName}`;
            } else {
                pathToPromote = originalPathToValue;
                console.warn("Could not find selected key for promotion, falling back to index path.");
            }
        }

        if (!state.visibleColumns.includes(pathToPromote)) {
            state.visibleColumns = [...state.visibleColumns, pathToPromote];
        }

        state.showPromoteKeyPopover = false;
        state.promoteKeyPopoverContext = null;
        break;

      case 'cancel-promote-popover':
        state.showPromoteKeyPopover = false;
        state.promoteKeyPopoverContext = null;
        break;
        
      case 'sort':
          const encodedSortColumn = column; 
          const sortColumn = decodeURIComponent(encodedSortColumn); 
          if (state.sortBy === sortColumn) {
            state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
          } else {
            state.sortBy = sortColumn;
            state.sortDirection = 'asc';
          }
          break;
              
      case 'remove-column-header': 
          const encodedColToRemove = target.dataset.column;
          const colToRemove = decodeURIComponent(encodedColToRemove);
          state.visibleColumns = state.visibleColumns.filter(c => c !== colToRemove);
          if (state.sortBy === colToRemove) {
              state.sortBy = null; 
          }
          break;
        
      case 'show-sql':
        state.showSqlModal = true;
        break;
        
      case 'close-sql':
        closeModalFocus('.modal[aria-labelledby="sql-modal-title"]');
        state.showSqlModal = false;
        break;
        
      case 'change-dialect':
        state.sqlDialect = target.value; 
        break;
        
      case 'copy-sql':
        { 
          const sqlOutputElement = document.querySelector('.sql-output');
          if (sqlOutputElement) {
            navigator.clipboard.writeText(sqlOutputElement.value).then(() => {
              target.textContent = 'Copied!'; 
              setTimeout(() => target.textContent = 'Copy', 2000);
            }).catch(err => {
                console.error('Failed to copy SQL: ', err);
                target.textContent = 'Failed!';
                setTimeout(() => target.textContent = 'Copy', 2000);
            });
          }
        }
        break;

      case 'show-json': 
        if (!state.showJsonModal) { 
          state.rawJsonEditContent = state.data.length > 0 ? JSON.stringify(state.data, null, 2) : '';
          state.jsonValidationMessage = state.data.length === 0 ? 'Paste or load data.' : '';
        }
        state.showJsonModal = true;
        break;
        
      case 'close-json':
        closeModalFocus('.modal[aria-labelledby="json-modal-title"]');
        state.showJsonModal = false;
        state.jsonValidationMessage = ''; 
        break;

      case 'trigger-file-load':
        {
            const fileInput = document.getElementById('json-file-input');
            if (fileInput) fileInput.click();
        }
        break;
        
      case 'clear-json':
        state.rawJsonEditContent = '';
        const jsonEditAreaForClear = document.getElementById('json-edit-area');
        if (jsonEditAreaForClear) jsonEditAreaForClear.value = '';
        state.jsonValidationMessage = 'Paste or load data.';
        break;
      
      case 'select-all-json':
        {
            const jsonEditArea = document.getElementById('json-edit-area');
            if (jsonEditArea) {
                jsonEditArea.focus();
                jsonEditArea.select();
            }
        }
        break;

      case 'copy-json':
        {
            const jsonEditArea = document.getElementById('json-edit-area');
            if (jsonEditArea) {
                navigator.clipboard.writeText(jsonEditArea.value).then(() => {
                    state.jsonValidationMessage = '<span style="color: green;">Copied to clipboard!</span>';
                }).catch(err => {
                    console.error('Failed to copy JSON: ', err);
                    state.jsonValidationMessage = '<span style="color: red;">Failed to copy.</span>';
                });
            }
        }
        break;

      case 'validate-json': 
        try {
          const jsonEditArea = document.getElementById('json-edit-area');
          const currentText = jsonEditArea ? jsonEditArea.value : state.rawJsonEditContent;

          const parsedJson = JSON.parse(currentText);
          state.rawJsonEditContent = JSON.stringify(parsedJson, null, 2); 
          state.jsonValidationMessage = '<span style="color: green;">JSON is valid.</span>';
        } catch (err) {
          state.jsonValidationMessage = `<span style="color: red;">Invalid JSON: ${err.message}</span>`;
        }
        break;

      case 'apply-json-changes':
        {
            const jsonEditArea = document.getElementById('json-edit-area');
            const currentText = jsonEditArea ? jsonEditArea.value : state.rawJsonEditContent; 
            let parsedData = null;
            let parseMethod = '';
            let detectedHeaders = [];

            if (currentText.trim() === '') { 
                parsedData = []; 
                parseMethod = 'empty';
            } else {
                try {
                    const jsonData = JSON.parse(currentText); 
                    if (Array.isArray(jsonData)) {
                        parsedData = jsonData;
                        parseMethod = 'JSON';
                    } else if (typeof jsonData === 'object' && jsonData !== null) {
                        parsedData = [jsonData]; 
                        parseMethod = 'JSON (single object)';
                    }
                } catch (e) {
                    // JSON parse failed, will try CSV/TSV
                }

                if (parsedData === null) {
                    try {
                        const delimiter = detectDelimiter(currentText.substring(0, Math.min(currentText.length, 2000)));
                        const csvObjects = robustParseCSV(currentText, delimiter); 
                        detectedHeaders = robustParseCSV.lastHeaders; // Get headers from the parser
                        
                        if (csvObjects.length > 0 || (detectedHeaders.length > 0 && detectedHeaders.some(h => h !== ''))) {
                           parsedData = csvObjects;
                           parseMethod = delimiter === '\t' ? 'TSV' : 'CSV';
                           if (csvObjects.length === 0 && detectedHeaders.length > 0) {
                               parseMethod += ' (headers only)';
                           }
                        }
                    } catch (csvErr) {
                        console.error("CSV parsing error during apply:", csvErr);
                    }
                }
            }

            if (parsedData !== null) {
                state.data = parsedData;
                closeModalFocus('.modal[aria-labelledby="json-modal-title"]'); // Close focus before state change
                state.showJsonModal = false;
                state.jsonValidationMessage = '';

                if (state.data.length > 0 && typeof state.data[0] === 'object' && state.data[0] !== null) {
                    state.visibleColumns = Object.keys(state.data[0]);
                } else { 
                    state.visibleColumns = detectedHeaders.length > 0 ? detectedHeaders : [];
                }
                state.searchQuery = '';
                state.searchResults = [];
                state.currentSearchIndex = -1;
                state.expandedPaths.clear();
                state.sortBy = null;
                state.notify('data'); // Notify specifically for data change to ensure all dependent states refresh
                console.log(`Data applied successfully using ${parseMethod} parser.`);
            } else {
                state.jsonValidationMessage = '<span style="color: red;">Cannot apply: Invalid data format. Not recognized as JSON, CSV, or TSV.</span>';
            }
        }
        break;
    }
  };

if (typeof jsonData === 'undefined' && (document.readyState === 'loading' || document.readyState === 'interactive')) {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init(); 
}

// --- END OF FILE basic.js ---