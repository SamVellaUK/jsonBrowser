import { state } from './state.js';
import { applySearchHighlightsToNewContent } from './search.js';
import { resolvePath } from './PathUtils.js';
import * as DomUtils from './DomUtils.js';

/**
 * TableRenderer.js - Core table rendering functionality
 */

/**
 * Renders the main data table
 */
export function renderTable() {
  // 1) get & clear container
  const container =
    document.getElementById('table-container') ||
    DomUtils.createTableContainer();
  container.innerHTML = '';

  // 2) build table element
  const table = DomUtils.createElement('table', { id: 'data-table' });

  // —— HEADER ——  
  const thead = DomUtils.createElement('thead');
  const headRow = DomUtils.createElement('tr');

  // 2.1) Identity column (“#”), no sorting
  headRow.appendChild(DomUtils.createHeaderCell('#'));

  // 2.2) Data columns with click-to-sort
  state.columnState.order.forEach((path, colIndex) => {
    const colDef = state.columnState.visibleColumns.find(c => c.path === path);
    const label = colDef?.label || path;
    const th = DomUtils.createHeaderCell(label, {
      dataset: { columnIndex: colIndex }
    });

    // indicate current sort
    if (state.sortState.path === path) {
      th.classList.add(
        state.sortState.direction === 'asc' ? 'sorted-asc' : 'sorted-desc'
      );
    }

    // click handler: toggle or set new sort
    th.addEventListener('click', () => {
      if (state.sortState.path === path) {
        state.sortState.direction =
          state.sortState.direction === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortState.path = path;
        state.sortState.direction = 'asc';
      }

      // sort data in place
      state.data.sort((a, b) => {
        const va = resolvePath(a, path);
        const vb = resolvePath(b, path);
        return compareValues(va, vb, state.sortState.direction);
      });

      // re-render and re-apply highlights
      renderTable();
      applySearchHighlightsToNewContent();
    });

    headRow.appendChild(th);
  });

  thead.appendChild(headRow);
  table.appendChild(thead);

  // —— BODY ——  
  const tbody = DomUtils.createElement('tbody');

  state.data.forEach((rowData, rowIndex) => {
    const tr = DomUtils.createElement('tr', { dataset: { rowIndex } });

    // 3.1) row number cell
    tr.appendChild(DomUtils.createCell(rowIndex + 1));

    // 3.2) data cells
    state.columnState.order.forEach(path => {
      const td = DomUtils.createCell(null, {
        dataset: { columnPath: path, rowIndex }
      });
      const value = resolvePath(rowData, path);
      renderCellContent(td, value, path, rowIndex);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}
// Helper to compare two values (numbers or strings)
function compareValues(a, b, dir) {
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') {
    return dir === 'asc' ? a - b : b - a;
  }
  const sa = String(a).toLowerCase();
  const sb = String(b).toLowerCase();
  if (sa < sb) return dir === 'asc' ? -1 : 1;
  if (sa > sb) return dir === 'asc' ? 1 : -1;
  return 0;
}
/**
 * Renders content inside a table cell
 * @param {HTMLElement} container - Cell container
 * @param {*} value - Value to render
 * @param {string} path - Data path
 * @param {number|null} rowIndex - Row index
 */
export function renderCellContent(container, value, path = '', rowIndex = null) {
  container.setAttribute('data-path', path);
  container.setAttribute('data-column-path', path);
  if (rowIndex !== null) {
    container.setAttribute('data-row-idx', rowIndex);
    container.setAttribute('data-row-index', rowIndex);
  }
  
  if (typeof value === 'object' && value !== null) {
    renderObjectCell(container, value, path, rowIndex);
  } else {
    renderScalarCell(container, value, path);
  }
}

// Update renderObjectCell to include data-toggle
function renderObjectCell(container, value, path, rowIndex) {
  const nestedContent = DomUtils.createNestedContainer(path, rowIndex);
  nestedContent.setAttribute('data-toggle', 'expand');
  
  const toggle = DomUtils.createToggle();
  toggle.setAttribute('data-toggle', 'collapse');
  
  container.appendChild(toggle);
  container.appendChild(document.createTextNode(
    Array.isArray(value) ? '[...]' : '{...}'
  ));
  container.appendChild(nestedContent);
}

/**
 * Renders a scalar (non-object) value in a cell
 * @param {HTMLElement} container - Cell container
 * @param {*} value - Value to render
 * @param {string} path - Data path
 */
function renderScalarCell(container, value, path) {
  const span = DomUtils.createElement('span', {
    dataset: { path }
  }, {
    textContent: value ?? ''
  });
  
  container.appendChild(span);
}

/**
 * Renders a nested table for an object or array
 * @param {Object|Array} obj - The object or array to render
 * @param {string} parentPath - Parent path
 * @param {number|null} rowIndex - Row index
 * @returns {HTMLElement} The nested table
 */
export function renderNestedTable(obj, parentPath = '', rowIndex = null) {
  console.log(`Rendering nested table for path: ${parentPath}, row: ${rowIndex}`);

  const tableAttrs = {
    className: 'nested-table',
    dataset: { parentPath }
  };
  
  if (rowIndex !== null) {
    tableAttrs.dataset.rowIndex = rowIndex;
  }
  
  const table = DomUtils.createElement('table', tableAttrs);
  const tbody = DomUtils.createElement('tbody');

  if (Array.isArray(obj)) {
    renderArrayRows(tbody, obj, parentPath, rowIndex);
  } else {
    renderObjectRows(tbody, obj, parentPath, rowIndex);
  }

  table.appendChild(tbody);
  return table;
}

/**
 * Renders table rows for an array
 * @param {HTMLElement} tbody - Table body element
 * @param {Array} arr - Array to render
 * @param {string} parentPath - Parent path
 * @param {number|null} rowIndex - Row index
 */
// TableRenderer.js - Update renderArrayRows
function renderArrayRows(tbody, arr, parentPath, rowIndex) {
  arr.forEach((item, index) => {
    const tr = DomUtils.createElement('tr', {
      dataset: { 
        rowIndex,
        arrayIndex: index
      }
    });
    
    // Index cell
    const keyCell = DomUtils.createCell(index, {
      dataset: { 
        key: String(index),
        path: `${parentPath}[${index}]`
      }
    });

    /* ── relative‑path display minus the first segment ───── */
    const relPath = `${parentPath}[${index}]`;
    const displayPath = stripFirstSegment(relPath);
    if (displayPath) {
      keyCell.appendChild(
        DomUtils.createElement('div', { className: 'json-path' }, { textContent: displayPath })
      );
    }
    
    // Value cell
    const fullPath = `${parentPath}[${index}]`;
    const valueCell = DomUtils.createCell(null, {
      dataset: {
        path: fullPath,
        key: String(index),
        rowIndex: rowIndex !== null ? rowIndex : undefined,
        arrayIndex: index
      }
    });
    
    renderCellContent(valueCell, item, fullPath, rowIndex);
    
    tr.appendChild(keyCell);
    tr.appendChild(valueCell);
    tbody.appendChild(tr);
  });
}

/**
 * Renders table rows for an object
 * @param {HTMLElement} tbody - Table body element
 * @param {Object} obj - Object to render
 * @param {string} parentPath - Parent path
 * @param {number|null} rowIndex - Row index
 */
function renderObjectRows(tbody, obj, parentPath, rowIndex) {
  Object.entries(obj).forEach(([key, val]) => {
    const tr = DomUtils.createElement('tr');
    
    // Key cell
    const keyCell = DomUtils.createCell(key, {
      dataset: { key }
    });
    
    
    /* ── NEW: relative‑path display minus the first segment ───── */
    const relPath      = parentPath ? `${parentPath}.${key}` : key;
    const displayPath  = stripFirstSegment(relPath);
    if (displayPath) {
      keyCell.appendChild(
        DomUtils.createElement('div', { className: 'json-path' }, { textContent: displayPath })
      );
    }
    
    // Value cell
    const fullPath = parentPath ? `${parentPath}.${key}` : key;
    const valueCell = DomUtils.createCell(null, {
      dataset: {
        path: fullPath,
        key,
        rowIndex: rowIndex !== null ? rowIndex : undefined
      }
    });
    
    renderCellContent(valueCell, val, fullPath, rowIndex);
    
    tr.appendChild(keyCell);
    tr.appendChild(valueCell);
    tbody.appendChild(tr);
  });
}

/* ────────────────────────────────────────────────────────────── */
/* Remove the first path element (or root‑level [index])         */
/* "raw_event.userIdentity.userName" → "userIdentity.userName"   */
/* "rootArray[2].id"               → "id" (drops rootArray[2])   */
function stripFirstSegment(path) {
  if (!path) return '';

  // Find first dot or bracket whichever comes first
  const dot      = path.indexOf('.');
  const bracket  = path.indexOf('[');

  // Case 1: path starts with '['  -> drop up to the matching ']' plus any following dot
  if (bracket === 0) {
    const closing = path.indexOf(']');
    if (closing !== -1) {
      const next = path.slice(closing + 1);          // slice after ]
      return next.startsWith('.') ? next.slice(1) : next;
    }
  }

  // Case 2: starts with key.  Drop up to first dot
  if (dot !== -1) return path.slice(dot + 1);

  // Only one segment -> nothing to show
  return '';
}