/**
 * renderer.js - Main entry point for JSON table renderer
 */

import { state } from './state.js';
import { renderTable, renderCellContent, renderNestedTable } from './TableRenderer.js';
import { expandToPath } from './PathExpander.js';
import { resolvePath } from './PathUtils.js';
import * as DomUtils from './DomUtils.js';

// Export public API
export {
  renderTable,
  renderCellContent,
  renderNestedTable,
  resolvePath,
  expandToPath
};

// Expose selected functions to window for debugging and legacy support
window.expandToPath = expandToPath;
window.resolvePath = resolvePath;