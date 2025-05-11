// ui.js
import { state } from './main.js';
import { performSearch, navigateSearch, applySearchHighlightsToNewContent, refreshDomMatches, updateSearchCounter } from './search.js'; 
import * as DomUtils from './Utils.js';
import { renderNestedTable } from './TableRenderer.js';
                
 

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

  // NEW Edit-mode toggle — no table re-render!
  const editBtn = document.getElementById('edit-mode');
  editBtn?.addEventListener('click', () => {
    state.editMode = !state.editMode;

    // 1️⃣ flip button style
    editBtn.classList.toggle('active', state.editMode);

    // 2️⃣ just add/remove CSS class on container 
    const container = document.getElementById('table-container');
    container?.classList.toggle('edit-mode', state.editMode);

    // 3️⃣ re-apply any active search highlights
    applySearchHighlightsToNewContent();
  });

    // 1️⃣ Open the overlay and render the JSON‐model tree
    document.getElementById('column-chooser-button')?.addEventListener('click', () => {
      renderColumnChooser();
      document.getElementById('column-chooser').style.display = 'block';
    });
  
    // 2️⃣ Close the overlay
    document.getElementById('close-column-chooser')?.addEventListener('click', () => {
      document.getElementById('column-chooser').style.display = 'none';
    });

    
}

// Fix for handling table click with resolvePath function
function handleTableClick(event) {
  const target = event.target;
  
  // Handle toggle clicks
  if (target.classList.contains('toggle-nest')) {
    const nested = target.parentElement?.querySelector(':scope > .nested-content');
    if (nested) {
      
      const isExpanded = nested.style.display === 'none';
      DomUtils.setToggleState(target, nested, isExpanded);
      
      if (isExpanded && nested.childElementCount === 0) {
        
        const path = nested.dataset.parentPath;
        const rowIndex = nested.dataset.rowIndex;
        
        if (path && rowIndex !== undefined) {
          // FIXED: Use the proper DomUtils.resolvePath instead of local function
          const objValue = DomUtils.resolvePath(state.data[rowIndex], path);
          console.log(`objvalue:`, objValue);
          if (objValue) {
            
            const nestedTable = renderNestedTable(objValue, path, parseInt(rowIndex, 10));
            nested.appendChild(nestedTable);
            applySearchHighlightsToNewContent(nested);
            
            // New: Dispatch custom event to notify of expansion
            const expansionEvent = new CustomEvent('nestedTableExpanded', {
              detail: { path, rowIndex }
            });
            target.dispatchEvent(expansionEvent);
          }
        }
      }
    }
    event.stopPropagation();
  }

  
}


/* ────────────────────────────────────────────────────────── */
export function toggleAllNested(expand = true) {
  const scope = document.getElementById('table-container');
  if (!scope) return;

  /* -------- Collapse‑all: single pass is enough -------- */
  if (!expand) {
    scope.querySelectorAll('.toggle-nest').forEach(toggle => {
      const nested = toggle.parentElement?.querySelector(':scope > .nested-content');
      if (nested) DomUtils.setToggleState(toggle, nested, false);
    });
    refreshDomMatches();
    updateSearchCounter();
    return;
  }

  /* -------- Full‑depth expansion --------
     Breadth‑first so every newly rendered level is revisited until
     no more collapsed descendants remain.
  ------------------------------------------------------------- */
  const visited = new WeakSet();
  let queue = Array.from(scope.querySelectorAll('.toggle-nest'));

  while (queue.length) {
    const next = [];
    queue.forEach(toggle => {
      if (visited.has(toggle)) return;
      visited.add(toggle);

      const nested = toggle.parentElement?.querySelector(':scope > .nested-content');
      if (!nested) return;

      /* Open the current block */
      DomUtils.setToggleState(toggle, nested, true);

      /* Lazily render rows never opened before */
      if (nested.childElementCount === 0) {
        const parentPath = nested.dataset.parentPath;
        const idxAttr    = nested.dataset.rowIndex;
        if (parentPath == null || idxAttr == null) return;

        const rowIdx = parseInt(idxAttr, 10);
        const obj    = resolvePath(state.data[rowIdx], parentPath);
        if (obj === undefined) return;

        const tbl = renderNestedTable(obj, parentPath, rowIdx);
        nested.appendChild(tbl);
        applySearchHighlightsToNewContent(nested);
      }

      /* Queue any deeper toggles we just exposed */
      nested.querySelectorAll('.toggle-nest').forEach(t => next.push(t));
    });
    queue = next;   // dive one level deeper
  }

  /* ── Search bookkeeping ─────────────────────────────────────────── */
  refreshDomMatches();
  updateSearchCounter();
}

/* ────────────────────────────────────────────────────────── */

export function toggleJsonPaths() {
  state.showJsonPaths = !state.showJsonPaths;  // flip flag
  applyJsonPathVisibility();                   // add / remove class

  // visual cue on the button
  document.getElementById('show-json-paths')
        ?.classList.toggle('active', state.showJsonPaths);
}
function applyJsonPathVisibility() {
  const container = document.getElementById('table-container');
  if (!container) return;
  container.classList.toggle('show-paths', state.showJsonPaths);
}

/**
 * Build a very simple “schema” from up to the first 5 rows.
 * Each node tracks whether it came from an Array and its children.
 */
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

/**
 * Given state.jsonStructure, render it into #available-fields
 */
// replace your old render + createTreeNode with this:

function renderColumnChooser() {
  state.jsonStructure = computeJsonStructure(state.data.slice(0, 5));

  const avail = document.getElementById('available-fields');
  let tree = avail.querySelector('.field-tree');
  if (!tree) {
    tree = document.createElement('div');
    tree.className = 'field-tree';
    avail.appendChild(tree);
  }
  tree.innerHTML = '';

  // kick off recursion at depth=0
  Object.entries(state.jsonStructure).forEach(([key,node]) => {
    tree.appendChild(createTreeNode(key, node, 0));
  });
}


const INDENT_PX = 10;  // pixels per level

function createTreeNode(key, node, depth) {
  // 1️⃣ The outer container for this single field
  const item = document.createElement('div');
  item.className = 'field-item';
  item.style.marginLeft = `${depth + INDENT_PX}px`;

  // 2️⃣ Do we actually have any nested children?
  const childKeys = Object.keys(node.children);
  const hasKids  = childKeys.length > 0;

  // 3️⃣ If so, create the “[–]/[+]” toggle
  if (hasKids) {
    const toggle = document.createElement('span');
    toggle.className   = 'toggle-nest';
    toggle.textContent = '[-]';            // start expanded
    toggle.style.cursor = 'pointer';
    toggle.style.marginRight = '6px';
    item.appendChild(toggle);

    // Wire up collapse/expand
    toggle.addEventListener('click', () => {
      const nested = item.querySelector(':scope > .nested-content');
      const expanded = nested.style.display !== 'none';
      DomUtils.setToggleState(toggle, nested, !expanded);
    });
  }

  // 4️⃣ Always append the field name
  const label = document.createElement('span');
  label.textContent = node._isArray ? `${key}[]` : key;
  item.appendChild(label);

  // 5️⃣ If there are children, wrap _them_ in a container
  if (hasKids) {
    const nested = document.createElement('div');
    nested.className = 'nested-content';
    nested.style.display = 'block';        // default: expanded
    childKeys.forEach(ck => {
      nested.appendChild(createTreeNode(ck, node.children[ck], depth + 1));
    });
    item.appendChild(nested);
  }

  return item;
}
