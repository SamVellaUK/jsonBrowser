import { state } from './main.js';
import { applySearchHighlightsToNewContent, performSearch } from './search.js';
import * as DomUtils from './Utils.js';

/**
 * TableRenderer.js - Core table rendering functionality
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
      dataset: { columnIndex: String(colIndex) } // Store 0-based index from order array
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
      th.classList.remove('sorted-asc', 'sorted-desc'); // Clear old sort classes first
      th.classList.add( // Add new sort class
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
  // Initial body render done by renderBodyOnly called after this block if needed,
  // or directly if data is already present. For renderTable, we'll build it.
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
  
  container.appendChild(toggle);
  container.appendChild(
    document.createTextNode(Array.isArray(value) ? ' [...]' : ' {...}')
  );
  container.appendChild(nestedContent);
}

export function promoteField(fullPath) {
  if (state.columnState.order.includes(fullPath)) return;

  const rootPathSegment = fullPath.match(/[^.[]+/)?.[0] || '';
  const rootColIndexInOrder = state.columnState.order.indexOf(rootPathSegment);
  
  // Determine the index to insert the new column's path in state.columnState.order
  // This will be *after* the rootPathSegment column.
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
    // The columnIndex should reflect its new position in state.columnState.order
    dataset: { columnIndex: String(insertAtInOrderArray) }, 
  });
  
  th.addEventListener('click', () => {
    // Sort logic for the newly promoted column header
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

  // Correct DOM insertion index: index in 'order' array + 1 (for the '#' column)
  const domInsertionNodeIndex = insertAtInOrderArray + 1;
  const targetThNode = headRow.children[domInsertionNodeIndex];
  headRow.insertBefore(th, targetThNode); // If targetThNode is null/undefined (at end), it appends.

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
    tr.insertBefore(td, targetTdNode); // If targetTdNode is null/undefined, it appends.
  });

  if (state.search.query) {
    performSearch(state.search.query);
  } else {
    applySearchHighlightsToNewContent(table);
  }
}


export function demoteField(path) {
  // 1️⃣ Find its position in the state
  const stateIdx = state.columnState.order.indexOf(path);
  if (stateIdx === -1) return;

  // 2️⃣ Remove it from the state
  state.columnState.order.splice(stateIdx, 1);
  state.columnState.visibleColumns = state.columnState.visibleColumns.filter(
    c => c.path !== path
  );

  // 3️⃣ Remove the <th> and matching <td>s by position
  const table = document.getElementById('data-table');
  if (!table) return;
  const headRow = table.querySelector('thead tr');
  // +1 because the very first column is the row-number column (“#”)
  const domColIndex = stateIdx + 1;

  // Remove header cell
  const th = headRow.children[domColIndex];
  if (th) headRow.removeChild(th);

  // Remove each corresponding TD
  table.querySelectorAll('tbody tr').forEach(tr => {
    const td = tr.children[domColIndex];
    if (td) tr.removeChild(td);
  });

  // 4️⃣ Re-apply any active search/highlights
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
  const tableAttrs = { className: 'nested-table', dataset: { parentPath: parentPath } };
  if (rowIndex !== null) { tableAttrs.dataset.mainRowIndex = String(rowIndex); }
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

  if (bracket === 0) { // Starts with an array index, e.g., "[0].fieldName" or "[0]"
    const closingBracket = path.indexOf(']');
    if (closingBracket === -1) return ''; // Malformed
    const afterBracket = path.slice(closingBracket + 1);
    return afterBracket.startsWith('.') ? afterBracket.slice(1) : afterBracket;
  }

  // Starts with a key, e.g., "rootKey.field" or "rootKey[0]"
  let firstSeparatorIndex = -1;
  if (dot !== -1 && bracket !== -1) {
    firstSeparatorIndex = Math.min(dot, bracket);
  } else if (dot !== -1) {
    firstSeparatorIndex = dot;
  } else if (bracket !== -1) {
    firstSeparatorIndex = bracket;
  }

  if (firstSeparatorIndex !== -1) {
    // If separator is '.', slice after it. If '[', include it.
    return path.charAt(firstSeparatorIndex) === '.' ? path.slice(firstSeparatorIndex + 1) : path.slice(firstSeparatorIndex);
  }
  return ''; // Only one segment, so no "child" path part to show
}