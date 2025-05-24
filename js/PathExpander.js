// PathExpander.js - Enhanced path expansion with filter support
import { resolvePath, parsePathSegment, splitJsonPath, expandByIndex, expandByFilter } from './Utils.js';
import { state } from './main.js';

/**
 * Enhanced path expansion that supports both index and filter operations
 */
export function expandToPath(basePath, targetPath) {
  if (!targetPath) return null;
  
  const segments = splitJsonPath(targetPath);
  let currentPath = '';
  const expandedSegments = [];
  
  for (const segment of segments) {
    const parsed = parsePathSegment(segment);
    currentPath = currentPath ? `${currentPath}.${segment}` : segment;
    
    // Check if we need to expand this segment
    const needsExpansion = parsed.type === 'index' || parsed.type === 'filter';
    
    expandedSegments.push({
      segment,
      parsed,
      path: currentPath,
      needsExpansion
    });
  }
  
  return expandedSegments;
}

/**
 * Navigate to a specific path by expanding necessary nodes
 */
export function navigateToPath(targetPath, rowIndex = 0) {
  if (!targetPath || rowIndex >= state.data.length) {
    console.warn('Invalid path or row index');
    return false;
  }
  
  const expandedSegments = expandToPath('', targetPath);
  if (!expandedSegments) return false;
  
  // Validate that the path exists in the data
  const finalValue = resolvePath(state.data[rowIndex], targetPath);
  if (finalValue === undefined) {
    console.warn('Path does not exist in data:', targetPath);
    return false;
  }
  
  // Find and expand the necessary DOM elements
  expandDomPath(expandedSegments, rowIndex);
  
  return true;
}

/**
 * Expand DOM elements along a path
 */
function expandDomPath(expandedSegments, rowIndex) {
  const container = document.getElementById('table-container');
  if (!container) return;
  
  let currentElement = container;
  let currentPath = '';
  
  for (const { segment, parsed, path, needsExpansion } of expandedSegments) {
    if (needsExpansion) {
      // Find the toggle element for this path
      const pathSelector = `[data-parent-path="${currentPath}"][data-row-index="${rowIndex}"]`;
      const nestedContainer = currentElement.querySelector(`div.nested-content${pathSelector}`);
      
      if (nestedContainer) {
        const toggle = nestedContainer.parentElement?.querySelector('.toggle-nest');
        if (toggle && nestedContainer.style.display === 'none') {
          // Expand this section
          toggle.click();
        }
        currentElement = nestedContainer;
      }
    }
    
    currentPath = path;
  }
}

/**
 * Get all possible filter keys for a given array path
 */
export function getFilterKeysForPath(arrayPath, rowIndex = 0) {
  if (rowIndex >= state.data.length) return [];
  
  const arrayValue = resolvePath(state.data[rowIndex], arrayPath);
  if (!Array.isArray(arrayValue) || arrayValue.length === 0) return [];
  
  const keys = new Set();
  
  // Sample first few items to find common keys
  const sampleSize = Math.min(3, arrayValue.length);
  for (let i = 0; i < sampleSize; i++) {
    const item = arrayValue[i];
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      Object.keys(item).forEach(key => {
        // Only include primitive values as potential filter keys
        if (typeof item[key] !== 'object' || item[key] === null) {
          keys.add(key);
        }
      });
    }
  }
  
  return Array.from(keys).sort();
}

/**
 * Get all possible values for a filter key in an array
 */
export function getFilterValuesForKey(arrayPath, filterKey, rowIndex = 0) {
  if (rowIndex >= state.data.length) return [];
  
  const arrayValue = resolvePath(state.data[rowIndex], arrayPath);
  if (!Array.isArray(arrayValue)) return [];
  
  const values = new Set();
  
  arrayValue.forEach(item => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const value = item[filterKey];
      if (value !== undefined && (typeof value !== 'object' || value === null)) {
        values.add(String(value));
      }
    }
  });
  
  return Array.from(values).sort();
}

/**
 * Build a filter path from components
 */
export function buildFilterPath(basePath, filterKey, filterValue) {
  return `${basePath}[${filterKey}=${filterValue}]`;
}

/**
 * Build an index path from components
 */
export function buildIndexPath(basePath, index) {
  return `${basePath}[${index}]`;
}

/**
 * Check if a path contains filter operations
 */
