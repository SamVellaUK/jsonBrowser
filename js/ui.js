import { state } from './state.js';
import { performSearch, navigateSearch } from './search.js';

export function initializeUI() {
  console.log('[UI] initializeUI triggered');
  document.getElementById('search-button')?.addEventListener('click', () => {
    console.log('[UI] Search button clicked');
    const q = document.getElementById('search-box').value.trim();
    performSearch(q);
  });
  document.getElementById('search-next')?.addEventListener('click', () => navigateSearch('next'));
  document.getElementById('search-prev')?.addEventListener('click', () => navigateSearch('prev'));
}
