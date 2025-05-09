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