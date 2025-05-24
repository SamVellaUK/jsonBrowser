// ui.js - Enhanced with array context menu functionality
import { state } from './main.js';
import { performSearch, navigateSearch, applySearchHighlightsToNewContent, refreshDomMatches, updateSearchCounter } from './search.js'; 
import * as DomUtils from './Utils.js';
import { splitJsonPath, expandByIndex, expandByFilter, parsePathSegment } from './Utils.js';
import { renderTable, renderNestedTable, promoteField, demoteField } from './TableRenderer.js';
import {buildPostgresSql, buildSnowflakeSql, buildSqlServerSql, buildOracleSql } from './SqlBuilder.js';

// Global variables for array context menu
let currentArrayCell = null;
let currentArrayPath = '';
let currentArrayKeys = [];

export function initializeUI() {
  document.getElementById('table-container')?.addEventListener('click', handleTableClick);

  document.getElementById('search-button')?.addEventListener('click', () => {
    performSearch(document.getElementById('search-box').value.trim());
  });
  document.getElementById('search-next')?.addEventListener('click', () => navigateSearch('next'));
  document.getElementById('search-prev')?.addEventListener('click', () => navigateSearch('prev'));
  document.getElementById('expand-all')?.addEventListener('click', () => toggleAllNested(true));
  document.getElementById('collapse-all')?.addEventListener('click', () => toggleAllNested(false));
  document.getElementById('show-json-paths')?.addEventListener('click', toggleJsonPaths);

  // Edit-mode toggle
  const editBtn = document.getElementById('edit-mode');
  editBtn?.addEventListener('click', () => {
    state.editMode = !state.editMode;
    editBtn.classList.toggle('active', state.editMode);
    const container = document.getElementById('table-container');
    container?.classList.toggle('edit-mode', state.editMode);
    applySearchHighlightsToNewContent();
  });

  // Column chooser functionality
  document.getElementById('column-chooser-button')?.addEventListener('click', () => {
    renderColumnChooser();
    document.getElementById('column-chooser').style.display = 'block';
  });

  document.getElementById('close-column-chooser')?.addEventListener('click', () => {
    document.getElementById('column-chooser').style.display = 'none';
  });

  // SQL modal functionality
  const sqlBtn = document.getElementById('SQL');
  const sqlPanel = document.getElementById('sql-panel');
  const dialectEl = document.getElementById('sql-dialect');
  const closeBtn = document.getElementById('close-sql');

  sqlBtn?.addEventListener('click', () => {
    sqlPanel.classList.remove('hidden');
    const dialect = dialectEl?.value || 'postgres';
    document.getElementById('sql-content').textContent =
      buildRecreateSql('your_table_name', dialect);
  });

  closeBtn?.addEventListener('click', () => {
    sqlPanel.classList.add('hidden');
  });

  dialectEl?.addEventListener('change', () => {
    if (!sqlPanel.classList.contains('hidden')) {
      const sql = buildRecreateSql(currentTableName(), dialectEl.value);
      document.getElementById('sql-content').textContent = sql;
    }
  });

  // Initialize array context menu
  initializeArrayContextMenu();
}

