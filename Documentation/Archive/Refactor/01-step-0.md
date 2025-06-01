# Step 0 – Refactor: `applyColumnState()` Engine

## Goal  
Create one function (name not enforced) that:

1. Reads `state.columnState` (order, visibility, labels).  
2. Rebuilds `<thead>` and `<tbody>` accordingly.  
3. Preserves row‑level artefacts where feasible (e.g. search highlights).  

## Scope  
* **No UI changes**.  
* No state mutations beyond reading `state.columnState`.  
* Existing render helpers (`TableRenderer`, etc.) may be folded into or called by the new engine but must not disappear without equivalent coverage.

## Non‑breaking Strategy  
* Branch off current `main`.  
* Keep legacy renderer alive behind a feature flag until the new path renders identically.  
* Ship after parity is proven.

## Testing Notes  

| Test | Method | Expected |
|------|--------|----------|
| Baseline diff | Capture HTML of a sample table before/after flag flip | Only attribute ordering may differ; visual content identical. |
| Large dataset | Load 5 000+ rows | No memory leaks, < 1 s re‑paint on modern laptop. |
| Search / expand | Perform existing UI interactions | Behaviour unchanged. |

## Code‑Review Guidance  

* Confirm **no DOM touching** outside the new engine.  
* Ensure renderer is **pure‑ish** (no hidden globals).  
* Verify the old path is fully deleted or gated off before merge.
