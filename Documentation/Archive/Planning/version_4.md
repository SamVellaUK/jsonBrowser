## 🧠 Version 4.0 — JavaScript Architecture Planning

### Goal

Define the foundational structure and patterns for JavaScript logic in the interactive data viewer. This step guides the upcoming feature work by establishing clarity around code organization, conventions, and library usage.

> ✅ Note: This version involves **no UI changes or logic implementation** — it is purely a planning and design milestone.

---

### Subtasks

| ID   | Task | Status | Notes |
|------|------|--------|-------|
| 4.1  | **Confirm JS architecture pattern**<br>Decide whether logic is organized via object-literal modules, ES6 classes, or flat function-based modules. | ✅ Complete | Organize features like rendering, sorting, and search in consistent structure |
| 4.2  | **Decide data handling pattern**<br>Determine whether to work on `const data` directly or clone/transform for derived views. | ✅ Complete | Immutable patterns help with search/sort toggle handling |
| 4.3  | **Document high-level function responsibilities**<br>Create placeholders for `renderTable`, `bindUI`, `applySort`, etc. with doc-style comments. | ✅ Complete | Use this as your future dev checklist |
| 4.4  | **Choose event binding approach**<br>Define whether to use `addEventListener`, `onclick`, or delegation for buttons, sort headers, etc. | ✅ Complete | Important for dynamic DOM elements |
| 4.5  | **Confirm JS library usage**<br>Finalize `Tabulator.js` as the core renderer. Identify any optional helper libraries (e.g., Lodash). | ✅ Complete | Tabulator provides sorting, filtering, expansion |
| 4.6  | **Define Tabulator integration strategy**<br>Embed from CDN or local copy? Initialize once or on every data change? | ✅ Complete | Consider offline use in DataGrip |
| 4.7  | **Establish script structure**<br>Wrap logic in an IIFE, or attach to a custom namespace (e.g., `window.JsonViewer = {...}`). | ✅ Complete | Prevents polluting global scope |
| 4.8  | **Set coding conventions**<br>Use `const`/`let` properly, camelCase for variables/functions, JSDoc-style comments, consistent semicolons. | ✅ Complete | Document preferred error handling style too |

---

### Design Notes

- **Tabulator.js** will be used to render and manage the interactive table. It will eventually replace the raw HTML table from Version 2.
- A lightweight architecture will be preserved — avoid large frameworks or dependency trees.
- Consider splitting future logic into functions like:
  - `initTabulator(data)`
  - `getTabulatorColumns(data)`
  - `flattenNestedFields(obj)`
  - `bindToolbarActions()`

---

### Placeholder JS Skeleton

```js
// Version: 4.0
// JavaScript Planning Skeleton

(function () {
  // Entry point
  function init() {
    initTabulator(window.data);
    bindToolbarActions();
  }

  // Build Tabulator and render to page
  function initTabulator(data) {
    // TODO: Define Tabulator config and initialize
  }

  // Optional: Generate column definitions from JSON keys
  function getTabulatorColumns(data) {
    // TODO: Generate column list for Tabulator
  }

  // Setup UI buttons, top bar actions
  function bindToolbarActions() {
    // TODO: Hook up dummy buttons or expand/search toggles
  }

  // Auto-run on load
  window.addEventListener('DOMContentLoaded', init);
})();
```
