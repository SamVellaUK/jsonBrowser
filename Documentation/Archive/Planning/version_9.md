
## 🔎 Version 9.0 — Full Table Search (Including Nested JSON)

### Goal

Introduce a robust, controlled search system for the entire dataset (including deeply nested fields) with a user-friendly navigation system and visibility warnings.

---

## 📌 Incremental Feature Plan

---

### 9.1 — Add Search UI Components

| ID   | Task Description | Status | Notes |
|------|------------------|--------|-------|
| 9.1.1 | Add a **Search Box** to the top bar | ✅ Complete | Simple input box (no auto-search) |
| 9.1.2 | Add **Next** and **Previous** navigation buttons | ✅ Complete | Arrows or labels: Next / Prev |
| 9.1.3 | Add **Result Counter** display (e.g., "3 of 17") | ✅ Complete | Updates live when navigating |

---

### 9.2 — Implement Search Mechanics

| ID   | Task Description | Status | Notes |
|------|------------------|--------|-------|
| 9.2.1 | Search entire JSON structure when user hits Enter or presses Search button | ✅ Complete | No debounce; manual trigger only |
| 9.2.2 | Highlight all found matches in the table | ✅ Complete | Use a CSS class to highlight matching cells |
| 9.2.3 | Auto-expand any collapsed nested tables needed to display a found match | ✅ Complete | Ensure found results are always visible |
| 9.2.4 | Navigate between matches with Next/Prev buttons | ⬜ Planned | Scroll to and focus the matching cell |
| 9.2.5 | Popup a notice if navigation loops back to the start | ⬜ Planned | E.g., "Reached end of search results, starting over" |

---

### 9.3 — Handle Columns and Missing Results

| ID   | Task Description | Status | Notes |
|------|------------------|--------|-------|
| 9.3.1 | Detect if matching values exist in **hidden columns** | ✅ Complete | Warn the user: "Other results exist in hidden fields" |
| 9.3.2 | Exclude matches in hidden columns from the active navigation count | ✅ Complete | But still show a warning separately |

---

### 9.4 — Styling

- Highlighted matches: **light yellow background** (`#ffffcc`) or **bold text**.
- Current match: **bold outline** or box-shadow.
- Search box and buttons integrated with top menu (match button styles).

---

### Example UI Sketch

| 🔍 Search: | `[input box]` | [Prev] | [Next] |  `3 of 17` |  
|-------------|----------------|--------|---------|-----------|

---

### JavaScript Behavior Outline

```js
function performSearch(query) {
  // Clear previous highlights
  // Traverse all visible and nested fields
  // Highlight matches and record their positions
}

function navigateSearch(direction) {
  // Jump to next/previous match
  // Expand any nested levels as needed
  // Scroll into view and focus match
}

function checkHiddenMatches(query) {
  // Search hidden columns too
  // If matches found, display warning message
}
```

---

### Testing Checklist

| Feature | Test Cases |
|---------|------------|
| Search triggers manually | Only search after user confirmation (Enter/Search) |
| Navigation updates counter | "X of Y" updates correctly |
| Wrap-around popup appears | User warned when looping around search |
| Expand nested for results | Hidden nested fields are expanded to show match |
| Hidden column warning | User informed about matches not shown |

---
