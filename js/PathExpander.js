import { state } from './state.js';
import { renderNestedTable } from './TableRenderer.js';
import { splitJsonPath, resolvePath, parseArrayPath } from './PathUtils.js';
import { applySearchHighlightsToNewContent } from './search.js';
import * as DomUtils from './DomUtils.js';

/**
 * PathExpander.js - Handles expanding nested paths in the table
 */

/**
 * Maximum retry attempts for expanding a path
 * @type {number}
 */
const MAX_RETRIES = 3;

/**
 * Base delay for retries in milliseconds
 * @type {number}
 */
const BASE_DELAY = 50;

/**
 * Expands the table to show a specific path
 * @param {string} path - The path to expand
 * @param {number|null} rowIndex - Row index
 */
export function expandToPath(path, rowIndex = null) {
  console.log(`Starting path expansion: path="${path}", rowIndex=${rowIndex}`);
  
  if (!path || rowIndex === null) {
    console.warn(`Invalid path or rowIndex: ${path}, ${rowIndex}`);
    return;
  }

  // Find the row containing our data
  const row = document.querySelector(`#data-table tr[data-row-index="${rowIndex}"]`);
  if (!row) {
    console.warn(`Could not find row with index ${rowIndex}`);
    return;
  }

  // Split the path into parts
  const parts = splitJsonPath(path);
  if (!parts.length) {
    console.warn(`Invalid path format: ${path}`);
    return;
  }
  
  // The main column that contains our first path part
  const columnPath = parts[0];
  const column = row.querySelector(`td[data-column-path="${columnPath}"]`);
  
  if (!column) {
    console.warn(`Could not find column for path ${columnPath}`);
    return;
  }
  
  // Start expanding the path recursively
  expandNestedPath(column, parts, 0, rowIndex);
}

/**
 * Recursively expands nested paths
 * @param {HTMLElement} container - Current container element
 * @param {string[]} pathParts - Array of path parts
 * @param {number} depth - Current depth
 * @param {number} rowIndex - Row index
 * @param {number} retryCount - Current retry count
 */
