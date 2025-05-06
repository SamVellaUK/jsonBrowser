import { state } from './state.js';
import { applySearchHighlightsToNewContent } from './search.js';

export function renderTable() {
  const container = document.getElementById('table-container') || createContainers();
  container.innerHTML = '';

  const table = document.createElement('table');
  table.id = 'data-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');

  headRow.appendChild(createHeaderCell('#'));

  state.columnState.order.forEach((path, i) => {
    const col = state.columnState.visibleColumns.find(c => c.path === path);
    const th = createHeaderCell(col?.label || path);
    th.dataset.columnIndex = i;
    headRow.appendChild(th);
  });

  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  state.data.forEach((rowData, rowIndex) => {
    const row = document.createElement('tr');
    row.dataset.rowIndex = rowIndex; // Add row index attribute for easier selection
    
    const numCell = document.createElement('td');
    numCell.textContent = rowIndex + 1;
    row.appendChild(numCell);

    state.columnState.order.forEach((path, colIndex) => {
      const cell = document.createElement('td');
      cell.dataset.columnPath = path; // Add column path attribute
      
      const value = resolvePath(rowData, path);
      renderCell(cell, value, path, rowIndex); // Pass rowIndex for path context
      row.appendChild(cell);
    });

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

function renderCell(container, value, path = '', rowIndex = null) {
  // Add data attributes for path resolution
  container.setAttribute('data-path', path);
  if (rowIndex !== null) {
    container.setAttribute('data-row-index', rowIndex);
  }
  
  if (typeof value === 'object' && value !== null) {
    const toggle = document.createElement('span');
    toggle.textContent = '[+]';
    toggle.className = 'toggle-nest';
    toggle.style.cursor = 'pointer';

    const nestedDiv = document.createElement('div');
    nestedDiv.className = 'nested-content';
    nestedDiv.style.display = 'none';
    nestedDiv.dataset.parentPath = path; // Store parent path for nested content

    toggle.addEventListener('click', () => {
      const hidden = nestedDiv.style.display === 'none';
      nestedDiv.style.display = hidden ? 'block' : 'none';
      toggle.textContent = hidden ? '[-]' : '[+]';

      if (hidden && nestedDiv.childElementCount === 0) {
        console.log(`[renderCell] Expanding path: ${path}`);
        const nested = renderNested(value, path, rowIndex);
        nestedDiv.appendChild(nested);
        applySearchHighlightsToNewContent(nestedDiv);
      }
    });

    container.appendChild(toggle);
    container.appendChild(document.createTextNode(Array.isArray(value) ? '[...]' : '{...}'));
    container.appendChild(nestedDiv);
  } else {
    const span = document.createElement('span');
    span.textContent = value ?? '';
    span.setAttribute('data-path', path);
    container.appendChild(span);
  }
}

export function renderNested(obj, parentPath = '', rowIndex = null) {
  console.log('[renderNested] Called for path:', parentPath, 'row:', rowIndex);

  const table = document.createElement('table');
  table.className = 'nested-table';
  table.dataset.parentPath = parentPath;
  if (rowIndex !== null) {
    table.dataset.rowIndex = rowIndex;
  }

  const tbody = document.createElement('tbody');

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const tr = document.createElement('tr');

      const tdKey = document.createElement('td');
      tdKey.textContent = index;
      tdKey.dataset.key = String(index);

      const fullPath = `${parentPath}[${index}]`;

      const tdVal = document.createElement('td');
      tdVal.setAttribute('data-path', fullPath);
      tdVal.dataset.key = String(index);
      if (rowIndex !== null) {
        tdVal.dataset.rowIndex = rowIndex;
      }

      if (typeof item === 'object' && item !== null) {
        console.log(`[renderNested] Nested object/array at: ${fullPath}`);
        const toggle = document.createElement('span');
        toggle.textContent = '[+]';
        toggle.className = 'toggle-nest';
        toggle.style.cursor = 'pointer';

        const nestedDiv = document.createElement('div');
        nestedDiv.className = 'nested-content';
        nestedDiv.style.display = 'none';
        nestedDiv.dataset.parentPath = fullPath;
        if (rowIndex !== null) {
          nestedDiv.dataset.rowIndex = rowIndex;
        }

        toggle.addEventListener('click', () => {
          const isCollapsed = nestedDiv.style.display === 'none';
          nestedDiv.style.display = isCollapsed ? 'block' : 'none';
          toggle.textContent = isCollapsed ? '[-]' : '[+]';

          if (isCollapsed && nestedDiv.childElementCount === 0) {
            const nestedTable = renderNested(item, fullPath, rowIndex);
            nestedDiv.appendChild(nestedTable);
            applySearchHighlightsToNewContent(nestedDiv);
          }
        });

        tdVal.appendChild(toggle);
        tdVal.appendChild(document.createTextNode(Array.isArray(item) ? '[...]' : '{...}'));
        tdVal.appendChild(nestedDiv);
      } else {
        renderCell(tdVal, item, fullPath, rowIndex);
      }

      tr.appendChild(tdKey);
      tr.appendChild(tdVal);
      tbody.appendChild(tr);
    });
  } else {
    Object.entries(obj).forEach(([key, val]) => {
      const tr = document.createElement('tr');

      const tdKey = document.createElement('td');
      tdKey.textContent = key;
      tdKey.dataset.key = key;

      const fullPath = parentPath ? `${parentPath}.${key}` : key;

      const tdVal = document.createElement('td');
      tdVal.setAttribute('data-path', fullPath);
      tdVal.dataset.key = key;
      if (rowIndex !== null) {
        tdVal.dataset.rowIndex = rowIndex;
      }

      if (typeof val === 'object' && val !== null) {
        console.log(`[renderNested] Nested object/array at: ${fullPath}`);
        const toggle = document.createElement('span');
        toggle.textContent = '[+]';
        toggle.className = 'toggle-nest';
        toggle.style.cursor = 'pointer';

        const nestedDiv = document.createElement('div');
        nestedDiv.className = 'nested-content';
        nestedDiv.style.display = 'none';
        nestedDiv.dataset.parentPath = fullPath;
        if (rowIndex !== null) {
          nestedDiv.dataset.rowIndex = rowIndex;
        }

        toggle.addEventListener('click', () => {
          const isCollapsed = nestedDiv.style.display === 'none';
          nestedDiv.style.display = isCollapsed ? 'block' : 'none';
          toggle.textContent = isCollapsed ? '[-]' : '[+]';

          if (isCollapsed && nestedDiv.childElementCount === 0) {
            const nestedTable = renderNested(val, fullPath, rowIndex);
            nestedDiv.appendChild(nestedTable);
            applySearchHighlightsToNewContent(nestedDiv);
          }
        });

        tdVal.appendChild(toggle);
        tdVal.appendChild(document.createTextNode(Array.isArray(val) ? '[...]' : '{...}'));
        tdVal.appendChild(nestedDiv);
      } else {
        renderCell(tdVal, val, fullPath, rowIndex);
      }

      tr.appendChild(tdKey);
      tr.appendChild(tdVal);
      tbody.appendChild(tr);
    });
  }

  table.appendChild(tbody);
  return table;
}


