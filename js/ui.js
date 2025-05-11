// ui.js
import { state } from './main.js';
import { performSearch, navigateSearch, applySearchHighlightsToNewContent, refreshDomMatches, updateSearchCounter } from './search.js'; 
import * as DomUtils from './Utils.js';
import { splitJsonPath } from './Utils.js';
import { renderTable, renderNestedTable, promoteField, demoteField } from './TableRenderer.js';
                
 

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

 // ——— DEBUGGING for SQL modal ———
 const sqlBtn    = document.getElementById('SQL');
 const sqlPanel  = document.getElementById('sql-panel');
 const dialectEl = document.getElementById('sql-dialect');
 const closeBtn  = document.getElementById('close-sql');

 console.log('⚙️ [init] SQL button:', sqlBtn);
 console.log('⚙️ [init] SQL panel :', sqlPanel);
 console.log('⚙️ [init] Dialect sel:', dialectEl);
 console.log('⚙️ [init] Close button:', closeBtn);

 if (!sqlBtn) {
   console.error('❌ Could not find #SQL button in DOM!');
 }
 if (!sqlPanel) {
   console.error('❌ Could not find #sql-panel div! Did you insert the modal HTML?');
 }

 sqlBtn?.addEventListener('click', () => {
  console.log('👉 SQL click handler');
  // remove hidden class:
  sqlPanel.classList.remove('hidden');
  console.log('style.display (inline):', sqlPanel.style.display);
  console.log('computed:', getComputedStyle(sqlPanel).display);
  // generate & inject SQL
  const dialect = dialectEl?.value || 'postgres';
  document.getElementById('sql-content').textContent =
    buildRecreateSql('your_table_name', dialect);
});

// close
closeBtn?.addEventListener('click', () => {
  console.log('👉 Close SQL panel');
  sqlPanel.classList.add('hidden');
});