function initializeArrayContextMenu() {
  const contextMenu = document.getElementById('array-context-menu');
  if (!contextMenu) return;

  const useIndexBtn = document.getElementById('use-index-btn');
  const filterByKeyBtn = document.getElementById('filter-by-key-btn');

  // Handle clicks on array cells
  document.addEventListener('click', (event) => {
    const target = event.target.closest('td[data-is-array="true"]');
    
    if (target) {
      // Don't show context menu for structured arrays - they expand normally
      if (target.hasAttribute('data-is-structured-array')) {
        return;
      }
      
      // For simple arrays, show context menu
      event.preventDefault();
      event.stopPropagation();
      
      currentArrayCell = target;
      currentArrayPath = target.dataset.arrayPath || '';
      currentArrayKeys = (target.dataset.arrayKeys || '').split(',').filter(k => k.trim());
      
      // Position context menu at click location
      contextMenu.style.left = event.pageX + 'px';
      contextMenu.style.top = event.pageY + 'px';
      contextMenu.classList.remove('hidden');
      
      return;
    }
    
    // Hide context menu on other clicks
    if (!contextMenu.contains(event.target)) {
      contextMenu.classList.add('hidden');
    }
  });

  // Handle "Use Index" button
  useIndexBtn?.addEventListener('click', () => {
    const index = prompt('Enter array index:');
    if (index !== null && !isNaN(parseInt(index, 10))) {
      const newPath = currentArrayPath + '[' + index + ']';
      drillIntoPath(newPath);
    }
    contextMenu.classList.add('hidden');
  });

  // Handle "Filter by Key" button
  filterByKeyBtn?.addEventListener('click', () => {
    if (currentArrayKeys.length === 0) {
      alert('No filterable keys found in this array');
      contextMenu.classList.add('hidden');
      return;
    }
    
    // Create field selection
    let field;
    if (currentArrayKeys.length === 1) {
      field = currentArrayKeys[0];
    } else {
      field = prompt('Select field to filter by:\n' + currentArrayKeys.join(', ') + '\n\nEnter field name:');
      if (!field || !currentArrayKeys.includes(field)) {
        alert('Invalid field name');
        contextMenu.classList.add('hidden');
        return;
      }
    }
    
    const value = prompt(`Enter value for ${field}:`);
    if (value !== null) {
      const newPath = currentArrayPath + '[' + field + '=' + value + ']';
      drillIntoPath(newPath);
    }
    contextMenu.classList.add('hidden');
  });
}

function drillIntoPath(path) {
  console.log('Drilling into path:', path);
  
  // Find the row that contains this path
  const pathParts = splitJsonPath(path);
  const rowIndex = getCurrentRowIndex();
  
  if (rowIndex >= 0 && rowIndex < state.data.length) {
    const result = DomUtils.resolvePath(state.data[rowIndex], path);
    console.log('Path result:', result);
    
    if (result !== undefined) {
      // Promote this path as a new column
      promoteField(path);
    } else {
      alert('No data found at the specified path');
    }
  }
}

function getCurrentRowIndex() {
  if (currentArrayCell) {
    const rowElement = currentArrayCell.closest('tr[data-row-index]');
    if (rowElement) {
      return parseInt(rowElement.dataset.rowIndex, 10);
    }
  }
  return 0; // Default to first row
}

