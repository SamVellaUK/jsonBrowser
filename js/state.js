export const state = {
  data: [],
  jsonStructure: {},
  editMode: false,
  showJsonPaths: false,
  columnState: {
    visibleColumns: [],
    order: [],
  },
  search: {
    matches: [],
    index: -1,
    domMatches: [] 
  }
};

window.state = state;

export async function fetchData() {
  try {
    const response = await fetch('./JSON Output/samplejson.json');
    state.data = await response.json();

    // 🔧 Auto-populate columns from first row
    const firstRow = state.data[0];
    if (firstRow) {
      const keys = Object.keys(firstRow);
      state.columnState.visibleColumns = keys.map(k => ({ path: k, label: k }));
      state.columnState.order = [...keys];
    }

    return state.data;
  } catch (e) {
    document.getElementById('json-root').textContent = 'Failed to load JSON';
    console.error('Failed to fetch JSON:', e);
    return [];
  }
}

export function updateStateViewer() {
  const jsonStructureEl = document.getElementById('json-structure');
  const columnStateEl = document.getElementById('column-state');
  const searchStateEl = document.getElementById('search-state');

  if (jsonStructureEl) jsonStructureEl.innerHTML = syntaxHighlight(state.jsonStructure);
  if (columnStateEl) columnStateEl.innerHTML = syntaxHighlight(state.columnState);
  if (searchStateEl) searchStateEl.innerHTML = syntaxHighlight(state.search);
}

export function toggleCollapse(id) {
  const el = document.getElementById(id);
  if (el) {
    if (el.style.display === 'none') {
      el.style.display = 'block';
      refreshSectionContent(id); // Refresh content when expanding
    } else {
      el.style.display = 'none';
    }
  }
}

function refreshSectionContent(id) {
  let content = '';
  switch (id) {
    case 'json-structure':
      content = syntaxHighlight(state.jsonStructure);
      break;
    case 'column-state':
      content = syntaxHighlight(state.columnState);
      break;
    case 'search-state':
      content = syntaxHighlight(state.search);
      break;
    default:
      console.warn(`Unknown section ID: ${id}`);
  }

  const el = document.getElementById(id);
  if (el) {
    el.innerHTML = content;
  }
}

function syntaxHighlight(json) {
  if (typeof json !== 'string') {
    json = JSON.stringify(json, null, 2);
  }
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d+)?([eE][+-]?\d+)?)/g, match => {
    let cls = 'number';
    if (/^"/.test(match)) {
      cls = /:$/.test(match) ? 'key' : 'string';
    } else if (/true|false/.test(match)) {
      cls = 'boolean';
    } else if (/null/.test(match)) {
      cls = 'null';
    }
    return `<span class="${cls}">${match}</span>`;
  });
}

// Expose functions to the global scope
window.toggleCollapse = toggleCollapse;
window.updateStateViewer = updateStateViewer;

// Call updateStateViewer after state changes
fetchData().then(() => updateStateViewer());
