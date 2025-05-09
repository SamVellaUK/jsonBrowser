import { initializeUI } from './ui.js';
import { fetchData } from './state.js';
import { renderTable } from './renderer.js';
import { toggleAllNested, toggleJsonPaths } from './globalToggles.js';
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