import { initializeUI } from './ui.js';
import { fetchData } from './state.js';
import { renderTable } from './renderer.js';

window.addEventListener('DOMContentLoaded', async () => {
  const data = await fetchData();
  renderTable();
  initializeUI();
});
