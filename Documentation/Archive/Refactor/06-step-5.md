# Step 5 – Column‑Chooser Overlay

## Goal  
Build the UI overlay that mirrors and manipulates `state.columnState` through helpers from Steps 1‑4.

## Scope  

* Open/close overlay via existing button.  
* **Left pane** – tree of all discovered JSON paths with check‑boxes.  
* **Right pane** – sortable list of selected columns with up/down controls.  
* **Bottom actions** – **Close** (discard), **Apply** (commit changes).  
* “Select‑all” and per‑column filters as stretch; not mandatory for functional parity.

## Non‑breaking Strategy  
Overlay lives in separate DOM subtree; nothing mutates live table until **Apply**. Closing without apply leaves state untouched.

## Testing Notes  

| Scenario | Steps | Expected |
|----------|-------|----------|
| Open overlay | Click chooser button | Table stays unchanged; overlay shows current state. |
| Hide columns | Uncheck items → Apply | Table updates; overlay closes. |
| Re‑order columns | Up/down → Apply | Table reflects new order. |
| Cancel | Make changes → Close | Table unchanged. |
| Rapid toggling | Open/close repeatedly | No zombie event listeners. |

## Code‑Review Guidance  

* Overlay must only call existing helpers; **no direct DOM surgery** on the table.  
* Ensure overlay keeps an internal **draft copy** until Apply to safeguard non‑breaking rule.  
* **Accessibility** – modal traps focus, ESC closes, proper ARIA roles.  
* Verify CSS naming avoids clashes with main app.  
* Lint for unused listeners on dispose.
