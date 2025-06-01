
# 📄 Documentation: `state.js`

## Purpose

This module defines and manages the global state of the JSON Viewer app. It acts as the **single source of truth** for the application’s data, UI mode, column configurations, and search state.

All other modules read from or write to this central state object.

---

## Exports

### `state`
The main state object used throughout the app.

#### Structure:
```js
state = {
  data: [],  // Raw JSON loaded from file
  jsonStructure: {},  // To be populated for field tree / nested structure
  editMode: false,
  showJsonPaths: false,

  columnState: {
    visibleColumns: [],  // Array of { path, label }
    order: [],           // Array of path strings (dot notation)
  },

  search: {
    matches: [],       // All logical matches: { rowIndex, path, value }
    index: -1,         // Currently selected match index
    domMatches: [],    // Highlighted DOM spans for visible matches
  }
}
```

---

### `fetchData() → Promise<Array>`

Fetches JSON data and populates `state.data`. It also initializes the column state using the keys from the first row of data.

#### Responsibilities:
- Load the JSON from a relative file path.
- Parse it and assign it to `state.data`.
- Auto-infer top-level columns:
  - Updates `state.columnState.visibleColumns`
  - Updates `state.columnState.order`

#### Example:
```js
await fetchData();
console.log(state.data); // Your JSON
```

---

## Design Notes

- State is not coupled to DOM. Rendering functions re-read this state when needed.
- `jsonStructure` is reserved for future schema/column tree generation.
- `editMode`, `showJsonPaths` toggle buttons affect UI display and behavior.

---

## Dependencies

None (pure state and logic).
