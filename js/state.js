// state.js
export const state = {
  data: [],
  jsonStructure: {},
  editMode: false,
  showJsonPaths: false,
  ui: { scrollTop: 0 },
  columnState: {
    visibleColumns: [],
    order: [],
  },
  // ← add this block
  sortState: {
    path: null,        // which column we’re sorted on
    direction: 'asc'   // or 'desc'
  },
  search: { matches: [], index: -1, domMatches: [], query: '' }
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


fetchData();
