import { highlightRow } from './ui.js';
import { sortTableByColumn } from './ui.js';

export function renderTable(data) {
  const tableContainer = document.getElementById('table-container');
  if (!tableContainer) {
    console.error('Error: #table-container element not found');
    return;
  }

  tableContainer.innerHTML = ''; // Clear the table container before rendering

  if (!Array.isArray(data) || data.length === 0) {
    tableContainer.textContent = 'No data available to display.';
    return;
  }

  // Create table element
  const table = document.createElement('table');
  table.id = 'data-table';
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  // Create table headers based on keys of the first object
  Object.keys(data[0]).forEach((key) => {
    const headerCell = document.createElement('th');
    headerCell.textContent = key;
    headerCell.style.cursor = 'pointer';
    headerCell.dataset.columnIndex = headerRow.children.length;
    headerCell.dataset.sortDirection = 'asc';
    headerCell.addEventListener('click', function() {
      const currentDir = this.dataset.sortDirection === 'asc' ? 'desc' : 'asc';
      this.dataset.sortDirection = currentDir;
      sortTableByColumn(table, parseInt(this.dataset.columnIndex), currentDir === 'asc');
    });
    headerRow.appendChild(headerCell);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  // Create table rows
  data.forEach((item, rowIndex) => {
    const row = document.createElement('tr');

    // Add click event listener to highlight the row
    row.addEventListener('click', () => highlightRow(row));

    Object.entries(item).forEach(([key, value]) => {
      const cell = document.createElement('td');

      // Use renderCell to handle all values, including nested ones
      renderCell(cell, value, key);

      row.appendChild(cell);
    });
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  tableContainer.appendChild(table);
}

export function renderCell(container, value, path = '') {
  if (typeof value === 'object' && value !== null) {
    const toggle = document.createElement('span');
    toggle.textContent = '[+]';
    toggle.className = 'toggle-nest';

    const nestedDiv = document.createElement('div');
    nestedDiv.className = 'nested-content';
    nestedDiv.style.display = 'none';

    toggle.onclick = () => {
      const isHidden = nestedDiv.style.display === 'none';
      nestedDiv.style.display = isHidden ? 'block' : 'none';
      toggle.textContent = isHidden ? '[-]' : '[+]';

      // Render nested content only when expanding for the first time
      if (isHidden && nestedDiv.childElementCount === 0) {
        const nestedTable = renderNested(value, path);
        nestedDiv.appendChild(nestedTable);
      }
    };

    container.appendChild(toggle);
    container.appendChild(document.createTextNode(Array.isArray(value) ? '[...]' : '{...}'));
    container.appendChild(nestedDiv);
  } else {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.justifyContent = 'space-between';

    const valueSpan = document.createElement('span');
    valueSpan.textContent = value !== undefined ? value : ''; // Handle undefined values gracefully

    wrapper.appendChild(valueSpan);
    container.appendChild(wrapper);
  }
}

export function renderNested(obj, parentPath = '') {
  const table = document.createElement('table');
  table.className = 'nested-table';
  const tbody = document.createElement('tbody');

  Object.entries(obj).forEach(([key, val]) => {
    const tr = document.createElement('tr');
    const tdKey = document.createElement('td');
    tdKey.textContent = key;

    const displayPath = parentPath ? `${parentPath}.${key}` : key;

    // Add the JSON path as a hidden element
    const jsonPath = document.createElement('div');
    jsonPath.className = 'json-path';
    jsonPath.textContent = displayPath.split('.').slice(1).join('.');
    jsonPath.style.display = window.showJsonPaths ? 'block' : 'none';
    tdKey.appendChild(jsonPath);

    const tdVal = document.createElement('td'); // Make sure tdVal is defined before use

    if (typeof val === 'object' && val !== null) {
      // Value is an object or array — render nested structure with toggle
      const toggle = document.createElement('span');
      toggle.textContent = '[+]';
      toggle.className = 'toggle-nest';

      const nestedDiv = document.createElement('div');
      nestedDiv.className = 'nested-content';
      nestedDiv.style.display = 'none';

      toggle.onclick = () => {
        const isHidden = nestedDiv.style.display === 'none';
        nestedDiv.style.display = isHidden ? 'block' : 'none';
        toggle.textContent = isHidden ? '[-]' : '[+]';

        if (isHidden && nestedDiv.childElementCount === 0) {
          const nestedTable = renderNested(val, displayPath);
          nestedDiv.appendChild(nestedTable);
          nestedDiv.querySelectorAll('.json-path').forEach((pathElement) => {
            pathElement.style.display = window.showJsonPaths ? 'block' : 'none';
          });
        }
      };

      tdVal.appendChild(toggle);
      tdVal.appendChild(document.createTextNode(Array.isArray(val) ? '[...]' : '{...}'));
      tdVal.appendChild(nestedDiv);
    } else {
      // Primitive value — render value and add promote (+) button
      renderCell(tdVal, val, displayPath);

      const promoteButton = document.createElement('span');
      promoteButton.textContent = '+';
      promoteButton.className = 'promote-button';
      promoteButton.style.display = window.editMode ? 'inline' : 'none'; // Only show if edit mode is active
      promoteButton.onclick = () => promoteField(displayPath, key);
      tdKey.appendChild(promoteButton);
    }

    tr.appendChild(tdKey);
    tr.appendChild(tdVal);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  return table;
}


export function resolvePath(obj, path) {
  return path.split('.').reduce((acc, key) => {
    const match = key.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
      const [, arrayKey, index] = match;
      return acc?.[arrayKey]?.[index];
    }
    return acc?.[key];
  }, obj);
}

export function promoteField(path, columnName) {
  const table = document.getElementById('data-table'); // Ensure we are working with the base table
  if (!table) {
    console.error('Base table (data-table) not found.');
    return;
  }

  console.log(`Promoting field with path: ${path} and column name: ${columnName}`);

  const headers = table.querySelector('thead tr');
  //const bodyRows = table.querySelectorAll('tbody > tr'); // Ensure only direct child rows are selected
   
  console.log(`Check if column exists`)
 
  
  if (!headers) {
    console.error('Table header row not found.');
    return;
  }
  // Check if column already exists
  if (Array.from(headers.children).some(th => th.textContent === columnName)) {
    console.warn(`Column "${columnName}" already exists.`);
    return;
  }
  console.log(`Column "${columnName}" does not exist, proceeding to add it.`);
  // Add new column header
  const newHeader = document.createElement('th');
  newHeader.textContent = columnName;
  newHeader.style.cursor = 'pointer';
  const columnIndex = headers.children.length;
  newHeader.dataset.columnIndex = columnIndex;
  newHeader.dataset.sortDirection = 'asc';
  
  newHeader.addEventListener('click', function () {
    const currentDir = this.dataset.sortDirection === 'asc' ? 'desc' : 'asc';
    this.dataset.sortDirection = currentDir;
    const table = document.getElementById('data-table');
    sortTableByColumn(table, columnIndex, currentDir === 'asc');
  });
  // ✅ Don't forget this!
headers.appendChild(newHeader);

  console.log(`Added new header for column: ${columnName}`);

  // Add new column cells
  const bodyRows = table.querySelectorAll(':scope > tbody > tr');
  if (!bodyRows.length) {
    console.error('No body rows found in the table.');
    return;
  }
  bodyRows.forEach((row, rowIndex) => {
    console.log(`Adding cell to row ${rowIndex}`);
    const newCell = document.createElement('td');
    newCell.setAttribute('data-column-index', headers.children.length - 1);
  
    const fullPath = path.startsWith('raw_event.') ? path : `raw_event.${path}`;
    const value = resolvePath(window.DATA[rowIndex], fullPath);
  
    newCell.textContent = value !== undefined ? value : '';
    row.appendChild(newCell);
  });

  console.log(`Promoted field "${columnName}" to base table.`);
}
