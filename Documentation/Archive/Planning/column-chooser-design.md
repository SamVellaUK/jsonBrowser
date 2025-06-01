
# Column Chooser Field Tree Design

## Purpose

The **Column Chooser** provides user control over which fields (columns) are visible in the main data table, including both top-level and nested JSON fields.

This document outlines the approach for how the field tree structure is generated and managed.

---

## Field Discovery Strategy

- The field tree is **built once at page load** when the JSON dataset is first available.
- **Scanning is limited to the first N rows** (default: 50).
- The resulting tree represents the **union of all fields found** across these sampled rows.
- Supports:
  - Base-level columns.
  - Deeply nested JSON fields, represented as **dot-notation paths** (e.g., `raw_event.userIdentity.sessionContext.attributes.mfaAuthenticated`).
  - Arrays, indexed or path-accessed where appropriate.

---

## Rationale for Pre-Building

- Prevents repeated expensive scanning of large datasets.
- Ensures that opening the Column Chooser overlay is **fast and responsive**, regardless of dataset size.
- Allows user configuration of column visibility immediately after page load.
- Accepts that rare or deeply inconsistent structural differences outside the first N rows will **not affect the field chooser** (considered out of scope for this tool’s intended use case).

---

## Why Limit to First N Rows?

- Datasets with thousands of rows and complex nesting could become prohibitively expensive to scan in full.
- Sampling the first 50 rows strikes a balance between:
  - Accurate discovery of available fields.
  - Acceptable performance.
- Analysts using highly irregular data structures may require other tools or preprocess steps (outside this project’s scope).

---

## Data Structure for the Field Tree

The field tree is represented as a **nested hierarchical object**, suitable for direct use in building a tree-view UI.

Example:
```js
{
  "id": true,
  "event_time": true,
  "raw_event": {
    "userIdentity": {
      "type": true,
      "principalId": true,
      "sessionContext": {
        "attributes": {
          "mfaAuthenticated": true
        }
      }
    },
    "requestParameters": {
      "tags": true
    }
  }
}
```

Each leaf node represents a selectable field.

---

## Notes

- **Arrays:**
  - The field discovery process will include array keys (e.g., `tags[0].key`).
  - For arrays of objects, field discovery includes keys within those objects.
  - The current plan does not attempt to flatten arrays fully into the table unless fields are promoted explicitly.

- **Partial Coverage:**
  - Some fields may not appear in all rows.
  - The field chooser reflects field availability from the **sampled rows only**.
  - No visual indicator (like `(partial)` or row counts) is included at this stage but could be added later.

- **Field Paths:**
  - Internally, field paths are stored in dot notation for simplicity and compatibility with the “Promote Field” feature.

---

## Future Considerations (Not in Scope Now)

These features are recognized as useful but are intentionally out of scope for the current implementation:

- **Rescan All Rows Option:**
  - A manual trigger to rebuild the field tree across the entire dataset.
  - Useful for datasets where significant structural differences exist outside the sampled rows.

- **Sampling Strategy Configuration:**
  - Allow configuration of how sampling is done (e.g., first N rows vs. random sample).
  - Adjustable N value through UI or query parameters.

- **Partial Field Visibility Indicators:**
  - UI markers to show which fields are not consistently present across all rows.
  - Examples: `(partial)` labels or `(3 of 50 rows)` next to field names.

- **Lazy-Loading of Deep Subtrees:**
  - Especially useful if nesting depth is extreme and impacts initial render performance.
  - Considered only if field discovery for large or deeply nested data becomes a bottleneck.

---
