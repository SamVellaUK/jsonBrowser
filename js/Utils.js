// Utils.js - Utility functions for DOM manipulation and JSON path handling
import { applySearchHighlightsToNewContent } from './search.js';
  
/**
 * Creates a DOM element with attributes and properties
 * @param {string} tag - HTML tag name
 * @param {Object} attrs - Attributes to set on the element
 * @param {Object} props - Properties to set on the element
 * @returns {HTMLElement} The created element
 */
export function createElement(tag, attrs = {}, props = {}) {
    const el = document.createElement(tag);
    
    // Set attributes
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'className') {
        el.className = value;
      } else if (key === 'dataset') {
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          el.dataset[dataKey] = dataValue;
        });
      } else {
        el.setAttribute(key, value);
      }
    });
    
    // Set properties
    Object.entries(props).forEach(([key, value]) => {
      el[key] = value;
    });
    
    return el;
  }
  
  /**
   * Creates a table header cell
   * @param {string} text - Text content
   * @param {Object} attrs - Additional attributes
   * @returns {HTMLTableCellElement} The created header cell
   */
  export function createHeaderCell(text, attrs = {}) {
    return createElement('th', attrs, { textContent: text });
  }
  
  /**
   * Creates a table data cell
   * @param {string|null} text - Text content (optional)
   * @param {Object} attrs - Additional attributes
   * @returns {HTMLTableCellElement} The created data cell
   */
  export function createCell(text = null, attrs = {}) {
    const cell = createElement('td', attrs);
    if (text !== null) {
      cell.textContent = text;
    }
    return cell;
  }
  
  /**
   * Creates a toggle button for expandable content
   * @param {Function} onClick - Click handler
   * @returns {HTMLElement} The toggle button
   */
  export function createToggle(onClick) {
    const toggle = createElement('span', {
      className: 'toggle-nest',
      style: 'cursor: pointer;'
    }, {
      textContent: '[+]'
    });
    
    if (onClick) {
      toggle.addEventListener('click', onClick);
    }
    
    return toggle;
  }
  
  /**
   * Creates a container for nested content
   * @param {string} parentPath - Path of parent element
   * @param {string|number|null} rowIndex - Row index (optional)
   * @returns {HTMLElement} The nested content container
   */
  export function createNestedContainer(parentPath, rowIndex = null) {
    const attrs = {
      className: 'nested-content',
      style: 'display: none;',
      dataset: { parentPath }
    };
    
    if (rowIndex !== null) {
      attrs.dataset.rowIndex = rowIndex;
    }
    
    return createElement('div', attrs);
  }
  
  /**
   * Creates a container for the main table
   * @returns {HTMLElement} The table container
   */
  export function createTableContainer() {
    const root = document.getElementById('json-root');
    const container = createElement('div', { id: 'table-container' });
    root.appendChild(container);
    return container;
  }
  
  /**
   * Finds a table row by index
   * @param {number} rowIndex - The row index
   * @returns {HTMLElement|null} The row element or null if not found
   */
  export function findRowByIndex(rowIndex) {
    const table = document.getElementById('data-table');
    if (!table) return null;
  
    const rows = table.querySelectorAll('tbody tr');
    return rows[rowIndex] || null;
  }
  
  /**
   * Sets toggle state and displays nested content
   * @param {HTMLElement} toggle - The toggle element
   * @param {HTMLElement} nestedContent - The nested content container
   * @param {boolean} expanded - Whether to expand or collapse
   */
  export function setToggleState(toggle, nestedContent, expanded) {
    nestedContent.style.display = expanded ? 'block' : 'none';
    toggle.textContent = expanded ? '[-]' : '[+]';
  }

  export function captureElementState(element) {
    return {
      scrollTop: element.scrollTop,
      // Add other relevant state
    };
  }
  
  export function restoreElementState(element, state) {
    if (state.scrollTop) {
      element.scrollTop = state.scrollTop;
    }
    // Restore other state
  }
  
  export function moveElement(source, target) {
    // Implement efficient DOM node movement
    target.parentNode.insertBefore(source, target);
    target.parentNode.removeChild(target);
  }

  /**
 * Path utilities for handling JSON path expressions
 */

/**
 * Splits a JSON path into individual parts
 * Handles array notation correctly
 * @param {string} path - Path like "items.data[0].name"
 * @returns {string[]} Array of path segments
 */
