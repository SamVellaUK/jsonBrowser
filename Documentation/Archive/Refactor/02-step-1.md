# Step 1 – Promotion API

## Goal  
Expose a programmatic way to *flatten* a nested JSON path into `state.columnState`.

* **Input** – canonical JSON pointer (e.g. `raw_event.userIdentity.type`).  
* **Result** –  
  * Adds entry to `state.columnState.order` (if absent).  
  * Generates user‑facing label (spec rules below).  
  * No UI side‑effects.

## Scope  
* Logic only—no buttons, glyphs, or overlay work.  
* Must handle duplicates idempotently.  
* Must accept optional index parameter for insertion order (for Step 4).

## Non‑breaking Strategy  
Call the API from dev‑tools console and verify the table refreshes (via Step 0 engine) without side‑effects.

## Testing Notes  

| Test | Expected |
|------|----------|
| Promote already‑flat path | Table unchanged; no duplicates. |
| Promote nested path | New column appears at end of table. |
| Re‑promote same path | No duplicate columns; idempotent. |
| Promote non‑existent path | API returns controlled error; app does not crash. |

## Code‑Review Guidance  

* Unit tests prefer pure functions over mutating helpers.  
* Label‑generation logic is deterministic and isolated.  
* API returns clear error objects, not exceptions leaking to UI.