dialectEl?.addEventListener('change', () => {
  if (!sqlPanel.classList.contains('hidden')) {
    const sql = buildRecreateSql(currentTableName(), dialectEl.value);
    document.getElementById('sql-content').textContent = sql;
  }
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
        const obj    = DomUtils.resolvePath(state.data[rowIdx], parentPath);
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
 * Build a very simple "schema" from up to the first 5 rows.
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
export function renderColumnChooser() {
  // ── 1) Rebuild the JSON-tree on the left
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

  // ── 2) Populate the “Active Columns” box on the right
  const active = document.getElementById('active-columns');
  active.innerHTML = '';  // clear previous
  updateActiveColumnsBox();
}

// ui.js


export function updateActiveColumnsBox() {
  const container = document.getElementById('active-columns');
  if (!container) return;

  console.log('Updating active columns box');
  container.innerHTML = '';

  const { order, visibleColumns } = state.columnState;

  order.forEach((path, idx) => {
    // find the metadata for this path
    const colDef = visibleColumns.find(c => c.path === path);
    const label = colDef?.label || path;

    const item = document.createElement('div');
    item.classList.add('active-column-item');
    item.dataset.path = path;



    // up/down buttons
    const btns = document.createElement('span');
    btns.classList.add('move-buttons');
    btns.style.marginLeft = '8px';

    const up = document.createElement('button');
    up.textContent = '↑';
    up.disabled = idx === 0;
    up.addEventListener('click', () => {
      if (idx === 0) return;
      // swap in order array
      [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
      updateActiveColumnsBox();
      renderTable();
    });

    const down = document.createElement('button');
    down.textContent = '↓';
    down.disabled = idx === order.length - 1;
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
    item.appendChild(span);
    container.appendChild(item);
  });
}

const INDENT_PX = 10;  // pixels per level


function createTreeNode(key, node, depth, parentPath = '') {
  // 1) Build the “segment” for this key (add [0] if it’s an array)
  const pathSegment = node._isArray ? `${key}[0]` : key;
  // 2) Prepend the parentPath if it exists
  const fullPath = parentPath
    ? `${parentPath}.${pathSegment}`
    : pathSegment;

  // 3) Create your container and stash the path
  const item = document.createElement('div');
  item.className = 'field-item';
  item.style.marginLeft = `${depth + INDENT_PX}px`;
  item.dataset.path = fullPath;

  // 4) Checkbox: checked if this path is already in your columns
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = state.columnState.order.includes(fullPath);
  checkbox.style.marginRight = '4px';

  // 5) When the user toggles it, simply refer to your stored path
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      // Only promote if it isn't already in the column order
      if (!state.columnState.order.includes(fullPath)) {
        promoteField(fullPath);
      }
    } else {
      // Remove it cleanly (see demoteField implementation below)
      demoteField(fullPath);
    }
    updateActiveColumnsBox(); 
  });

  item.appendChild(checkbox);

  // 6) If this node has children, render a “[-]/[+]” and recurse
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

  // 7) The label for the key (with [] if array)
  const label = document.createElement('span');
  label.style.marginLeft = '6px';
  label.textContent = node._isArray ? `${key}[]` : key;
  item.appendChild(label);

  // 8) Recurse for children, passing along `fullPath`
  if (childKeys.length) {
    const nested = document.createElement('div');
    nested.className = 'nested-content';
    nested.style.display = 'block';   // default expanded
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

/**
 * Builds a Postgres SELECT listing all current columns in order,
 * extracting nested JSON fields via -> and ->>:
 */

export function buildRecreateSql(tableName, dialect = 'postgres') {
  switch (dialect) {
    case 'snowflake':  return buildSnowflakeSql(tableName);
    case 'sqlserver':  return buildSqlServerSql(tableName);
    case 'oracle':     return buildOracleSql(tableName);
    default:           return buildPostgresSql(tableName);
  }
}

/**
 * Postgres JSON extraction (as before).
 */
export function buildPostgresSql(tableName) {
  
  const cols = state.columnState.order.map(path => {
    
    if (!path.includes('.') && !path.includes('[')) {
      return `"${path}"`;
    }
    const parts = splitJsonPath(path);
    const root = parts[0], middle = parts.slice(1, -1), last = parts.at(-1);
    let expr = `"${root}"`;
    middle.forEach(seg => {
      if (seg.startsWith('[')) {
        expr += `->${seg.slice(1,-1)}`;
      } else {
        expr += `->'${seg}'`;
      }
    });
    if (last.startsWith('[')) {
      expr += `->>${last.slice(1,-1)}`;
    } else {
      expr += `->>'${last}'`;
    }
    const alias = path.replace(/[\.\[\]]+/g, '_');
    return `${expr} AS "${alias}"`;
  });
  return `SELECT\n  ${cols.join(',\n  ')}\nFROM ${tableName};`;
}

/**
 * Snowflake JSON extraction using colon + brackets and ::STRING cast.
 */
export function buildSnowflakeSql(tableName) {
  const cols = state.columnState.order.map(path => {
    if (!path.includes('.') && !path.includes('[')) {
      return `"${path}"`;
    }
    const parts = splitJsonPath(path);
    const root = parts[0], rest = parts.slice(1);
    // start with the column reference
    let expr = `"${root}"`;
    // every key -> :key, every index -> [idx]
    rest.forEach((seg, idx) => {
      if (seg.startsWith('[')) {
        expr += `[${seg.slice(1,-1)}]`;
      } else {
        expr += `:"${seg}"`;
      }
    });
    // final cast to STRING for scalar extraction
    expr += '::STRING';
    // alias by flattening
    const alias = path.replace(/[\.\[\]]+/g, '_');
    return `${expr} AS "${alias}"`;
  });
  return `SELECT\n  ${cols.join(',\n  ')}\nFROM ${tableName};`;
}

export function buildSqlServerSql(tableName) {
  const cols = state.columnState.order.map(path => {
    // top-level
    if (!/[.\[]/.test(path)) {
      return `[${path}]`;
    }
    // nested JSON path
    const parts = splitJsonPath(path);
    const root = parts.shift();
    // build a JSON path like $.child[0].foo
    const jsonPath = '$.' + parts.map(seg =>
      seg.startsWith('[')
        ? `[${seg.slice(1,-1)}]`
        : `.${seg}`
    ).join('');
    const alias = path.replace(/[\.\[\]]+/g,'_');
    return `JSON_VALUE([${root}], '${jsonPath}') AS [${alias}]`;
  });

  return [
    `SELECT`,
    `  ${cols.join(',\n  ')}`,
    `FROM [${tableName}];`
  ].join('\n');
}

/**
 * Oracle JSON extraction using JSON_VALUE():
 */
export function buildOracleSql(tableName) {
  const cols = state.columnState.order.map(path => {
    // plain top-level
    if (!/[.\[]/.test(path)) {
      return `"${path}"`;
    }
    // nested JSON
    const parts = splitJsonPath(path);
    const root = parts.shift();
    // build a JSON-path: $.child[0].foo
    const jsonPath = '$' + parts.map(seg =>
      seg.startsWith('[')
        ? seg            // already “[0]”
        : `.${seg}`
    ).join('');
    const alias = path.replace(/[\.\[\]]+/g,'_');
    return `JSON_VALUE("${root}", '${jsonPath}') AS "${alias}"`;
  });

  return [
    `SELECT`,
    `  ${cols.join(',\n  ')}`,
    `FROM "${tableName}";`
  ].join('\n');
}