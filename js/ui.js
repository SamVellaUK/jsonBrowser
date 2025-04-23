import { resolvePath, promoteField } from './render.js';

export function setupUIListeners() {
  // Expand All Button
  const expandAllButton = document.getElementById('expand-all');
  if (!expandAllButton) {
    console.error('Error: Element with id "expand-all" not found');
    return;
  }
  expandAllButton.onclick = () => {
    document.querySelectorAll('.nested-content').forEach(div => div.style.display = 'block');
    document.querySelectorAll('.toggle-nest').forEach(span => span.textContent = '[-]');
  };

  // Collapse All Button
  const collapseAllButton = document.getElementById('collapse-all');
  if (!collapseAllButton) {
    console.error('Error: Element with id "collapse-all" not found');
    return;
  }
  collapseAllButton.onclick = () => {
    document.querySelectorAll('.nested-content').forEach(div => div.style.display = 'none');
    document.querySelectorAll('.toggle-nest').forEach(span => span.textContent = '[+]');
  };

  // Edit Mode Button
  const editModeButton = document.getElementById('edit-mode');
  if (!editModeButton) {
    console.error('Error: Element with id "edit-mode" not found');
    return;
  }
  editModeButton.onclick = function () {
    window.editMode = !window.editMode;
    this.classList.toggle('active');
    document.querySelectorAll('.promote-button').forEach(btn => {
      btn.style.display = window.editMode ? 'inline' : 'none';
    });
    console.log('Edit mode:', window.editMode);
  };

  // Show JSON Paths Button
  const showJsonPathsButton = document.getElementById('show-json-paths');
  if (!showJsonPathsButton) {
    console.error('Error: Element with id "show-json-paths" not found');
    return;
  }
  showJsonPathsButton.onclick = function () {
    window.showJsonPaths = !window.showJsonPaths;
    this.classList.toggle('active');
    document.querySelectorAll('.json-path').forEach(p => {
      p.style.display = window.showJsonPaths ? 'block' : 'none';
    });
    console.log('Show JSON Paths:', window.showJsonPaths);
  };
}

export function highlightRow(row) {
  // Remove highlight from all rows
  const table = row.closest('table');
  if (table) {
    table.querySelectorAll('tr').forEach((tr) => tr.classList.remove('highlighted'));
  }

  // Add highlight to the clicked row
  row.classList.add('highlighted');
}

export function sortTableByColumn(table, columnIndex, asc = true) {
  const tbody = table.tBodies[0];
  const rowsArray = Array.from(tbody.querySelectorAll('tr'))
    .filter(row => row.closest('table') === table); // Only top-level rows

  rowsArray.sort((rowA, rowB) => {
    let cellA = rowA.cells[columnIndex];
    let cellB = rowB.cells[columnIndex];

    if (!cellA || !cellB) return 0;

    cellA = cellA.innerText.trim();
    cellB = cellB.innerText.trim();

    const numA = parseFloat(cellA);
    const numB = parseFloat(cellB);
    const isNumeric = !isNaN(numA) && !isNaN(numB);

    if (isNumeric) {
      return asc ? numA - numB : numB - numA;
    } else {
      return asc ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
    }
  });

  rowsArray.forEach(row => tbody.appendChild(row));
}