export function resolvePath(obj, path) {
  const parts = splitJsonPath(path);

  return parts.reduce((acc, part) => {
    if (!acc) return undefined;

    // Handle array index syntax, e.g. "items[0]"
    const match = part.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
      const [, key, index] = match;
      return acc[key]?.[parseInt(index, 10)];
    }

    return acc[part];
  }, obj);
}

function createHeaderCell(text) {
  const th = document.createElement('th');
  th.textContent = text;
  return th;
}

function createContainers() {
  const root = document.getElementById('json-root');
  const container = document.createElement('div');
  container.id = 'table-container';
  root.appendChild(container);
  return container;
}

export function expandToPath(path, rowIndex = null) {
  console.log(`[expandToPath] Starting with path="${path}", rowIndex=${rowIndex}`);
  
  if (!path || rowIndex === null) {
    console.warn(`[expandToPath] Invalid path or rowIndex: ${path}, ${rowIndex}`);
    return;
  }

  // Find the row containing our data
  const row = document.querySelector(`#data-table tr[data-row-index="${rowIndex}"]`);
  if (!row) {
    console.warn(`[expandToPath] Could not find row with index ${rowIndex}`);
    return;
  }

  // Split the path into parts
  const parts = splitJsonPath(path);
  console.log(`[expandToPath] Split path "${path}" →`, parts);

  // The main column that contains our first path part
  const columnPath = parts[0];
  const column = row.querySelector(`td[data-column-path="${columnPath}"]`);
  
  if (!column) {
    console.warn(`[expandToPath] Could not find column for path ${columnPath}`);
    return;
  }
  
  // Start expanding!
  expandNestedPath(column, parts, 0, rowIndex);
}

