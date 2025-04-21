## 🔽 Version 6.0 — Expand/Collapse All & JSON Path Reveal

### Goal

Implement UI controls for **Expand All**, **Collapse All**, and **Toggle JSON Path Display**. Paths should begin at the first level of nesting, not the global root (`$.raw_event`). This version introduces global control for visibility and debugging, without any promotion or editing logic.

---

### Subtasks

| ID   | Task Description | Status      | Notes |
|------|------------------|-------------|-------|
| 6.1  | **Add `Expand All` button to top menu**<br>Create a new `<button>` labeled "Expand All" and insert it into the existing top bar. | ✅ Complete | Button should be clearly placed and styled to match existing UI |
| 6.2  | **Add `Collapse All` button to top menu**<br>Same as above, but for "Collapse All". | ✅ Complete | Should sit beside Expand All |
| 6.3  | **Implement `toggleAllNested(true)`**<br>Write a JS function to expand all `.nested-content` blocks in the document. | ✅ Complete | Use `querySelectorAll` to find and expand any hidden sections |
| 6.4  | **Implement `toggleAllNested(false)`**<br>Same as above but collapse all `.nested-content` blocks. | ✅ Complete | Ensure that toggles also update visual indicators (`[+]`/`[–]`) |
| 6.5  | **Add `Show JSON Paths` toggle button**<br>Button should toggle the visibility of all `.json-path` elements. | ✅ Complete | Button added and functionality implemented in JavaScript |
| 6.6  | **Ensure only relative paths are shown**<br>Strip `$.raw_event.` from all displayed paths. | ✅ Complete | Use `replace(/^\$\.raw_event\./, '')` |
| 6.7  | **Integrate relative path display into nested key rendering**<br>Modify nested cell renderer to display the relative path under each key if toggled. | ✅ Complete | Display as small, styled `<div class="json-path">...</div>` |
| 6.8  | **Make toggle persistent and independent**<br>Ensure toggling paths on/off doesn’t reset scroll or collapse state. | ✅ Complete | Use only DOM class manipulation, no re-rendering |
| 6.9  | **Style `.json-path` indicators subtly**<br>Use light gray color, small font size, and monospace font. | ✅ Complete | Inline or inside nested tables per style guide |
| 6.10 | **Test all functions on realistic nested data**<br>Use 3–4 level deep objects to test all global expand/collapse and path logic. | ✅ Complete | Include rows with mixed arrays, objects, and values |

---

### Example Output

```html
<td>
  <span class="toggle-nest">[+]</span> {...}
  <div class="nested-content" style="display: none;">
    <table class="nested-table">
      <tr>
        <td>
          sessionContext
          <div class="json-path">userIdentity.sessionContext</div>
        </td>
        <td>
          <span class="toggle-nest">[+]</span> {...}
          <div class="nested-content">...</div>
        </td>
      </tr>
    </table>
  </div>
</td>
```

---

### JavaScript Snippets

```js
function toggleAllNested(expand) {
  document.querySelectorAll('.nested-content').forEach(div => {
    div.style.display = expand ? 'block' : 'none';
  });
  document.querySelectorAll('.toggle-nest').forEach(span => {
    span.textContent = expand ? '[–]' : '[+]';
  });
}

function toggleJsonPaths() {
  const paths = document.querySelectorAll('.json-path');
  const isVisible = paths[0]?.style.display !== 'none';
  paths.forEach(p => p.style.display = isVisible ? 'none' : 'block');
}
```

---

### Testing Checklist

| Checkpoint | Pass Criteria |
|------------|---------------|
| Buttons exist | Expand/Collapse/Show JSON Paths are visible and styled |
| Expand All | Reveals all `.nested-content` recursively |
| Collapse All | Hides all `.nested-content` |
| Path toggle | JSON paths appear under nested keys when toggled |
| Relative paths | All `.json-path` show from first nesting level (no `$.raw_event`) |
| Layout stable | Scroll and table alignment preserved |