export function pathContainsFilters(path) {
  const segments = splitJsonPath(path);
  return segments.some(segment => {
    const parsed = parsePathSegment(segment);
    return parsed.type === 'filter';
  });
}

/**
 * Validate a path against the current data
 */
export function validatePath(path, rowIndex = 0) {
  if (!path || rowIndex >= state.data.length) return false;
  
  try {
    const result = resolvePath(state.data[rowIndex], path);
    return result !== undefined;
  } catch (error) {
    console.warn('Error validating path:', path, error);
    return false;
  }
}

/**
 * Get the type of data at a given path
 */
export function getPathDataType(path, rowIndex = 0) {
  if (!validatePath(path, rowIndex)) return 'undefined';
  
  const result = resolvePath(state.data[rowIndex], path);
  
  if (result === null) return 'null';
  if (Array.isArray(result)) return 'array';
  if (typeof result === 'object') return 'object';
  
  return typeof result;
}

/**
 * Enhanced path expansion that handles filter syntax in path segments
 */
export function expandPathWithFilters(obj, path) {
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
 * Get filter suggestions for a given array path
 */
export function getFilterSuggestions(arrayPath, rowIndex = 0) {
  const filterKeys = getFilterKeysForPath(arrayPath, rowIndex);
  const suggestions = [];
  
  filterKeys.forEach(key => {
    const values = getFilterValuesForKey(arrayPath, key, rowIndex);
    values.slice(0, 5).forEach(value => { // Limit to first 5 values per key
      suggestions.push({
        key,
        value,
        path: buildFilterPath(arrayPath, key, value),
        displayText: `${key}=${value}`
      });
    });
  });
  
  return suggestions;
}

/**
 * Analyze path complexity and suggest optimization
 */
export function analyzePath(path) {
  const segments = splitJsonPath(path);
  const analysis = {
    segments: segments.length,
    hasFilters: false,
    hasIndices: false,
    complexity: 'simple',
    suggestions: []
  };
  
  segments.forEach(segment => {
    const parsed = parsePathSegment(segment);
    if (parsed.type === 'filter') {
      analysis.hasFilters = true;
    } else if (parsed.type === 'index') {
      analysis.hasIndices = true;
    }
  });
  
  if (analysis.hasFilters && analysis.hasIndices) {
    analysis.complexity = 'complex';
    analysis.suggestions.push('Consider using either filters or indices consistently');
  } else if (analysis.hasFilters) {
    analysis.complexity = 'filtered';
  } else if (analysis.hasIndices) {
    analysis.complexity = 'indexed';
  }
  
  if (segments.length > 5) {
    analysis.complexity = 'deep';
    analysis.suggestions.push('Deep paths may impact performance');
  }
  
  return analysis;
}

/**
 * Convert index-based path to filter-based path when possible
 */
export function convertIndexToFilter(path, rowIndex = 0) {
  const segments = splitJsonPath(path);
  const convertedSegments = [];
  let hasConversions = false;
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const parsed = parsePathSegment(segment);
    
    if (parsed.type === 'index') {
      // Try to find a suitable filter key for this index
      const pathToArray = segments.slice(0, i).reduce((acc, seg) => {
        if (seg.startsWith('[')) return `${acc}${seg}`;
        return acc ? `${acc}.${seg}` : seg;
      }, '');
      
      const arrayValue = resolvePath(state.data[rowIndex], pathToArray);
      if (Array.isArray(arrayValue) && arrayValue[parsed.value]) {
        const item = arrayValue[parsed.value];
        if (item && typeof item === 'object') {
          // Look for a unique identifier field
          const uniqueKeys = ['id', 'name', 'key', 'code', 'uuid'];
          for (const key of uniqueKeys) {
            if (item[key] !== undefined) {
              convertedSegments.push(`[${key}=${item[key]}]`);
              hasConversions = true;
              break;
            }
          }
          if (!hasConversions) {
            convertedSegments.push(segment); // Keep original if no conversion possible
          }
        } else {
          convertedSegments.push(segment);
        }
      } else {
        convertedSegments.push(segment);
      }
    } else {
      convertedSegments.push(segment);
    }
  }
  
  if (!hasConversions) return null; // No conversions were possible
  
  return convertedSegments.reduce((acc, seg) => {
    if (seg.startsWith('[')) return `${acc}${seg}`;
    return acc ? `${acc}.${seg}` : seg;
  }, '');
}