## 🧩 Version 7.0 — Field Promotion to Top-Level Column (Flattening)

### Goal

Allow users to promote deeply nested JSON fields to top-level columns. This is a powerful data flattening feature controlled via an "Edit" mode. Flattened columns will be sortable and visibly linked to their source via JSON paths when "JSON Paths" is enabled.

---

## ✅ Feature Increments (to be implemented one at a time)

---

### 7.1 — Add “Edit” Mode Button

| ID   | Task Description | Status | Notes |
|------|------------------|--------|-------|
| 7.1.1 | Add “Edit” button to top bar | ✅ Completed | Label: **Edit**. Initial style: blue border, blue text |
| 7.1.2 | Style active state as red | ✅ Completed | Active state toggles red background with white text |
| 7.1.3 | Bind toggle logic | ✅ Completed | Toggles a global `editMode` flag in JS |

---

### 7.2 — Add Promote (`+`) Icon Beside Nested Fields

| ID   | Task Description | Status | Notes |
|------|------------------|--------|-------|
| 7.2.1 | Insert `+` icons for all non-expandable nested fields | ✅ Completed | Only in Edit mode, styled bold blue (`font-weight: bold; color: #007BFF`) |
| 7.2.2 | Only show promote buttons (`+`) when Edit mode is active | ✅ Completed | Controlled via CSS class or `display: none` |
| 7.2.3 | Position the `+` right-aligned on the same row as the key name | ✅ Completed | Example: `debugInfo <+>` |
| 7.2.4 | Ensure `+` does not conflict with `[+]` (expand toggle) | ✅ Completed | Two different symbols, styled and positioned differently |

---

### 7.3 — Implement Flattening Logic

| ID   | Task Description | Status | Notes |
|------|------------------|--------|-------|
| 7.3.1 | Clicking `+` extracts full path (e.g., `raw_event.userIdentity.sessionContext.attributes.mfaAuthenticated`) | ✅ Completed | Store this as the source path |
| 7.3.2 | New column is added after the parent column (e.g., after `raw_event`) | ✅ Completed | Column label should be the last segment (`mfaAuthenticated`) |
| 7.3.3 | For each row, resolve the path to get the promoted value | ✅ Completed | Empty if value doesn't exist |
| 7.3.4 | Column should support text sorting | ✅ Completed | Use existing sort logic |
| 7.3.5 | Maintain a list of promoted columns to avoid duplicates | ✅ Completed | Prevent re-promoting the same path |

---

### 7.4 — Update JSON Path Display Behavior

| ID   | Task Description | Status | Notes |
|------|------------------|--------|-------|
| 7.4.1 | Rename "Show JSON Paths" button to "JSON Paths" | ✅ Completed | Match “Edit” styling |
| 7.4.2 | Change button style: blue (inactive), red (active) | ✅ Completed | Consistent UI language |
| 7.4.3 | When active, display JSON paths under column headers for promoted fields | ✅ Completed | Use short path starting after the top-level key |
| 7.4.4 | Also show paths under nested keys (as already implemented) | ✅ Completed | Preserve current nested path view |

---

### Display Example (Active Edit Mode + JSON Paths)

```html
<th>
  mfaAuthenticated
  <div class="json-path">userIdentity.sessionContext.attributes.mfaAuthenticated</div>
</th>
```

---

### Style Targets

```css
.promote-button {
  font-weight: bold;
  color: #007BFF;
  cursor: pointer;
  margin-left: 4px;
}

.promote-button:hover {
  text-decoration: underline;
}

button.edit-active,
button.paths-active {
  background-color: #c62828;
  color: white;
  border-color: #c62828;
}
```

---

### Testing Checklist

| Checkpoint | Pass Criteria |
|------------|---------------|
| Edit toggles promote icons | Only visible when Edit mode is active |
| Promote adds column | Field appears as new sortable column in table |
| Order preserved | New column appears directly after parent JSON column |
| JSON Path display updates | Promoted columns display source path in header when enabled |
