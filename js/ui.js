// ui.js
import { state } from './state.js';
import { applySearchHighlightsToNewContent, performSearch, navigateSearch } from './search.js';
import { toggleAllNested, toggleJsonPaths } from './globalToggles.js';
import * as DomUtils from './DomUtils.js';
import { renderNestedTable } from './TableRenderer.js';

export function initializeUI() {
  console.log('[UI] initializeUI triggered');
  
  // Set up delegated event listeners
  document.getElementById('table-container')?.addEventListener('click', handleTableClick);
  
  // Keep top-level control listeners (these aren't table cells)
  document.getElementById('search-button')?.addEventListener('click', () => {
    const q = document.getElementById('search-box').value.trim();
    performSearch(q);
  });
  document.getElementById('search-next')?.addEventListener('click', () => navigateSearch('next'));
  document.getElementById('search-prev')?.addEventListener('click', () => navigateSearch('prev'));
  document.getElementById('expand-all')?.addEventListener('click', () => toggleAllNested(true));
  document.getElementById('collapse-all')?.addEventListener('click', () => toggleAllNested(false));
  document.getElementById('show-json-paths')?.addEventListener('click', toggleJsonPaths);
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