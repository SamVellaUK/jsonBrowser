import { state } from './state.js';
import { performSearch, navigateSearch } from './search.js';
import { toggleAllNested, toggleJsonPaths } from './globalToggles.js';

export function initializeUI() {
  console.log('[UI] initializeUI triggered');
  document.getElementById('search-button')?.addEventListener('click', () => {
    console.log('[UI] Search button clicked');
    const q = document.getElementById('search-box').value.trim();
    performSearch(q);
  });
  document.getElementById('search-next')?.addEventListener('click', () => navigateSearch('next'));
  document.getElementById('search-prev')?.addEventListener('click', () => navigateSearch('prev'));

  // ── Global expand / collapse ─────────────────────────────────
  document.getElementById('expand-all')?.addEventListener('click', () => {
    console.log('[UI] Expand‑All button clicked');
    toggleAllNested(true);        // open everything
  });

  document.getElementById('collapse-all')?.addEventListener('click', () => {
    console.log('[UI] Collapse‑All button clicked');
    toggleAllNested(false);       // close everything
  });

  // ── JSON‑path visibility toggle ──────────────────────────────
  document.getElementById('show-json-paths')?.addEventListener('click', () => {
    console.log('[UI] JSON‑Paths toggle clicked');
    toggleJsonPaths();
  });  
}
