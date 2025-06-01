
# 📄 Documentation: `search.js`

## Purpose

This module implements full recursive search over the JSON dataset. It supports:

- Case-insensitive matching across all fields (including nested fields)
- Navigation between found results
- Highlighting visible matches
- Tracking hidden vs visible results
- Support for future nested rendering expansion

---

## Functions

### `performSearch(query: string)`

Searches all of `state.data`, recursively traversing every object and array. Matches are stored in `state.search.matches`.

If a match occurs in a visible column (top-level field), it is highlighted in the DOM and added to `state.search.domMatches`.

#### Updates:
- `state.search.matches`: list of logical matches
- `state.search.domMatches`: list of `<span class="highlight">` elements
- `state.search.index`: index of current match

---

### `navigateSearch(direction: 'next' | 'prev')`

Cycles through the visible matches using `state.search.index`.

Before highlighting, it calls:
- `expandToPath(path, rowIndex)`: a stub to support future nested expansion

Then it scrolls to and applies the `.highlight-active` class to the new match span.

---

### `highlightCurrentMatch()`

Adds the `.highlight-active` class to the currently selected match in `domMatches`. Scrolls to that element.

---

### `clearHighlights()`

Removes all `.highlight` and `.highlight-active` spans and resets:
- `state.search.domMatches`
- Visual highlighting in the DOM

---

### `updateSearchCounter()`

Updates the contents of the `#search-counter` DOM element to show:
- `"X of Y"` matches
- `"Z hidden"` if hidden matches exist

---

### `expandToPath(path: string, rowIndex: number)`

Stub function for future nested rendering. Will eventually expand nested tables along a dot-notated path so the DOM element can be highlighted.

---

### `resolvePath(obj: Object, path: string)`

Utility to walk a nested object by a dot-notated path and return the resolved value.

---

## Design Notes

- Search is decoupled from rendering. It does not manipulate table layout or columns.
- It relies on the state model to handle visibility, rendering, and results.
- Fully supports future extension to handle nested data rows and expandable tables.

