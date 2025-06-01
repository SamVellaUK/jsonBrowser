# Step 3 – Visibility Toggle

## Goal  
Introduce a `hidden` boolean per column in `state.columnState` and have the refresh engine respect it.

## Scope  
* Two helper functions: `hideColumn(path)` and `showColumn(path)` (names flexible).  
* **No UI changes yet.**

## Non‑breaking Strategy  
Default all existing columns as `hidden: false`. Helpers must be no‑ops unless called.

## Testing Notes  

1. Manually hide a column via console → verify DOM omits both `<th>` and `<td>` cells.  
2. Show same column → layout recovers original order.  
3. Hide then promote new column → app remains stable.

## Code‑Review Guidance  

* Ensure tabular row length stays consistent (every row same number of `<td>`).  
* Validate that search, expand, and row selection utilities still operate on visible subset without JavaScript errors.  
* Unit test toggling twice returns to original state.
