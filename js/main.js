import { initializeUI } from './ui.js';
import { renderTable } from './TableRenderer.js';
import { toggleAllNested, toggleJsonPaths } from './ui.js';

import { expandToPath } from './PathExpander.js';
import { resolvePath }   from './Utils.js';
window.expandToPath = expandToPath;
window.resolvePath  = resolvePath;

// state.js
export const state = {
  data: [],
  jsonStructure: {},
  editMode: false,
  showJsonPaths: false,
  ui: { scrollTop: 0 },
  columnState: {
    // now each column has { path, label, sourcePath }
    visibleColumns: [],
    order: [],
  },
  sortState: {
    path: null,
    direction: 'asc'
  },
  search: { matches: [], index: -1, domMatches: [], query: '' }
};

window.state = state;

export async function fetchData() {
  try {
    const response = await fetch('./JSON Output/samplejson.json');
    state.data = await response.json();

    // Auto-populate columns from first row
    const firstRow = state.data[0];
    if (firstRow) {
      const keys = Object.keys(firstRow);
      state.columnState.visibleColumns = keys.map(k => ({
        path: k,
        label: k,
        sourcePath: k
      }));
      state.columnState.order = [...keys];
    }

    return state.data;
  } catch (e) {
    document.getElementById('json-root').textContent = 'Failed to load JSON';
    console.error('Failed to fetch JSON:', e);
    return [];
  }
}


// Initialize the UI when the DOM is fully loaded
fetchData();


window.addEventListener('DOMContentLoaded', async () => {
  const data = await fetchData();
  renderTable();
  initializeUI();
});
// make fetchJSON() available to the inline onclick in your HTML
window.fetchJSON = async function() {
  // 1️⃣ re-load the raw data & reset columnState
  await fetchData();

  // 2️⃣ re-draw the table
  renderTable();

  // 3️⃣ re-bind click handlers on the new table
  initializeUI();

  // 4️⃣ collapse all nested sections
  toggleAllNested(false);

  // 5️⃣ hide JSON-path overlays if they were on
  if (state.showJsonPaths) toggleJsonPaths();

  // 6️⃣ clear any search state + UI
  document.getElementById('search-box').value = '';
  document.getElementById('search-counter').textContent = '0 of 0';
  state.search.matches = [];
  state.search.domMatches = [];
  state.search.index = -1;

  // 7️⃣ reset scroll position
  const container = document.getElementById('table-container');
  if (container) container.scrollTop = 0;

  // 8️⃣ ensure the column-chooser modal is closed
  document.getElementById('column-chooser').style.display = 'none';
};