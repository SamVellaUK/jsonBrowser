// Utils.js - Enhanced with filter support for JSON arrays

/**
 * Enhanced path segment parser supporting both index and filter syntax
 */
export function parsePathSegment(segment) {
  if (!segment.startsWith('[') || !segment.endsWith(']')) {
    return { type: 'key', value: segment };
  }
  
  const content = segment.slice(1, -1);
  
  // Check if it's a filter (contains '=')
  if (content.includes('=')) {
    const equalIndex = content.indexOf('=');
    const field = content.slice(0, equalIndex).trim();
    const value = content.slice(equalIndex + 1).trim();
    return { type: 'filter', field, value };
  }
  
  // Check if it's a numeric index
  const numIndex = parseInt(content, 10);
  if (!isNaN(numIndex)) {
    return { type: 'index', value: numIndex };
  }
  
  // Default to treating as a key
  return { type: 'key', value: content };
}

/**
 * Enhanced path splitter that preserves bracket syntax
 */
export function splitJsonPath(path) {
  if (!path) return [];
  
  const segments = [];
  let current = '';
  let inBrackets = false;
  
  for (let i = 0; i < path.length; i++) {
    const char = path[i];
    
    if (char === '[') {
      if (current) {
        segments.push(current);
        current = '';
      }
      current = '[';
      inBrackets = true;
    } else if (char === ']' && inBrackets) {
      current += ']';
      segments.push(current);
      current = '';
      inBrackets = false;
    } else if (char === '.' && !inBrackets) {
      if (current) {
        segments.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  
  if (current) {
    segments.push(current);
  }
  
  return segments.filter(s => s.length > 0);
}

/**
 * Enhanced path resolver supporting filters
 */
export function resolvePath(obj, path) {
  if (!path || obj == null) return obj;
  
  const segments = splitJsonPath(path);
  let current = obj;
  
  for (const segment of segments) {
    if (current == null) return undefined;
    
    const parsed = parsePathSegment(segment);
    
    switch (parsed.type) {
      case 'key':
        current = current[parsed.value];
        break;
      case 'index':
        current = expandByIndex(current, parsed.value);
        break;
      case 'filter':
        current = expandByFilter(current, parsed.field, parsed.value);
        break;
      default:
        return undefined;
    }
  }
  
  return current;
}

/**
 * Array expansion by index
 */
export function expandByIndex(arr, idx) {
  if (!Array.isArray(arr) || idx < 0 || idx >= arr.length) {
    return undefined;
  }
  return arr[idx];
}

/**
 * Array expansion by field filter
 */
export function expandByFilter(arr, field, value) {
  if (!Array.isArray(arr)) return undefined;
  
  return arr.find(item => {
    if (!item || typeof item !== 'object') return false;
    return String(item[field]) === String(value);
  });
}

/**
 * Enhanced nested path expansion
 */
export function expandNestedPath(obj, path) {
  return resolvePath(obj, path);
}

// DOM utility functions
export function createElement(tag, attrs = {}, props = {}) {
  const el = document.createElement(tag);
  
  // Set attributes
  if (attrs.id) el.id = attrs.id;
  if (attrs.className) el.className = attrs.className;
  if (attrs.dataset) {
    for (const [key, value] of Object.entries(attrs.dataset)) {
      el.dataset[key] = value;
    }
  }
  
  // Set properties
  for (const [key, value] of Object.entries(props)) {
    el[key] = value;
  }
  
  return el;
}

export function createCell(content = null, attrs = {}) {
  const td = createElement('td', attrs);
  if (content !== null) {
    td.textContent = content;
  }
  return td;
}

export function createHeaderCell(content, attrs = {}) {
  const th = createElement('th', attrs);
  th.textContent = content;
  return th;
}

export function createToggle() {
  const toggle = createElement('span', { className: 'toggle-nest' });
  toggle.textContent = '[+]';
  return toggle;
}

export function createNestedContainer(path, rowIndex) {
  return createElement('div', {
    className: 'nested-content',
    dataset: { parentPath: path, rowIndex: String(rowIndex) }
  });
}

export function createTableContainer() {
  const container = createElement('div', { id: 'table-container' });
  const root = document.getElementById('json-root');
  if (root) {
    root.appendChild(container);
  } else {
    document.body.appendChild(container);
  }
  return container;
}

export function setToggleState(toggle, nested, expanded) {
  if (expanded) {
    toggle.textContent = '[-]';
    nested.style.display = 'block';
  } else {
    toggle.textContent = '[+]';
    nested.style.display = 'none';
  }
}

// Additional utility functions that might have been in the original Utils.js

/**
 * Deep clone an object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Safely get nested property value
 */
export function safeGet(obj, path, defaultValue = undefined) {
  try {
    return resolvePath(obj, path) ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Format a value for display
 */
export function formatValue(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value.toString();
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === 'object') return `Object(${Object.keys(value).length} keys)`;
  return String(value);
}

/**
 * Get the data type of a value
 */
export function getDataType(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Escape HTML characters
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Debounce function calls
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function calls
 */
export function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Generate a unique ID
 */
export function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Check if an element is visible in the viewport
 */
export function isElementVisible(element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Scroll element into view smoothly
 */
export function scrollIntoView(element, options = {}) {
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'nearest',
    ...options
  });
}

/**
 * Get all text content from an element, including nested elements
 */
export function getTextContent(element) {
  return element.textContent || element.innerText || '';
}

/**
 * Find the closest parent element matching a selector
 */
export function findClosest(element, selector) {
  return element.closest ? element.closest(selector) : null;
}

/**
 * Add event listener with cleanup
 */
export function addEventListenerWithCleanup(element, event, handler, options = {}) {
  element.addEventListener(event, handler, options);
  return () => element.removeEventListener(event, handler, options);
}

/**
 * Create a promise that resolves after a delay
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert array to object using a key function
 */
export function arrayToObject(array, keyFn) {
  return array.reduce((obj, item) => {
    const key = keyFn(item);
    obj[key] = item;
    return obj;
  }, {});
}

/**
 * Group array items by a key function
 */
export function groupBy(array, keyFn) {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {});
}

/**
 * Remove duplicates from array
 */
export function uniqueArray(array, keyFn = item => item) {
  const seen = new Set();
  return array.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}