function handleTableClick(event) {
  const target = event.target;
  
  // Check if we clicked on an expandable cell (or any element within it)
  const expandableCell = target.closest('td[data-expandable="true"]');
  
  if (expandableCell) {
    // Check if this expandable cell has a parent expandable cell
    // If so, we need to make sure we're not clicking inside the nested content area
    const parentExpandableCell = expandableCell.parentElement?.closest('td[data-expandable="true"]');
    if (parentExpandableCell) {
      // We're in a nested expandable cell - check if we clicked in the nested content area
      const nestedContent = expandableCell.querySelector('.nested-content');
      if (nestedContent && nestedContent.contains(target)) {
        // Clicked inside the nested content area, don't collapse the parent
        return;
      }
    }
    
    // Don't expand if this is an array cell that should show context menu
    if (expandableCell.hasAttribute('data-is-array') && !expandableCell.hasAttribute('data-is-structured-array')) {
      // For simple arrays, let the context menu handler deal with it
      return;
    }
    
    const toggle = expandableCell.querySelector('.toggle-nest');
    const nested = expandableCell.querySelector('.nested-content');
    
    if (toggle && nested) {
      // Get the actual computed display value (includes CSS rules)
      const computedDisplay = window.getComputedStyle(nested).display;
      const isCurrentlyExpanded = computedDisplay !== 'none';
      
      // Toggle to opposite state
      if (isCurrentlyExpanded) {
        // Collapse it
        toggle.textContent = '[+]';
        nested.style.display = 'none';
      } else {
        // Expand it
        toggle.textContent = '[-]';
        nested.style.display = 'block';
        
        // Load content if empty
        if (nested.childElementCount === 0) {
          const path = nested.dataset.parentPath;
          const rowIndex = nested.dataset.rowIndex;
          
          if (path && rowIndex !== undefined) {
            const objValue = DomUtils.resolvePath(state.data[rowIndex], path);
            console.log(`objvalue:`, objValue);
            if (objValue) {
              const nestedTable = renderNestedTable(objValue, path, parseInt(rowIndex, 10));
              nested.appendChild(nestedTable);
              applySearchHighlightsToNewContent(nested);
              
              // Dispatch custom event to notify of expansion
              const expansionEvent = new CustomEvent('nestedTableExpanded', {
                detail: { path, rowIndex }
              });
              expandableCell.dispatchEvent(expansionEvent);
            }
          }
        }
      }
    }
    event.stopPropagation();
    return;
  }
  
  // Handle legacy toggle clicks (for backwards compatibility with nested tables)
  if (target.classList.contains('toggle-nest')) {
    const nested = target.parentElement?.querySelector(':scope > .nested-content');
    if (nested) {
      // Get the actual computed display value (includes CSS rules)
      const computedDisplay = window.getComputedStyle(nested).display;
      const isCurrentlyExpanded = computedDisplay !== 'none';
      
      // Toggle to opposite state
      if (isCurrentlyExpanded) {
        // Collapse it
        target.textContent = '[+]';
        nested.style.display = 'none';
      } else {
        // Expand it
        target.textContent = '[-]';
        nested.style.display = 'block';
        
        // Load content if empty
        if (nested.childElementCount === 0) {
          const path = nested.dataset.parentPath;
          const rowIndex = nested.dataset.rowIndex;
          
          if (path && rowIndex !== undefined) {
            const objValue = DomUtils.resolvePath(state.data[rowIndex], path);
            console.log(`objvalue:`, objValue);
            if (objValue) {
              const nestedTable = renderNestedTable(objValue, path, parseInt(rowIndex, 10));
              nested.appendChild(nestedTable);
              applySearchHighlightsToNewContent(nested);
              
              // Dispatch custom event to notify of expansion
              const expansionEvent = new CustomEvent('nestedTableExpanded', {
                detail: { path, rowIndex }
              });
              target.dispatchEvent(expansionEvent);
            }
          }
        }
      }
    }
    event.stopPropagation();
  }
}

export function toggleAllNested(expand = true) {
  const scope = document.getElementById('table-container');
  if (!scope) return;

  if (!expand) {
    scope.querySelectorAll('.toggle-nest').forEach(toggle => {
      const nested = toggle.parentElement?.querySelector(':scope > .nested-content');
      if (nested) DomUtils.setToggleState(toggle, nested, false);
    });
    refreshDomMatches();
    updateSearchCounter();
    return;
  }

  // Full-depth expansion using breadth-first approach
  const visited = new WeakSet();
  let queue = Array.from(scope.querySelectorAll('.toggle-nest'));

  while (queue.length) {
    const next = [];
    queue.forEach(toggle => {
      if (visited.has(toggle)) return;
      visited.add(toggle);

      const nested = toggle.parentElement?.querySelector(':scope > .nested-content');
      if (!nested) return;

      DomUtils.setToggleState(toggle, nested, true);

      if (nested.childElementCount === 0) {
        const parentPath = nested.dataset.parentPath;
        const idxAttr = nested.dataset.rowIndex;
        if (parentPath == null || idxAttr == null) return;

        const rowIdx = parseInt(idxAttr, 10);
        const obj = DomUtils.resolvePath(state.data[rowIdx], parentPath);
        if (obj === undefined) return;

        const tbl = renderNestedTable(obj, parentPath, rowIdx);
        nested.appendChild(tbl);
        applySearchHighlightsToNewContent(nested);
      }

      nested.querySelectorAll('.toggle-nest').forEach(t => next.push(t));
    });
    queue = next;
  }

  refreshDomMatches();
  updateSearchCounter();
}

export function toggleJsonPaths() {
  state.showJsonPaths = !state.showJsonPaths;
  applyJsonPathVisibility();
  
  document.getElementById('show-json-paths')
        ?.classList.toggle('active', state.showJsonPaths);
}

function applyJsonPathVisibility() {
  const container = document.getElementById('table-container');
  if (!container) return;
  container.classList.toggle('show-paths', state.showJsonPaths);
}

