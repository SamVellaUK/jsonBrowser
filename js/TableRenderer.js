import { state } from './main.js';
import { applySearchHighlightsToNewContent, performSearch } from './search.js';
import * as DomUtils from './Utils.js';

/**
 * TableRenderer.js - Core table rendering functionality with enhanced array support
 */

export function renderTable() {
  const container =
    document.getElementById('table-container') ||
    DomUtils.createTableContainer();
  container.innerHTML = '';
  container.classList.toggle('edit-mode', state.editMode);

  const table = DomUtils.createElement('table', { id: 'data-table' });

  const thead = DomUtils.createElement('thead');
  const headRow = DomUtils.createElement('tr');
  headRow.appendChild(DomUtils.createHeaderCell('#'));

  state.columnState.order.forEach((path, colIndex) => {
    const colDef = state.columnState.visibleColumns.find(c => c.path === path);
    const label = colDef?.label || path;
    const th = DomUtils.createHeaderCell(label, {
      dataset: { columnIndex: String(colIndex) }
    });

    if (state.sortState.path === path) {
      th.classList.add(
        state.sortState.direction === 'asc' ? 'sorted-asc' : 'sorted-desc'
      );
    }

    th.addEventListener('click', () => {
      const oldSortPath = state.sortState.path;
      const oldSortDirection = state.sortState.direction;

      if (state.sortState.path === path) {
        state.sortState.direction =
          state.sortState.direction === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortState.path = path;
        state.sortState.direction = 'asc';
      }

      document.querySelectorAll('#data-table > thead > tr > th').forEach(headerCell => {
        if (headerCell !== th) {
            headerCell.classList.remove('sorted-asc', 'sorted-desc');
        }
      });
      th.classList.remove('sorted-asc', 'sorted-desc');
      th.classList.add(
        state.sortState.direction === 'asc' ? 'sorted-asc' : 'sorted-desc'
      );
      
      state.data.sort((a, b) => {
        const va = DomUtils.resolvePath(a, path);
        const vb = DomUtils.resolvePath(b, path);
        return compareValues(va, vb, state.sortState.direction);
      });

      renderBodyOnly(); 
      if (state.search.query) {
        performSearch(state.search.query);
      }
    });

    if (state.showJsonPaths && colDef?.sourcePath && colDef.sourcePath !== path) {
      const shortPath = stripFirstSegment(colDef.sourcePath);
      if (shortPath) {
        const p = DomUtils.createElement('div', { className: 'json-path' }, {
          textContent: shortPath
        });
        th.appendChild(p);
      }
    }
    headRow.appendChild(th);
  });

  thead.appendChild(headRow);
  table.appendChild(thead);
  
  const tbody = DomUtils.createElement('tbody');
  state.data.forEach((rowData, rowIndex) => {
    const tr = DomUtils.createElement('tr', { dataset: { rowIndex: String(rowIndex) } });
    tr.appendChild(DomUtils.createCell(String(rowIndex + 1))); 
    state.columnState.order.forEach(path => {
      const td = DomUtils.createCell(null, {
        dataset: { columnPath: path, rowIndex: String(rowIndex) }
      });
      const value = DomUtils.resolvePath(rowData, path);
      renderCellContent(td, value, path, rowIndex);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  container.appendChild(table);

  if (state.search.query) {
    performSearch(state.search.query);
  } else {
    applySearchHighlightsToNewContent(table); 
  }
}

function compareValues(a, b, dir) {
  if (a == null && b == null) return 0;
  if (a == null) return dir === 'asc' ? -1 : 1;
  if (b == null) return dir === 'asc' ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') {
    return dir === 'asc' ? a - b : b - a;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return dir === 'asc' 
      ? a.localeCompare(b) 
      : b.localeCompare(a);
  }
  const strA = String(a);
  const strB = String(b);
  return dir === 'asc' 
    ? strA.localeCompare(strB) 
    : strB.localeCompare(strA);
}

function renderObjectCell(container, value, path, rowIndex) {
  const nestedContent = DomUtils.createNestedContainer(path, rowIndex);
  const toggle = DomUtils.createToggle(); 
  
  // Make the entire container clickable
  container.style.cursor = 'pointer';
  container.setAttribute('data-expandable', 'true');
  container.setAttribute('data-path', path);
  container.setAttribute('data-row-index', String(rowIndex));
  
  // Enhanced: Check if this is an array and add special attributes
  if (Array.isArray(value)) {
    // Check if this is a structured array (objects with consistent keys)
    const isStructured = value.length > 0 && 
                        typeof value[0] === 'object' && 
                        !Array.isArray(value[0]) &&
                        Object.keys(value[0]).length <= 5;
    
    // Check if this is an array of primitives (strings, numbers, etc.)
    const isPrimitiveArray = value.length > 0 && value.every(item => 
      item === null || (typeof item !== 'object')
    );
    
    if (isStructured) {
      // For structured arrays, we'll use the new table-based filtering
      container.setAttribute('data-is-structured-array', 'true');
      container.setAttribute('data-array-path', path);
      container.title = 'Click to expand';
      
      container.appendChild(toggle);
      container.appendChild(
        document.createTextNode(` [${value.length} items]`)
      );
    } else if (isPrimitiveArray) {
      // For primitive arrays, just make them expandable without context menu
      container.title = 'Click to expand';
      
      container.appendChild(toggle);
      container.appendChild(
        document.createTextNode(` [${value.length} items]`)
      );
    } else {
      // For complex/mixed arrays, keep the context menu system
      container.setAttribute('data-is-array', 'true');
      container.setAttribute('data-array-path', path);
      
      const arrayKeys = extractArrayKeys(value);
      if (arrayKeys.length > 0) {
        container.setAttribute('data-array-keys', arrayKeys.join(','));
        container.title = 'Click to expand | Right-click for array options';
      } else {
        // No keys found, so just make it expandable
        container.title = 'Click to expand';
      }
      
      container.appendChild(toggle);
      container.appendChild(
        document.createTextNode(` [${value.length} items]`)
      );
    }
  } else {
    // Regular object
    container.title = 'Click to expand';
    container.appendChild(toggle);
    container.appendChild(document.createTextNode(' {...}'));
  }
  
  container.appendChild(nestedContent);
}

// New function to extract potential filter keys from array items
function extractArrayKeys(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  
  const keys = new Set();
  
  // Look at first few items to find common keys
  const sampleSize = Math.min(5, arr.length); // Increased sample size
  for (let i = 0; i < sampleSize; i++) {
    const item = arr[i];
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      Object.keys(item).forEach(key => {
        // Only include primitive values as potential filter keys
        const value = item[key];
        if (typeof value !== 'object' || value === null) {
          keys.add(key);
        }
      });
    }
  }
  
  // For your tags example: [{"key": "Environment", "value": "Dev"}, ...]
  // this should extract ["key", "value"]
  
  return Array.from(keys).sort();
}

export function promoteField(fullPath) {
  if (state.columnState.order.includes(fullPath)) return;

  const rootPathSegment = fullPath.match(/[^.[]+/)?.[0] || '';
  const rootColIndexInOrder = state.columnState.order.indexOf(rootPathSegment);
  
  const insertAtInOrderArray = rootColIndexInOrder >= 0 ? rootColIndexInOrder + 1 : state.columnState.order.length;
  
  state.columnState.order.splice(insertAtInOrderArray, 0, fullPath);
  state.columnState.visibleColumns.push({
    path: fullPath,
    label: fullPath.split('.').pop() || fullPath,
    sourcePath: fullPath,
  });

  const table = document.getElementById('data-table'); 
  if (!table) return; 
  
  const headRow = table.querySelector(':scope > thead > tr');
  if (!headRow) return; 

  const columnLabel = fullPath.split('.').pop() || fullPath;
  const th = DomUtils.createHeaderCell(columnLabel, {
    dataset: { columnIndex: String(insertAtInOrderArray) }, 
  });
  
  th.addEventListener('click', () => {
    if (state.sortState.path === fullPath) {
      state.sortState.direction = state.sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortState.path = fullPath;
      state.sortState.direction = 'asc';
    }
    document.querySelectorAll('#data-table > thead > tr > th').forEach(headerCell => {
      if (headerCell !== th) headerCell.classList.remove('sorted-asc', 'sorted-desc');
    });
    th.classList.remove('sorted-asc', 'sorted-desc');
    th.classList.add(state.sortState.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
    state.data.sort((a, b) => {
      const va = DomUtils.resolvePath(a, fullPath);
      const vb = DomUtils.resolvePath(b, fullPath);
      return compareValues(va, vb, state.sortState.direction);
    });
    renderBodyOnly();
    if (state.search.query) {
      performSearch(state.search.query);
    }
  });
  
  if (fullPath.includes('.') || fullPath.includes('[')) { 
    const shortPath = stripFirstSegment(fullPath);
    if (shortPath) { 
        const p = DomUtils.createElement('div', { className: 'json-path' }, { textContent: shortPath });
        th.appendChild(p);
    }
  }

  const domInsertionNodeIndex = insertAtInOrderArray + 1;
  const targetThNode = headRow.children[domInsertionNodeIndex];
  headRow.insertBefore(th, targetThNode);

  const rows = table.querySelectorAll(':scope > tbody > tr');
  rows.forEach((tr) => { 
    const rowIndex = parseInt(tr.dataset.rowIndex, 10);
    if (isNaN(rowIndex)) return; 

    const td = DomUtils.createCell(null, {
      dataset: { columnPath: fullPath, rowIndex: String(rowIndex) }
    });
    const value = DomUtils.resolvePath(state.data[rowIndex], fullPath);
    renderCellContent(td, value, fullPath, rowIndex);
    
    const targetTdNode = tr.children[domInsertionNodeIndex];
    tr.insertBefore(td, targetTdNode);
  });

  if (state.search.query) {
    performSearch(state.search.query);
  } else {
    applySearchHighlightsToNewContent(table);
  }
}

export function demoteField(path) {
  const stateIdx = state.columnState.order.indexOf(path);
  if (stateIdx === -1) return;

  state.columnState.order.splice(stateIdx, 1);
  state.columnState.visibleColumns = state.columnState.visibleColumns.filter(
    c => c.path !== path
  );

  const table = document.getElementById('data-table');
  if (!table) return;
  const headRow = table.querySelector('thead tr');
  const domColIndex = stateIdx + 1;

  const th = headRow.children[domColIndex];
  if (th) headRow.removeChild(th);

  table.querySelectorAll('tbody tr').forEach(tr => {
    const td = tr.children[domColIndex];
    if (td) tr.removeChild(td);
  });

  if (state.search.query) {
    performSearch(state.search.query);
  } else {
    applySearchHighlightsToNewContent(table);
  }
}

function renderBodyOnly() {
  const table = document.getElementById('data-table');
  if (!table) return; 
  
  const oldTbody = table.querySelector('tbody');
  const newTbody = DomUtils.createElement('tbody');

  state.data.forEach((rowData, rowIndex) => {
    const tr = DomUtils.createElement('tr', { dataset: { rowIndex: String(rowIndex) } });
    tr.appendChild(DomUtils.createCell(String(rowIndex + 1)));
    state.columnState.order.forEach(path => {
      const td = DomUtils.createCell(null, {
        dataset: { columnPath: path, rowIndex: String(rowIndex) }
      });
      const value = DomUtils.resolvePath(rowData, path);
      renderCellContent(td, value, path, rowIndex);
      tr.appendChild(td);
    });
    newTbody.appendChild(tr);
  });

  if (oldTbody) {
    table.replaceChild(newTbody, oldTbody);
  } else {
    table.appendChild(newTbody);
  }
}

export function renderCellContent(container, value, path = '', rowIndex = null) {
  container.innerHTML = ''; 
  container.setAttribute('data-path', path);
  if (rowIndex !== null) {
    container.setAttribute('data-row-index', String(rowIndex));
  }

  if (typeof value === 'object' && value !== null) {
    renderObjectCell(container, value, path, rowIndex);
  } else {
    renderScalarCell(container, value, path, rowIndex); 
  }
}

function renderScalarCell(container, value, path, rowIndex) { 
  const text = value != null ? String(value) : ''; 
  container.appendChild(document.createTextNode(text));

  if (path.includes('.') || path.includes('[')) { 
    const promote = DomUtils.createElement(
      'span', { className: 'promote-button', title: 'Promote this field as a top-level column' }, { textContent: '+' }
    );
    promote.addEventListener('click', e => {
      e.stopPropagation();
      promoteField(path);
    });
    container.appendChild(promote);
  }
}

export function renderNestedTable(obj, parentPath = '', rowIndex = null) {
  console.log('renderNestedTable called with:', { obj, parentPath, isArray: Array.isArray(obj) });
  
  const tableAttrs = { className: 'nested-table', dataset: { parentPath: parentPath } };
  if (rowIndex !== null) { tableAttrs.dataset.mainRowIndex = String(rowIndex); }
  const table = DomUtils.createElement('table', tableAttrs);
  
  if (Array.isArray(obj)) {
    console.log('Processing array with length:', obj.length);
    
    // Check if this is an array of objects with consistent structure
    if (obj.length > 0 && typeof obj[0] === 'object' && !Array.isArray(obj[0])) {
      const firstItem = obj[0];
      const allKeys = Object.keys(firstItem);
      console.log('First item keys:', allKeys);
      
      // Check if all items have the same keys (consistent structure)
      const isConsistent = obj.every(item => {
        const hasCorrectStructure = item && typeof item === 'object' && !Array.isArray(item);
        const hasCorrectKeys = Object.keys(item).length === allKeys.length &&
                              allKeys.every(key => key in item);
        console.log('Item check:', { item, hasCorrectStructure, hasCorrectKeys });
        return hasCorrectStructure && hasCorrectKeys;
      });
      
      console.log('Array consistency check:', { isConsistent, keyCount: allKeys.length });
      
      if (isConsistent && allKeys.length <= 5) {
        console.log('✅ Using structured table rendering for array');
        
        // Render as a proper table with column headers
        const thead = DomUtils.createElement('thead');
        const headRow = DomUtils.createElement('tr');
        
        // Add index column
        headRow.appendChild(DomUtils.createHeaderCell('#'));
        
        // Add columns for each key
        allKeys.forEach(key => {
          const th = DomUtils.createHeaderCell(key);
          th.classList.add('filterable-column');
          th.dataset.filterKey = key;
          th.title = `Click to filter by ${key}`;
          th.style.cursor = 'pointer';
          th.style.backgroundColor = '#e3f2fd';
          
          // Add JSON path display for headers if enabled
          if (state.showJsonPaths) {
            const pathDiv = DomUtils.createElement('div', { className: 'json-path' });
            pathDiv.textContent = `${parentPath}[*].${key}`;
            th.appendChild(pathDiv);
          }
          
          headRow.appendChild(th);
        });
        
        thead.appendChild(headRow);
        table.appendChild(thead);
        
        const tbody = DomUtils.createElement('tbody');
        obj.forEach((item, index) => {
          const tr = DomUtils.createElement('tr', { 
            dataset: { arrayIndex: String(index) },
            className: 'structured-array-row'
          });
          
          // Index cell
          const indexCell = DomUtils.createCell(String(index), { dataset: { key: String(index) } });
          
          // Add JSON path for index cell if enabled
          if (state.showJsonPaths) {
            const pathDiv = DomUtils.createElement('div', { className: 'json-path' });
            pathDiv.textContent = `${parentPath}[${index}]`;
            indexCell.appendChild(pathDiv);
          }
          
          tr.appendChild(indexCell);
          
          // Data cells
          allKeys.forEach(key => {
            const itemPath = `${parentPath}[${index}].${key}`;
            const valueCell = DomUtils.createCell(null, { 
              dataset: { 
                path: itemPath, 
                key: key,
                arrayIndex: String(index),
                filterKey: key // Add this for filter selection
              } 
            });
            const value = item[key];
            
            // Add JSON path display if enabled
            if (state.showJsonPaths) {
              const pathDiv = DomUtils.createElement('div', { className: 'json-path' });
              pathDiv.textContent = itemPath;
              valueCell.appendChild(pathDiv);
            }
            
            // Render the cell content
            if (typeof value === 'object' && value !== null) {
              renderCellContent(valueCell, value, itemPath, rowIndex);
            } else {
              const textNode = document.createTextNode(String(value || ''));
              valueCell.appendChild(textNode);
              
              // Add promote button for nested paths - always add it, CSS will control visibility
              if (parentPath) {
                console.log('Adding promote button for:', { parentPath, key, editMode: state.editMode });
                const promote = DomUtils.createElement(
                  'span', 
                  { className: 'promote-button', title: 'Promote this field as a top-level column' }, 
                  { textContent: ' +' }
                );
                promote.style.marginLeft = '6px';
                promote.addEventListener('click', e => {
                  e.stopPropagation();
                  
                  // Build filter-based path instead of index-based path
                  // Find a unique identifier for this row (prefer 'key', 'id', 'name', etc.)
                  const identifierKeys = ['key', 'id', 'name', 'code', 'type', 'uuid'];
                  let filterKey = null;
                  let filterValue = null;
                  
                  // Look for a good identifier field in this item
                  for (const idKey of identifierKeys) {
                    if (idKey in item && typeof item[idKey] !== 'object') {
                      filterKey = idKey;
                      filterValue = String(item[idKey]);
                      break;
                    }
                  }
                  
                  let promotePath;
                  if (filterKey && filterValue) {
                    // Use filter-based path: tags[key=Environment].value
                    promotePath = `${parentPath}[${filterKey}=${filterValue}].${key}`;
                    console.log(`✅ Using filter-based promotion: ${promotePath}`);
                  } else {
                    // Fallback to index-based path if no identifier found
                    promotePath = itemPath;
                    console.log(`⚠️ Falling back to index-based promotion: ${promotePath}`);
                  }
                  
                  promoteField(promotePath);
                });
                valueCell.appendChild(promote);
              }
            }
            
            tr.appendChild(valueCell);
          });
          
          tbody.appendChild(tr);
        });
        
        table.appendChild(tbody);
        
        // Add filter selection functionality
        addFilterSelectionHandlers(table, parentPath, allKeys);
        
        return table;
      } else {
        console.log('❌ Not using structured table - failing consistency or size check');
      }
    } else {
      console.log('❌ Not using structured table - not objects or array is empty');
    }
    
    // Fall back to the old array rendering for inconsistent or simple arrays
    console.log('📋 Using fallback array rendering');
    const tbody = DomUtils.createElement('tbody');
    renderArrayRows(tbody, obj, parentPath, rowIndex);
    table.appendChild(tbody);
  } else {
    console.log('📋 Using object rendering');
    const tbody = DomUtils.createElement('tbody');
    renderObjectRows(tbody, obj, parentPath, rowIndex);
    table.appendChild(tbody);
  }
  
  return table;
}

// New function to add filter selection handlers
function addFilterSelectionHandlers(table, parentPath, availableKeys) {
  let filterState = {
    isSelectingFilter: false,
    selectedKey: null,
    selectedValue: null
  };
  
  // Add click handlers to column headers
  table.querySelectorAll('th.filterable-column').forEach(th => {
    th.addEventListener('click', (e) => {
      e.stopPropagation();
      
      if (filterState.isSelectingFilter) {
        // Cancel previous selection
        table.querySelectorAll('th.filterable-column').forEach(header => {
          header.classList.remove('filter-selected');
        });
      }
      
      filterState.isSelectingFilter = true;
      filterState.selectedKey = th.dataset.filterKey;
      
      // Highlight selected column
      th.classList.add('filter-selected');
      
      // Show instruction
      showFilterInstruction(table, `Now click on a ${filterState.selectedKey} value to filter by...`);
      
      // Add temporary click handlers to value cells in this column
      const columnCells = table.querySelectorAll(`td[data-filter-key="${filterState.selectedKey}"]`);
      columnCells.forEach(cell => {
        cell.classList.add('filter-selectable');
        
        // Get the actual text content for the tooltip
        const textContent = Array.from(cell.childNodes)
          .filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.textContent)
          .join('')
          .trim();
          
        cell.title = `Click to filter by ${filterState.selectedKey}="${textContent}"`;
      });
    });
  });
  
  // Add click handlers to data cells for value selection
  table.addEventListener('click', (e) => {
    if (!filterState.isSelectingFilter) return;
    
    const cell = e.target.closest('td[data-filter-key]');
    if (cell && cell.dataset.filterKey === filterState.selectedKey) {
      e.stopPropagation();
      
      // Get the actual text content, excluding any child elements like promote buttons
      const textContent = Array.from(cell.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent)
        .join('')
        .trim();
      
      filterState.selectedValue = textContent;
      
      // Create the filter path using key=value syntax instead of index
      const filterPath = `${parentPath}[${filterState.selectedKey}=${filterState.selectedValue}]`;
      
      // Apply the filter
      console.log('Creating key-based filter:', filterPath);
      
      // Promote this filtered path as a new column
      promoteField(filterPath);
      
      
      // Clean up
      resetFilterSelection(table, filterState);
      hideFilterInstruction(table);
    }
  });
  
  // Cancel filter selection on clicks outside
  document.addEventListener('click', (e) => {
    if (filterState.isSelectingFilter && !table.contains(e.target)) {
      resetFilterSelection(table, filterState);
      hideFilterInstruction(table);
    }
  });
}

function resetFilterSelection(table, filterState) {
  filterState.isSelectingFilter = false;
  filterState.selectedKey = null;
  filterState.selectedValue = null;
  
  table.querySelectorAll('th.filterable-column').forEach(header => {
    header.classList.remove('filter-selected');
  });
  
  table.querySelectorAll('td').forEach(cell => {
    cell.classList.remove('filter-selectable');
    cell.title = '';
  });
}

function showFilterInstruction(table, message) {
  let instruction = table.parentNode.querySelector('.filter-instruction');
  if (!instruction) {
    instruction = DomUtils.createElement('div', { className: 'filter-instruction' });
    table.parentNode.insertBefore(instruction, table);
  }
  instruction.textContent = message;
  instruction.style.display = 'block';
}

function hideFilterInstruction(table) {
  const instruction = table.parentNode.querySelector('.filter-instruction');
  if (instruction) {
    instruction.style.display = 'none';
  }
}

function renderArrayRows(tbody, arr, parentPath, rowIndex) {
  arr.forEach((item, index) => {
    const itemPath = `${parentPath}[${index}]`;
    const tr = DomUtils.createElement('tr', { dataset: { arrayIndex: String(index) } });
    const keyCell = DomUtils.createCell(String(index), { dataset: { key: String(index) } });
    const displayPath = stripFirstSegment(itemPath);
    if (displayPath) {
      keyCell.appendChild( DomUtils.createElement('div', { className: 'json-path' }, { textContent: displayPath }) );
    }
    const valueCell = DomUtils.createCell(null, { dataset: { path: itemPath } });
    renderCellContent(valueCell, item, itemPath, rowIndex); 
    tr.appendChild(keyCell);
    tr.appendChild(valueCell);
    tbody.appendChild(tr);
  });
}

function renderObjectRows(tbody, obj, parentPath, rowIndex) {
  Object.entries(obj).forEach(([key, val]) => {
    const itemPath = parentPath ? `${parentPath}.${key}` : key;
    const tr = DomUtils.createElement('tr');
    const keyCell = DomUtils.createCell(key, { dataset: { key: key } });
    const displayPath  = stripFirstSegment(itemPath);
    if (displayPath) {
      keyCell.appendChild( DomUtils.createElement('div', { className: 'json-path' }, { textContent: displayPath }) );
    }
    const valueCell = DomUtils.createCell(null, { dataset: { path: itemPath, key: key } });
    renderCellContent(valueCell, val, itemPath, rowIndex); 
    tr.appendChild(keyCell);
    tr.appendChild(valueCell);
    tbody.appendChild(tr);
  });
}

function stripFirstSegment(path) {
  if (!path) return '';
  const dot = path.indexOf('.');
  const bracket = path.indexOf('[');

  if (bracket === 0) {
    const closingBracket = path.indexOf(']');
    if (closingBracket === -1) return '';
    const afterBracket = path.slice(closingBracket + 1);
    return afterBracket.startsWith('.') ? afterBracket.slice(1) : afterBracket;
  }

  let firstSeparatorIndex = -1;
  if (dot !== -1 && bracket !== -1) {
    firstSeparatorIndex = Math.min(dot, bracket);
  } else if (dot !== -1) {
    firstSeparatorIndex = dot;
  } else if (bracket !== -1) {
    firstSeparatorIndex = bracket;
  }

  if (firstSeparatorIndex !== -1) {
    return path.charAt(firstSeparatorIndex) === '.' ? path.slice(firstSeparatorIndex + 1) : path.slice(firstSeparatorIndex);
  }
  return '';
}