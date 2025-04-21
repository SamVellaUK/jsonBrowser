## 🔽 Version 5.0 — Nested Structure Rendering (Vanilla JS, Recursive)

### Goal

Render deeply nested JSON structures inside the data viewer using **vanilla JavaScript** with support for **recursive, collapsible nesting**. Each level of nesting (objects or arrays) should be rendered only when explicitly toggled open by the user. This version introduces no search or field promotion — just visual exploration via `[+]` and `[–]` toggles.

---

### Subtasks

| ID   | Task Description | Status | Notes |
|------|------------------|--------|-------|
| 5.1  | **Detect nested fields**<br>While rendering each cell, detect if the value is an object or array. | ✅ Complete | Use `typeof === 'object' && value !== null` |
| 5.2  | **Insert `[+]` toggles**<br>Render `[+]` next to any cell that has expandable nested content (`{...}` or `[...]`). | ✅ Complete | Indicate interactive expandable zone |
| 5.3  | **Render nested content recursively**<br>Create a recursive function that builds a `<div class="nested-content">` for each level. | ✅ Complete | Each nested level must contain its own toggles and hideable div |
| 5.4  | **Each nested level collapses independently**<br>Each `[+]` toggle only reveals its immediate child structure — deeper levels remain hidden until clicked. | ✅ Complete | Prevents overwhelming expansion on large structures |
| 5.5  | **Support for objects and arrays**<br>Objects render as key/value tables. Arrays of objects render as sub-tables. Arrays of values as lists. | ✅ Complete | Apply consistent handling recursively |
| 5.6  | **Bind toggle logic with `onclick`**<br>Clicking `[+]` should reveal that level’s `.nested-content` and switch to `[–]`. | ✅ Complete | Use `event delegation` or bind per toggle span |
| 5.7  | **Apply styling to nested layers**<br>All `.nested-table` elements follow styling rules from the style guide: alternating rows, white background, no borders. | ✅ Complete | Maintain readability and indentation |
| 5.8  | **Prevent scroll/layout disruption**<br>Expanded layers should not break row alignment or table boundaries. Use nested `<div>`s with `overflow` control if needed. | ✅ Complete | Maintain column alignment visually |
| 5.9  | **Test recursive depth**<br>Validate with 4–5 levels deep using `raw_event`, `requestParameters.extraDetails.config`, etc. | ✅ Complete | Confirm toggles render/expand/collapse properly per layer |
| 5.10 | **Document recursive logic**<br>Mark function and toggle handling clearly with `// Version: 5.0` and internal comments. | ✅ Complete | Future-proof and understandable |

---

### Example DOM Output (Simplified)

```html
<td>
  <span class="toggle-nest">[+]</span> {...}
  <div class="nested-content" style="display: none;">
    <table class="nested-table">
      <tr>
        <td>config</td>
        <td>
          <span class="toggle-nest">[+]</span> {...}
          <div class="nested-content" style="display: none;">
            <table class="nested-table">
              <tr><td>setting1</td><td>true</td></tr>
              <tr><td>nestedLevel1</td><td>[+]</td></tr>
              <!-- further recursion here -->
            </table>
          </div>
        </td>
      </tr>
    </table>
  </div>
</td>
```

---

### JavaScript Considerations

- Define a **recursive render function** like `renderNested(value, depth)` that:
  - Builds a `.nested-content` block
  - Calls itself on any nested value inside objects or arrays
  - Limits maximum depth if needed (for performance/debugging)
- Toggle spans must be bound to their own local `.nested-content` div

---

### Styling Enhancements

```css
.nested-content {
  margin-left: 16px;
  padding: 4px;
}

.nested-table {
  font-family: monospace;
  border-collapse: collapse;
  background-color: #ffffff;
}

.nested-table tr:nth-child(even) {
  background-color: #f9f9f9;
}

.nested-table tr:hover {
  background-color: #f1f1f1;
}

.toggle-nest {
  color: #007BFF;
  cursor: pointer;
  margin-right: 6px;
}
.toggle-nest:hover {
  text-decoration: underline;
}
```

---

### Testing Checklist

| Checkpoint | Pass Criteria |
|------------|---------------|
| Toggle present | `[+]` shown next to object/array cells |
| Independent toggling | Each nested level expands only when clicked |
| Recursive rendering | Content inside nested objects/arrays is processed recursively |
| Layout intact | Table structure remains aligned and scrollable |
| Styling consistent | Nested levels are readable, monospace, styled correctly |

---

### Notes

- Toggle logic should **not recursively open all layers** — user must click deeper levels manually.
- Optional: include a `depth` counter in the render function for styling or debug indentation.