function computeJsonStructure(rows) {
  const root = {};
  rows.forEach(row => mergeRow(root, row));
  return root;
}

function mergeRow(structNode, data) {
  if (data && typeof data === 'object') {
    if (Array.isArray(data)) {
      if (data.length) mergeRow(structNode, data[0]);
    } else {
      for (const [key, val] of Object.entries(data)) {
        if (!structNode[key]) {
          structNode[key] = { _isArray: false, children: {} };
        }
        if (val && typeof val === 'object') {
          if (Array.isArray(val)) {
            structNode[key]._isArray = true;
            if (val.length && typeof val[0] === 'object') {
              mergeRow(structNode[key].children, val[0]);
            }
          } else {
            mergeRow(structNode[key].children, val);
          }
        }
      }
    }
  }
}

export function renderColumnChooser() {
  // Rebuild the JSON-tree on the left
  state.jsonStructure = computeJsonStructure(state.data.slice(0, 5));
  const avail = document.getElementById('available-fields');
  let tree = avail.querySelector('.field-tree');
  if (!tree) {
    tree = document.createElement('div');
    tree.className = 'field-tree';
    avail.appendChild(tree);
  }
  tree.innerHTML = '';
  Object.entries(state.jsonStructure).forEach(([key, node]) => {
    tree.appendChild(createTreeNode(key, node, 0, ''));
  });

  // Populate the "Active Columns" box on the right
  const active = document.getElementById('active-columns');
  active.innerHTML = '';
  updateActiveColumnsBox();
}

export function updateActiveColumnsBox() {
  const container = document.getElementById('active-columns');
  if (!container) return;

  console.log('Updating active columns box');
  container.innerHTML = '';

  const { order, visibleColumns } = state.columnState;

  order.forEach((path, idx) => {
    const colDef = visibleColumns.find(c => c.path === path);
    const label = colDef?.label || path;

    const item = document.createElement('div');
    item.classList.add('active-column-item');
    item.dataset.path = path;

    // Remove button (X) - placed first for better UX
    const removeBtn = document.createElement('button');
    removeBtn.classList.add('remove-column-btn');
    removeBtn.textContent = '×';
    removeBtn.title = `Remove column "${label}"`;
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeColumn(path);
    });
    item.appendChild(removeBtn);

    // up/down buttons
    const btns = document.createElement('span');
    btns.classList.add('move-buttons');

    const up = document.createElement('button');
    up.textContent = '↑';
    up.disabled = idx === 0;
    up.title = 'Move up';
    up.addEventListener('click', () => {
      if (idx === 0) return;
      [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
      updateActiveColumnsBox();
      renderTable();
    });

    const down = document.createElement('button');
    down.textContent = '↓';
    down.disabled = idx === order.length - 1;
    down.title = 'Move down';
    down.addEventListener('click', () => {
      if (idx === order.length - 1) return;
      [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
      updateActiveColumnsBox();
      renderTable();
    });

    btns.append(up, down);
    item.appendChild(btns);
    
    // label
    const span = document.createElement('span');
    span.textContent = label;
    span.style.marginLeft = '8px';
    span.title = `Path: ${path}`;
    item.appendChild(span);
    
    container.appendChild(item);
  });
}

// New function to handle column removal
function removeColumn(path) {
  const colDef = state.columnState.visibleColumns.find(c => c.path === path);
  const label = colDef?.label || path;
  
  
  // Remove from state
  demoteField(path);
  
  // Update the active columns display
  updateActiveColumnsBox();
  
  // Update checkboxes in the left panel
  const checkbox = document.querySelector(`input[type="checkbox"][data-path="${path}"]`);
  if (checkbox) {
    checkbox.checked = false;
  } else {
    // Try to find by parent element's dataset
    const fieldItem = document.querySelector(`.field-item[data-path="${path}"] input[type="checkbox"]`);
    if (fieldItem) {
      fieldItem.checked = false;
    }
  }
}

const INDENT_PX = 10;

