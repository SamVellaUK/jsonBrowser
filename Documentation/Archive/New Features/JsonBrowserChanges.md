
# JSON Browser Feature Enhancement

## 1. Full Description of Desired Change

**Goal:** Enhance JSON array traversal in the JsonBrowserTemplate to support key-based filtering alongside existing index-based access.

- Introduce a lightweight bracket-filter syntax in path expressions:  
  ```
  resources.items[field=value].subprop
  ```
- Update the path parser to recognize filter segments (`field=value`) as well as numeric indices.
- Provide a UI context menu for array cells offering **Use Index** (legacy `[n]`) and **Filter by Key** (`[field=value]`) options.
- Ensure the entire implementation is self-contained, relying solely on native JavaScript and CSS—no external libraries or JSONPath engines.

## 2. Self-Contained Process Notes

- **Native JS only:** All JSON parsing and filtering will use `Array.find`, `Object.keys`, and other built-in methods.
- **No external dependencies:** The solution lives entirely in the static files (HTML, CSS, and JS) shipped with the extractor—no CDN, npm, or additional bundles.
- **Simple bracket syntax:** Filter clauses are of the form `field=value`, with literal string matching (`==` semantics).

## 3. File-by-File Change List

### JsonBrowserTemplate.html
- **Markup additions:**
  - Insert a hidden popover `<div id="array-context-menu">` with **Use Index** and **Filter by Key** buttons.
  - Decorate array `<td>` cells with:
    - `data-is-array="true"`
    - `data-array-path="..."` (the JSON pointer to that array)
    - `data-array-keys="key,id,name,..."`
- **Script updates:**
  - Add event listeners to detect clicks on `[data-is-array]` cells.
  - Show the context menu popover at the click location.
  - On **Use Index**, prompt for an index and invoke the existing expand logic.
  - On **Filter by Key**, prompt for a field (dropdown from `data-array-keys`) and value, build the filter syntax, update the path bar, and drill in.
  - Extend the inline `parsePathSegment` function to split non-numeric bracket contents on `=`, returning `{ type: 'filter', field, value }`.

### styles.css
- Define styles for `#array-context-menu`:
  - `.hidden` class to toggle visibility.
  - Absolute positioning, minimal borders, background, and z-index to overlay the table.

### TableRenderer.js / ui.js / main.js
- **TableRenderer.js:**
  - When rendering cells, detect `Array.isArray(value)` and attach the data-attributes.
- **ui.js / main.js:**
  - Implement helper functions:
    ```js
    function expandByIndex(arr, idx) { /* existing logic */ }
    function expandByFilter(arr, field, value) {
      return arr.find(item => item[field] == value);
    }
    ```
  - Update `expandNestedPath` to dispatch on `segment.type === 'filter'` versus `segment.type === 'index'`.

### Utils.js / PathExpander.js / search.js
- If any shared utilities parse or traverse paths, extend them to handle the `{type:'filter'}` segment:
  ```js
  if (segment.type === 'filter') {
    current = expandByFilter(current, segment.field, segment.value);
  }
  ```

---

*This file serves as the design spec for implementing key-based JSON filtering in the interactive browser.*
