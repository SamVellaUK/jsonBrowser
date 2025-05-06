
# 📦 Refactoring Plan for JSON Viewer

## 🧠 Refactoring Approach — Explained in Plain English

The original codebase had become difficult to maintain due to:

- Large, monolithic files mixing UI, logic, and rendering responsibilities.
- Implicit behavior and side effects between modules.
- DOM-first architecture: logic depended on existing HTML structure rather than driving it from a data model.
- Repeated patterns, unclear state management, and brittle coupling.

### 🎯 Goals of This Refactor

- **Separation of Concerns**:
  - Each file handles a single responsibility (e.g., rendering, search, state, UI binding).
- **State-Driven Rendering**:
  - Application state (not the DOM) is the single source of truth.
  - DOM is generated *from* state, not manipulated ad-hoc.
- **Scalability**:
  - Easy to add features like nested rendering, column chooser, or filters.
- **Maintainability**:
  - Clean modular functions make testing and debugging straightforward.

---

## 📁 File-by-File Responsibilities and Function Detail

### 1. `main.js`
**Responsibility**: Application entry point

**Functions**:
- Calls `fetchData()` to populate `state.data`
- Triggers `renderTable()` and `initializeUI()`

**Interaction with State**:
- Relies entirely on `state.js` to hold and provide the data

**Adherence to Principles**:
- No logic inside this file
- Orchestrates app initialization only

---

### 2. `state.js`
**Responsibility**: Holds the app-wide state and handles data loading

**Functions**:
- `fetchData()`: loads JSON and initializes `state.data`, then populates:
  - `columnState.visibleColumns`
  - `columnState.order`

**State Shape**:
```js
{
  data: [],                      // Raw JSON data
  jsonStructure: {},             // Placeholder for inferred structure
  editMode: false,
  showJsonPaths: false,
  columnState: {
    visibleColumns: [],          // List of { path, label }
    order: [],                   // Display order of column paths
  },
  search: {
    matches: [],                 // Array of { rowIndex, path, value }
    index: -1,                   // Current match index
    domMatches: [],              // Highlighted <span> elements
  }
}
```

**Adherence to Principles**:
- Centralizes all application state
- Data is never inferred from the DOM — the DOM is rendered from this state

---

### 3. `renderer.js`
**Responsibility**: Render the main table using state data

**Functions**:
- `renderTable()`:
  - Uses `state.data` and `state.columnState.order`
  - Builds the table DOM using standard APIs
- `resolvePath(obj, path)`:
  - Safely extract nested values using dot notation

**Interaction with State**:
- Reads: `state.data`, `state.columnState.order`
- Never modifies state

**Adherence to Principles**:
- No global queries or logic beyond DOM construction
- Rendering is deterministic and pure (given the state)

---

### 4. `ui.js`
**Responsibility**: Wire UI event handlers (buttons, input)

**Functions**:
- `initializeUI()`:
  - Binds DOM events to handlers from `search.js`

**Interaction with State**:
- Indirect only: delegates to `search.js` which works with state
- Reads no state directly

**Adherence to Principles**:
- No logic, no rendering — event bindings only
- Keeps UI binding separate from business logic

---

### 5. `search.js`
**Responsibility**: Full-featured recursive search system

**Functions**:
- `performSearch(query)`:
  - Searches **entire `state.data`** recursively
  - Stores all matches in `state.search.matches`
  - Highlights only visible matches using `.domMatches`
- `navigateSearch(direction)`:
  - Uses `.index` to navigate matches
  - Calls `expandToPath()` to prepare future nested behavior
- `highlightCurrentMatch()`:
  - Scrolls to and outlines the current match span
- `clearHighlights()`:
  - Removes all DOM highlights
- `updateSearchCounter()`:
  - Updates UI with visible/hidden counts
- `expandToPath(path, rowIndex)`:
  - 🔧 Stub: will expand nested data levels when rendering supports it

**Interaction with State**:
- Reads: `state.data`, `state.columnState.order`, `state.search`
- Writes: `state.search.matches`, `state.search.index`, `state.search.domMatches`

**Adherence to Principles**:
- State-first logic: all results and navigation tracked in `state`
- DOM manipulation deferred and controlled (only span wrapping)

---

## 🧭 Planned Module: `columnChooser.js` *(Not Yet Reimplemented)*

**Responsibility**: Interactive UI for choosing, ordering, and promoting columns

**Planned Functions**:
- `renderColumnChooser()`:
  - Renders modal tree + list from `state.jsonStructure` and `state.columnState`
- `applyActiveColumns()`:
  - Writes to `state.columnState`, triggers table re-render
- `syncTreeCheckbox(path, checked)`:
  - Ensures the tree and list stay in sync
- `addVisibleColumn(path, label)`, `removeVisibleColumn(path)`:
  - Update `visibleColumns` and `order`
- `moveColumnUp(path)`, `moveColumnDown(path)`:
  - Reorder `order` array in `state`

**Expected State Use**:
- Reads: `state.jsonStructure`, `state.columnState`
- Writes: `state.columnState`

**Adherence to Principles**:
- Completely state-driven modal UI
- Does not directly change DOM structure — always via re-render

---

## ✅ Refactor Outcomes

- ✅ Clear ownership of behavior (rendering vs state vs event handling)
- ✅ Predictable behavior driven by state
- ✅ Ready for nested rendering, editable columns, or real-time filtering
- ✅ All new features can be layered on cleanly without spaghetti code

