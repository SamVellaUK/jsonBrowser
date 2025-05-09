/**
 * Utility functions for DOM manipulation
 */

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