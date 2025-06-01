# Step 2 – Edit‑mode UI Hook‑up

## Goal  
Surface the Promotion API through the existing **edit‑mode** workflow.

* When `state.editMode === true`, each expandable value renders a *promote* control (text icon or SVG).  
* Clicking the control calls Promotion API → triggers table refresh.  
* Toggling edit‑mode cleans up event listeners.

## Scope  
* Minimal visual polish—focus on correct wiring.  
* **Accessibility** – controls must be keyboard‑focusable and expose an `aria-label`.

## Non‑breaking Strategy  
Edit‑mode must be *opt‑in*. If users never toggle it, table behaves as before.

## Testing Notes  

| Scenario | Steps | Pass criteria |
|----------|-------|---------------|
| Enter edit‑mode | Toggle switch | Promote icons appear but nothing else changes. |
| Promote path | Click icon | Column appears; no console errors. |
| Exit edit‑mode | Toggle off | Icons disappear; browser memory profile stable. |
| Keyboard flow | Tab to icon, press Enter | Equivalent to mouse click. |

## Code‑Review Guidance  

* Verify removal of listeners on mode exit.  
* Confirm no inline styles or HTML escapes missing.  
* Check focus outline visible (a11y).
