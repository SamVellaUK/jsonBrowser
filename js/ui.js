// ui.js
import { state } from './main.js';
import * as Search from './search.js';
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
}

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
          const objValue = resolvePath(state.data[rowIndex], path);
          console.log(`objvalue: ${objValue}`);
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