function expandNestedPath(container, pathParts, depth, rowIndex, retryCount = 0) {
  if (depth >= pathParts.length) return;

  const currentPart = pathParts[depth];
  const fullPathSoFar = pathParts.slice(0, depth + 1).join('.');
  
  console.log(`Expanding path: depth=${depth}, part="${currentPart}", path="${fullPathSoFar}", retry=${retryCount}`);

  // First expand this container if it has a toggle
  const toggle = container.querySelector(':scope > .toggle-nest');
  const nestedContent = container.querySelector(':scope > .nested-content');

  if (toggle && nestedContent) {
    const wasCollapsed = nestedContent.style.display === 'none';
    DomUtils.setToggleState(toggle, nestedContent, true);
  
    if (wasCollapsed && nestedContent.childElementCount === 0) {
      console.log(`Rendering nested content for path: ${fullPathSoFar}`);
      const objValue = resolvePath(state.data[rowIndex], fullPathSoFar);
      if (objValue) {
        const nested = renderNestedTable(objValue, fullPathSoFar, rowIndex);
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
    console.log(`Looking for next part: ${nextPart}`);
    
    // Find the nested table within the current expanded content
    const nestedTable = nestedContent?.querySelector(':scope > .nested-table');
    if (!nestedTable) {
      console.warn(`No nested table found in expanded content`);
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
      
      if (isArrayAccess && retryCount < MAX_RETRIES) {
        const delay = BASE_DELAY * (retryCount + 1);
        console.log(`Array content may not be ready yet, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => {
          expandNestedPath(container, pathParts, depth, rowIndex, retryCount + 1);
        }, delay);
      } else {
        console.warn(`Could not find cell for ${nextPart} after ${retryCount} retries`);
      }
    }
  }, BASE_DELAY);
}

/**
 * Finds a cell in a table given a path part
 * @param {HTMLElement} table - Table element to search in
 * @param {string} pathPart - Path part to find
 * @returns {HTMLElement|null} The cell element or null if not found
 */
function findCellForPath(table, pathPart) {
  const pathInfo = parseArrayPath(pathPart);
  if (!pathInfo) {
    console.warn(`Invalid path part format: ${pathPart}`);
    return null;
  }
  
  const { key, index } = pathInfo;
  console.log(`Looking for key="${key}"${index !== null ? `, index=${index}` : ''}`);
  
  // First find the cell with the key name
  let keyCell = findKeyCell(table, key);
  if (!keyCell) {
    console.warn(`Could not find cell with key: ${key}`);
    return null;
  }
  
  // If no index specified, return the key cell directly
  if (index === null) {
    return keyCell;
  }
  
  // Handle array index
  return expandAndFindArrayItem(keyCell, key, index);
}

/**
 * Finds a cell in a table by key name
 * @param {HTMLElement} table - Table to search in
 * @param {string} key - Key to find
 * @returns {HTMLElement|null} Cell element or null if not found
 */
function findKeyCell(table, key) {
  const rows = Array.from(table.querySelectorAll('tr'));
  
  for (const row of rows) {
    const firstCell = row.querySelector('td:first-child');
    if (firstCell && firstCell.textContent === key) {
      return row.querySelector('td:nth-child(2)');
    }
  }
  
  return null;
}

/**
 * Expands an array cell and finds an item by index
 * @param {HTMLElement} keyCell - Cell containing the array
 * @param {string} key - Array key name
 * @param {number} index - Array index to find
 * @returns {HTMLElement|null} Cell for the array item or null if not found
 */
function expandAndFindArrayItem(keyCell, key, index) {
  const toggle = keyCell.querySelector(':scope > .toggle-nest');
  const nestedContent = keyCell.querySelector(':scope > .nested-content');
  
  if (!toggle || !nestedContent) {
    console.warn(`No toggle or nested content found for array: ${key}`);
    return null;
  }
  
  // Make sure content is expanded
  const wasCollapsed = nestedContent.style.display === 'none';
  DomUtils.setToggleState(toggle, nestedContent, true);
  
  // If it was collapsed, we need to render the content
  if (wasCollapsed && nestedContent.childElementCount === 0) {
    console.log(`Need to render array content for ${key}`);
    
    // Get the data for this path from the keyCell's data-path attribute
    const cellPath = keyCell.getAttribute('data-path');
    if (!cellPath) {
      console.warn(`No data-path attribute for key: ${key}`);
      return null;
    }
    
    // Get the row index from the keyCell's data-row-index attribute
    const rowIndex = keyCell.getAttribute('data-row-index');
    if (rowIndex === null) {
      console.warn(`No data-row-index attribute for key: ${key}`);
      return null;
    }
    
    // Force render the nested content
    const objValue = resolvePath(state.data[rowIndex], cellPath);
    if (objValue) {
      console.log(`Rendering nested content for ${cellPath}`);
      const nested = renderNestedTable(objValue, cellPath, parseInt(rowIndex, 10));
      nestedContent.appendChild(nested);
      applySearchHighlightsToNewContent(nestedContent);
    } else {
      console.warn(`Could not resolve path: ${cellPath}`);
      return null;
    }
  }
  
  // Now find the nested table for the array
  const nestedTable = nestedContent.querySelector(':scope > .nested-table');
  if (!nestedTable) {
    console.warn(`No nested table found for array: ${key}`);
    return null;
  }
  
  // Get the row at the specified index
  const arrayRows = nestedTable.querySelectorAll('tr');
  
  if (!arrayRows || arrayRows.length === 0) {
    console.warn(`No rows found in array table for: ${key}`);
    return null;
  }
  
  if (index >= arrayRows.length) {
    console.warn(`Index out of bounds: ${index} >= ${arrayRows.length}`);
    return null;
  }
  
  const indexRow = arrayRows[index];
  if (!indexRow) {
    console.warn(`Could not find row at index: ${index}`);
    return null;
  }
  
  // Return the value cell from this row
  const valueCell = indexRow.querySelector('td:nth-child(2)');
  
  if (valueCell) {
    console.log(`Found value cell for ${key}[${index}]`);
  } else {
    console.warn(`No value cell found for ${key}[${index}]`);
  }
  
  return valueCell;
}