# Step 4 – Column Re‑order Helpers

## Goal  
Manipulate `state.columnState.order` via two pure helpers: `moveColumnUp` / `moveColumnDown` (or a generic `moveColumn(path, delta)`).

## Scope  
* Logic only.  
* Must guard against out‑of‑range moves (top/bottom).  
* Order persistence still kept in runtime state; persisting to storage is future work.

## Non‑breaking Strategy  
Helpers are dormant until UI calls them; regression risk limited to internal state.

## Testing Notes  

| Test | Action | Expected |
|------|--------|----------|
| Move middle column up | Console call | Column swaps position with predecessor. |
| Move first column up | No‑op, function returns false or similar. |
| Move last column down | No‑op. |
| Sequence of moves | Up, down, hide, show | Table order remains stable and predictable. |

## Code‑Review Guidance  

* Confirm helpers are **side‑effect free** except for state mutation + refresh trigger.  
* Ensure reorder results in deterministic order across reloads (once persistence arrives).  
* Check edge‑cases handled without array splice errors.