export function splitJsonPath(path) {
    if (!path) return [];
    
    // Handle bracket notation for array indices
    const parts = [];
    let current = '';
    let inArray = false;
    
    for (let i = 0; i < path.length; i++) {
        const char = path[i];
        
        if (char === '[') {
            if (current) {
                parts.push(current);
                current = '';
            }
            inArray = true;
            current += char;
        } else if (char === ']') {
            current += char;
            parts.push(current);
            current = '';
            inArray = false;
        } else if (char === '.' && !inArray) {
            if (current) {
                parts.push(current);
                current = '';
            }
        } else {
            current += char;
        }
    }
    
    if (current) parts.push(current);
    return parts;
}
  
  /**
   * Resolves a path against an object to get its value
   * @param {Object} obj - Source object
   * @param {string} path - Path to resolve
   * @returns {*} Value at path or undefined if not found
   */
// PathUtils.js - Enhanced resolvePath function
export function resolvePath(obj, path) {
    if (!obj || !path) return undefined;
    
    const parts = splitJsonPath(path);
    let current = obj;
    
    for (const part of parts) {
        if (current === null || typeof current !== 'object') {
            return undefined;
        }
        
        // Handle array indices
        if (part.startsWith('[') && part.endsWith(']')) {
            const index = part.slice(1, -1);
            if (!Array.isArray(current)) return undefined;
            current = current[parseInt(index, 10)];
            continue;
        }
        
        // Handle regular properties
        if (part in current) {
            current = current[part];
        } else {
            return undefined;
        }
    }
    
    return current;
}
  
  /**
   * Builds a path string by joining path parts
   * @param {string[]} parts - Path parts to join
   * @returns {string} Joined path
   */
  export function buildPath(parts) {
    if (!parts || !parts.length) return '';
    
    return parts.reduce((path, part, index) => {
      // Don't add a dot before the first part
      if (index === 0) return part;
      
      // Handle array syntax
      if (part.includes('[')) {
        // If it's a plain array index like "[0]"
        if (part.startsWith('[')) {
          return `${path}${part}`;
        }
        // Otherwise it's a property with array access like "items[0]"
        return `${path}.${part}`;
      }
      
      return `${path}.${part}`;
    }, '');
  }
  
  /**
   * Parses an array access path like "items[0]" into its components
   * @param {string} pathPart - Path part to parse
   * @returns {Object|null} Object with key and index, or null if invalid format
   */
  export function parseArrayPath(pathPart) {
    // Handle direct array access like "[0]"
    if (pathPart.startsWith('[') && pathPart.endsWith(']')) {
      const index = pathPart.slice(1, -1);
      return {
        key: '', // Empty key for direct array access
        index: index ? parseInt(index, 10) : null
      };
    }
  
    // Handle property with array access like "items[0]"
    const match = pathPart.match(/^(\w+)(?:\[(\d+)\])?$/);
    if (!match) return null;
    
    const [, key, index] = match;
    return {
      key,
      index: index ? parseInt(index, 10) : null
    };
  }


  export function applyColumnState(options = {}) {
    const scrollTop = captureScrollTop();
    const table = document.getElementById('data-table');
    if (!table) return;
    
    // Diff header
    const thead = table.querySelector('thead');
    if (thead) {
      diffHeader(thead);
    }
    
    // Diff rows
    const tbody = table.querySelector('tbody');
    if (tbody) {
      const newCells = [];
      Array.from(tbody.querySelectorAll('tr')).forEach(row => {
        newCells.push(...diffRowCells(row));
      });
      
      // Apply highlights to new cells
      if (newCells.length > 0) {
        applySearchHighlightsToNewContent();
      }
    }
    
    if (!options.destructive) {
      restoreScrollTop(scrollTop);
    }
  }
  
  function captureScrollTop() {
    return document.getElementById('table-container')?.scrollTop || 0;
  }
  
  function restoreScrollTop(scrollTop) {
    const container = document.getElementById('table-container');
    if (container) {
      container.scrollTop = scrollTop;
    }
  }
  
  function diffHeader(thead) {
    // Implement header diff logic
    // ...
  }
  
  function diffRowCells(row) {
    const newCells = [];
    // Implement row cell diff logic
    // ...
    return newCells;
  }
  
  function createAttributeContract(element) {
    // Ensure all required data attributes are present
    return {
      path: element.getAttribute('data-path'),
      columnPath: element.getAttribute('data-column-path'),
      rowIdx: element.getAttribute('data-row-idx'),
      toggle: element.getAttribute('data-toggle')
    };
  }