// Enhanced to handle timing issues with nested content
function expandNestedPath(container, pathParts, depth, rowIndex, retryCount = 0) {
  if (depth >= pathParts.length) return;

  let currentPart = pathParts[depth];
  const fullPathSoFar = pathParts.slice(0, depth + 1).join('.');
  
  console.log('─'.repeat(40));
  console.log(`[expandNestedPath] depth=${depth}, part="${currentPart}", path="${fullPathSoFar}", retry=${retryCount}`);

  // First expand this container if it has a toggle
  const toggle = container.querySelector(':scope > .toggle-nest');
  const nestedContent = container.querySelector(':scope > .nested-content');

  if (toggle && nestedContent) {
    const wasCollapsed = nestedContent.style.display === 'none';
    nestedContent.style.display = 'block';
    toggle.textContent = '[-]';
  
    if (wasCollapsed && nestedContent.childElementCount === 0) {
      console.log(`[expandNestedPath] Rendering nested for path: ${fullPathSoFar}`);
      const objValue = resolvePath(state.data[rowIndex], fullPathSoFar);
      if (objValue) {
        const nested = renderNested(objValue, fullPathSoFar, rowIndex);
        nestedContent.appendChild(nested);
        applySearchHighlightsToNewContent(nestedContent);
      }
    }
  }

  // If we're at the last part, we're done
  if (depth === pathParts.length - 1) return;

  // Continue to the next part after a short delay to allow for DOM updates
  setTimeout(() => {
    const nextPart = pathParts[depth + 1];
    console.log(`[expandNestedPath] Looking for next part: ${nextPart}`);
    
    // Find the nested table within the current expanded content
    const nestedTable = nestedContent?.querySelector(':scope > .nested-table');
    if (!nestedTable) {
      console.warn(`[expandNestedPath] No nested table found in expanded content`);
      return;
    }
    
    // Attempt to find the cell for the next part
    const nextCell = findCellForPath(nestedTable, nextPart);
    
    if (nextCell) {
      // Success - continue to the next part
      expandNestedPath(nextCell, pathParts, depth + 1, rowIndex);
    } else {
      // Not found - retry if this is an array access and we haven't tried too many times
      const isArrayAccess = nextPart.includes('[');
      const MAX_RETRIES = 3;
      
      if (isArrayAccess && retryCount < MAX_RETRIES) {
        console.log(`[expandNestedPath] Array content may not be ready yet, retrying in 100ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => {
          expandNestedPath(container, pathParts, depth, rowIndex, retryCount + 1);
        }, 100 * (retryCount + 1)); // Increasing backoff
      } else {
        console.warn(`[expandNestedPath] Could not find cell for ${nextPart} after ${retryCount} retries`);
      }
    }
  }, 50); // Base delay to ensure DOM updates
}

// Enhanced helper function to find cells with advanced path handling
function findCellForPath(table, pathPart) {
  // Check if this is an array index pattern like "items[0]"
  const arrayMatch = pathPart.match(/^(\w+)(?:\[(\d+)\])?$/);
  if (!arrayMatch) {
    console.warn(`[findCellForPath] Invalid path part format: ${pathPart}`);
    return null;
  }
  
  const [, key, index] = arrayMatch;
  console.log(`[findCellForPath] Looking for key="${key}"${index ? `, index=${index}` : ''}`);
  
  // First find the cell with the key name
  let keyCell = null;
  const rows = Array.from(table.querySelectorAll('tr'));
  
  for (const row of rows) {
    const firstCell = row.querySelector('td:first-child');
    if (firstCell && firstCell.textContent === key) {
      keyCell = row.querySelector('td:nth-child(2)');
      console.log(`[findCellForPath] Found key cell for "${key}"`);
      break;
    }
  }
  
  if (!keyCell) {
    console.warn(`[findCellForPath] Could not find cell with key: ${key}`);
    return null;
  }
  
  // If no index specified, return the key cell directly
  if (!index) {
    return keyCell;
  }
  
  // Otherwise, we need to expand this key cell to see its array content
  const toggle = keyCell.querySelector(':scope > .toggle-nest');
  const nestedContent = keyCell.querySelector(':scope > .nested-content');
  
  if (!toggle || !nestedContent) {
    console.warn(`[findCellForPath] No toggle or nested content found for array: ${key}`);
    return null;
  }
  
  // Make sure content is expanded
  const wasCollapsed = nestedContent.style.display === 'none';
  if (wasCollapsed) {
    console.log(`[findCellForPath] Expanding array content for ${key}`);
    nestedContent.style.display = 'block';
    toggle.textContent = '[-]';
  }
  
  // If it was collapsed, we need to render the content
  if (wasCollapsed && nestedContent.childElementCount === 0) {
    console.log(`[findCellForPath] Need to render array content for ${key}`);
    
    // Get the data for this path from the keyCell's data-path attribute
    const cellPath = keyCell.getAttribute('data-path');
    if (!cellPath) {
      console.warn(`[findCellForPath] No data-path attribute for key: ${key}`);
      return null;
    }
    
    // Get the row index from the keyCell's data-row-index attribute
    const rowIndex = keyCell.getAttribute('data-row-index');
    if (rowIndex === null) {
      console.warn(`[findCellForPath] No data-row-index attribute for key: ${key}`);
      return null;
    }
    
    // Force render the nested content
    const objValue = resolvePath(state.data[rowIndex], cellPath);
    if (objValue) {
      console.log(`[findCellForPath] Rendering nested content for ${cellPath}`);
      const nested = renderNested(objValue, cellPath, parseInt(rowIndex, 10));
      nestedContent.appendChild(nested);
      applySearchHighlightsToNewContent(nestedContent);
    } else {
      console.warn(`[findCellForPath] Could not resolve path: ${cellPath}`);
      return null;
    }
  }
  
  // Now find the nested table for the array (it should exist now)
  const nestedTable = nestedContent.querySelector(':scope > .nested-table');
  if (!nestedTable) {
    console.warn(`[findCellForPath] No nested table found for array: ${key}`);
    return null;
  }
  
  // Get the row at the specified index
  const arrayRows = nestedTable.querySelectorAll('tr');
  const idxNum = parseInt(index, 10);
  
  if (!arrayRows || arrayRows.length === 0) {
    console.warn(`[findCellForPath] No rows found in array table for: ${key}`);
    return null;
  }
  
  if (idxNum >= arrayRows.length) {
    console.warn(`[findCellForPath] Index out of bounds: ${idxNum} >= ${arrayRows.length}`);
    return null;
  }
  
  const indexRow = arrayRows[idxNum];
  if (!indexRow) {
    console.warn(`[findCellForPath] Could not find row at index: ${idxNum}`);
    return null;
  }
  
  // Return the value cell from this row
  const valueCell = indexRow.querySelector('td:nth-child(2)');
  
  if (valueCell) {
    console.log(`[findCellForPath] Found value cell for ${key}[${index}]`);
  } else {
    console.warn(`[findCellForPath] No value cell found for ${key}[${index}]`);
  }
  
  return valueCell;
}



function findCellByKey(table, key) {
  const match = key.match(/^(\w+)\[(\d+)\]$/);
  if (match) {
    const [ , baseKey, index ] = match;
    console.log(`[findCellByKey] Parsing array: baseKey="${baseKey}", index=${index}`);

    const baseCell = findCellByKey(table, baseKey);
    if (!baseCell) {
      console.warn(`[findCellByKey] Base key "${baseKey}" not found`);
      return null;
    }

    const innerTable = baseCell.querySelector('.nested-table');
    if (!innerTable) {
      console.warn(`[findCellByKey] No nested table found in base key "${baseKey}"`);
      return null;
    }

    const rows = innerTable.querySelectorAll('tr');
    if (index >= rows.length) {
      console.warn(`[findCellByKey] Index ${index} out of bounds in "${baseKey}"`);
      return null;
    }

    const indexRow = rows[index];
    if (!indexRow) return null;

    return indexRow.querySelector('td:nth-child(2)'); // value cell
  }

  // Normal object case
  const rows = table.querySelectorAll('tr');
  for (const row of rows) {
    const keyCell = row.querySelector('td:first-child');
    if (keyCell && keyCell.textContent === key) {
      return row.querySelector('td:nth-child(2)');
    }
  }

  console.warn(`[findCellByKey] Could not find cell for key: ${key}`);
  return null;
}


// Updated to handle array paths better
function splitJsonPath(path) {
  const parts = [];
  let current = '';
  let inBracket = false;
  
  for (let i = 0; i < path.length; i++) {
    const char = path[i];
    
    if (char === '.' && !inBracket) {
      if (current) parts.push(current);
      current = '';
    } else if (char === '[') {
      inBracket = true;
      current += char;
    } else if (char === ']') {
      inBracket = false;
      current += char;
    } else {
      current += char;
    }
  }
  
  if (current) parts.push(current);
  return parts;
}


function findRowContainer(rowIndex) {
  const table = document.getElementById('data-table');
  if (!table) return null;

  const rows = table.querySelectorAll('tbody tr');
  const row = rows[rowIndex];
  return row || null;
}

// Expose functions to window for debugging
window.expandToPath = expandToPath;
window.findCellByKey = findCellByKey;
window.expandNestedPath = expandNestedPath;