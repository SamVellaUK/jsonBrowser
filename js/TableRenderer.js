import { state } from './main.js';
import { applySearchHighlightsToNewContent } from './search.js';
import * as DomUtils from './Utils.js';

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

  // apply edit-mode class
  container.classList.toggle('edit-mode', state.editMode);

  // 2) build table element
  const table = DomUtils.createElement('table', { id: 'root-data-table' });

  // —— HEADER ——  
  const thead = DomUtils.createElement('thead');
  const headRow = DomUtils.createElement('tr');

  // 2.1) row‐number column
  headRow.appendChild(DomUtils.createHeaderCell('#'));

  // 2.2) data columns
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

    // click to sort
    th.addEventListener('click', () => {
      if (state.sortState.path === path) {
        state.sortState.direction =
          state.sortState.direction === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortState.path = path;
        state.sortState.direction = 'asc';
      }

      state.data.sort((a, b) => {
        const va = resolvePath(a, path);
        const vb = resolvePath(b, path);
        return compareValues(va, vb, state.sortState.direction);
      });

      renderTable();
      applySearchHighlightsToNewContent();
    });

    // JSON-Paths under header (only for promoted/flattened columns)
    if (state.showJsonPaths && colDef?.sourcePath && colDef.sourcePath !== path) {
      const shortPath = stripFirstSegment(colDef.sourcePath);
      const p = DomUtils.createElement('div', { className: 'json-path' }, {
        textContent: shortPath
      });
      th.appendChild(p);
    }

    headRow.appendChild(th);
  });

  thead.appendChild(headRow);
  table.appendChild(thead);

  // —— BODY ——  
  const tbody = DomUtils.createElement('tbody');

  state.data.forEach((rowData, rowIndex) => {
    const tr = DomUtils.createElement('tr', { dataset: { rowIndex } });

    // row # cell
    tr.appendChild(DomUtils.createCell(rowIndex + 1));

    // data cells
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

// compare helper (unchanged)…
function compareValues(a, b, dir) { /* … */ }

// render cell content (delegates to object vs scalar)
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
    renderScalarCell(container, value, path, rowIndex);
  }
}

// for objects/arrays:
function renderObjectCell(container, value, path, rowIndex) {
  const nestedContent = DomUtils.createNestedContainer(path, rowIndex);
  nestedContent.setAttribute('data-toggle', 'expand');

  const toggle = DomUtils.createToggle();
  toggle.setAttribute('data-toggle', 'collapse');

  container.appendChild(toggle);
  container.appendChild(
    document.createTextNode(Array.isArray(value) ? '[...]' : '{...}')
  );
  container.appendChild(nestedContent);
}


export function promoteField(fullPath) {
  if (state.columnState.order.includes(fullPath)) return;

  // ① update state
  const root = fullPath.split('.')[0];
  const rootIdx = state.columnState.order.indexOf(root);
  const insertAt = rootIdx >= 0 ? rootIdx + 1 : state.columnState.order.length;
  state.columnState.order.splice(insertAt, 0, fullPath);
  state.columnState.visibleColumns.push({
    path: fullPath,
    label: fullPath.split('.').pop(),
    sourcePath: fullPath,
  });

  // ② grab *only* the root table
  const table = document.getElementById('root-data-table');
  // header row: only the direct thead > tr, not nested ones
  const headRow = table.querySelector(':scope > thead > tr');

  // build the new <th>
  const label = fullPath.split('.').pop();
  const th = DomUtils.createHeaderCell(label, {
    dataset: { columnIndex: insertAt - 1 },
  });
  th.addEventListener('click', () => {
    // your existing sort logic…
  });
  if (fullPath.includes('.')) {
    const shortPath = fullPath.split('.').slice(1).join('.');
    const p = DomUtils.createElement('div', { className: 'json-path' }, {
      textContent: shortPath
    });
    th.appendChild(p);
  }

  // insert into thead ( +1 for the “#” column )
  headRow.insertBefore(th, headRow.children[insertAt + 1]);

  // ③ insert one <td> per *root* row (not nested)
  const rows = table.querySelectorAll(':scope > tbody > tr');
  rows.forEach((tr, rowIndex) => {
    const td = DomUtils.createCell(null, {
      dataset: { columnPath: fullPath, rowIndex }
    });
    const value = resolvePath(state.data[rowIndex], fullPath);
    // reuse your scalar renderer
    if (typeof value === 'object' && value !== null) {
      renderObjectCell(td, value, fullPath, rowIndex);
    } else {
      renderScalarCell(td, value, fullPath, rowIndex);
    }
    tr.insertBefore(td, tr.children[insertAt + 1]);
  });

  // ④ keep search highlights intact
  applySearchHighlightsToNewContent();
}

/**
 * When sorting, only re-render the body (so you keep headers & expansions)
 */
function renderBodyOnly() {
  const table = document.getElementById('data-table');
  const oldTbody = table.querySelector('tbody');
  const newTbody = DomUtils.createElement('tbody');

  state.data.forEach((rowData, rowIndex) => {
    const tr = DomUtils.createElement('tr', { dataset: { rowIndex } });
    // # cell
    tr.appendChild(DomUtils.createCell(rowIndex + 1));
    // all current columns
    state.columnState.order.forEach(path => {
      const td = DomUtils.createCell(null, {
        dataset: { columnPath: path, rowIndex }
      });
      const value = resolvePath(rowData, path);
      if (typeof value === 'object' && value !== null) {
        renderObjectCell(td, value, path, rowIndex);
      } else {
        renderScalarCell(td, value, path, rowIndex);
      }
    });
    newTbody.appendChild(tr);
  });

  table.replaceChild(newTbody, oldTbody);
}


/**
 * Renders a scalar (non-object) value in a cell
 * @param {HTMLElement} container - Cell container
 * @param {*} value - Value to render
 * @param {string} path - Data path
 */
function renderScalarCell(container, value, path, rowIndex) {
  const text = value != null ? value.toString() : '';
  container.appendChild(document.createTextNode(text));

  // ← show "+" only on scalar, nested fields in edit mode
  if (path.includes('.')) {
    const promote = DomUtils.createElement(
      'span',
      {
        className: 'promote-button',
        title: 'Promote this field as a top-level column'
      },
      { textContent: '+' }
    );
    promote.addEventListener('click', e => {
      e.stopPropagation();
      promoteField(path);
    });
    container.appendChild(promote);
  }
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