function createTreeNode(key, node, depth, parentPath = '') {
  // Build the "segment" for this key (add [0] if it's an array)
  const pathSegment = node._isArray ? `${key}[0]` : key;
  // Prepend the parentPath if it exists
  const fullPath = parentPath
    ? `${parentPath}.${pathSegment}`
    : pathSegment;

  // Create container and stash the path
  const item = document.createElement('div');
  item.className = 'field-item';
  item.style.marginLeft = `${depth + INDENT_PX}px`;
  item.dataset.path = fullPath;

  // Checkbox: checked if this path is already in columns
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = state.columnState.order.includes(fullPath);
  checkbox.style.marginRight = '4px';
  checkbox.dataset.path = fullPath; // Add data attribute for easier lookup

  // When the user toggles it, refer to stored path
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      if (!state.columnState.order.includes(fullPath)) {
        promoteField(fullPath);
      }
    } else {
      demoteField(fullPath);
    }
    updateActiveColumnsBox(); 
  });

  item.appendChild(checkbox);

  // If this node has children, render a "[-]/[+]" and recurse
  const childKeys = Object.keys(node.children);
  if (childKeys.length) {
    const toggle = document.createElement('span');
    toggle.className = 'toggle-nest';
    toggle.textContent = '[-]';
    toggle.style.cursor = 'pointer';
    toggle.style.marginRight = '6px';
    toggle.addEventListener('click', () => {
      const nested = item.querySelector(':scope > .nested-content');
      const expanded = nested.style.display !== 'none';
      DomUtils.setToggleState(toggle, nested, !expanded);
    });
    item.appendChild(toggle);
  }

  // The label for the key (with [] if array)
  const label = document.createElement('span');
  label.style.marginLeft = '6px';
  label.textContent = node._isArray ? `${key}[]` : key;
  item.appendChild(label);

  // Recurse for children, passing along `fullPath`
  if (childKeys.length) {
    const nested = document.createElement('div');
    nested.className = 'nested-content';
    nested.style.display = 'block';
    childKeys.forEach(childKey => {
      nested.appendChild(
        createTreeNode(childKey, node.children[childKey], depth + 1, fullPath)
      );
    });
    item.appendChild(nested);
  }

  return item;
}

function currentTableName() {
  return 'your_table_name';
}

export function buildRecreateSql(tableName, dialect = 'postgres') {
  switch (dialect) {
    case 'snowflake':  return buildSnowflakeSql(tableName);
    case 'sqlserver':  return buildSqlServerSql(tableName);
    case 'oracle':     return buildOracleSql(tableName);
    default:           return buildPostgresSql(tableName);
  }
}

// SQL modal functionality
const sqlBtn = document.getElementById('SQL');
const sqlPanel = document.getElementById('sql-panel');
const dialectEl = document.getElementById('sql-dialect');
const closeBtn = document.getElementById('close-sql');
const copyBtn = document.getElementById('copy-sql');

sqlBtn?.addEventListener('click', () => {
  sqlPanel.classList.remove('hidden');
  const dialect = dialectEl?.value || 'postgres';
  document.getElementById('sql-content').textContent =
    buildRecreateSql('your_table_name', dialect);
});

closeBtn?.addEventListener('click', () => {
  sqlPanel.classList.add('hidden');
});

copyBtn?.addEventListener('click', async () => {
  const sqlContent = document.getElementById('sql-content').textContent;
  try {
    await navigator.clipboard.writeText(sqlContent);
    
    // Visual feedback - temporarily change button text
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    copyBtn.style.backgroundColor = '#28a745';
    
    setTimeout(() => {
      copyBtn.textContent = originalText;
      copyBtn.style.backgroundColor = '#28a745'; // Keep green color
    }, 2000);
    
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = sqlContent;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
      document.execCommand('copy');
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy to Clipboard';
      }, 2000);
    } catch (fallbackErr) {
      console.error('Fallback copy failed:', fallbackErr);
      copyBtn.textContent = 'Copy Failed';
      setTimeout(() => {
        copyBtn.textContent = 'Copy to Clipboard';
      }, 2000);
    }
    
    document.body.removeChild(textArea);
  }
});

dialectEl?.addEventListener('change', () => {
  if (!sqlPanel.classList.contains('hidden')) {
    const sql = buildRecreateSql(currentTableName(), dialectEl.value);
    document.getElementById('sql-content').textContent = sql;
  }
});