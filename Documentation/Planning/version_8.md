## 🛠️ Version 8.0 — Column Chooser Overlay (Popup)

### Goal

Introduce a popup overlay that provides a full view of the data structure. This will allow the user to:
- See all **base columns** and **nested elements**
- Select which fields to **show/hide**
- Eventually **promote nested fields**
- Control the **order of columns**

For detailed design considerations, refer to the [Column Chooser Field Tree Design](./column-chooser-design.md).

---

## 📌 Incremental Feature Plan

---

### 8.1 — Add Overlay Framework

| ID   | Task Description | Status | Notes |
|------|------------------|--------|-------|
| 8.1.1 | Add a **Column Chooser** button to the top menu | ✅ Complete | Styled consistently with other top bar buttons |
| 8.1.2 | Create a hidden overlay `<div id="column-chooser">...</div>` | ✅ Complete | Use `display: none;` initially |
| 8.1.3 | Add basic show/hide logic for the overlay | ✅ Complete | Open on button click, close on outside click or ESC |
| 8.1.4 | Display **full structure tree** of the JSON data inside the overlay | ✅ Complete| Use indentation for nesting, label base columns first |
| 8.1.5 | Ensure popup works across sample datasets | ✅ Complete | Validate with wide and deep structures |

---

### 8.2 — Add Show/Hide Base Columns

| ID   | Task Description | Status | Notes |
|------|------------------|--------|-------|
| 8.2.1 | Add checkboxes next to base columns in the overlay | ✅ Complete | Checked = visible, unchecked = hidden |
| 8.2.2 | Bind checkbox logic to toggle table column visibility live | ✅ Complete | Should not require full re-render |
| 8.2.3 | Persist visibility state while overlay is open | ✅ Complete | Use JS state variable to track shown/hidden columns |

---

### 8.3 — Enable Adding Nested Data Elements as Columns

| ID   | Task Description | Status | Notes |
|------|------------------|--------|-------|
| 8.3.1 | Display nested fields in overlay as expandable tree view | ✅ Complete | Mirror the nested data structure |
| 8.3.2 | Add a "promote" or "add" action for each nested field in the popup | ✅ Complete | Uses same logic as field promotion (flattening) |
| 8.3.3 | Insert promoted fields into the table at the correct position | ✅ Complete | May reuse existing flattening code from Version 7 |

---

### 8.4 — Add Column Reordering Capability

| ID   | Task Description | Status | Notes |
|------|------------------|--------|-------|
| 8.4.1 | Add up/down reorder buttons next to each field in overlay | ✅ Complete | Drag-and-drop can be considered later, but buttons first |
| 8.4.2 | Apply reordering live to the displayed table columns | ✅ Complete | Preserve sortability and other column features |
| 8.4.3 | Maintain ordering state between popup open/close cycles | ✅ Complete | Simple array order tracking in JS state |

---

## 🧪 Testing Checklist (Per Feature Step)

| Feature | Test Cases |
|---------|------------|
| Overlay shows structure | Popup opens and lists base/nested fields clearly |
| Hide/show works | Toggling checkboxes correctly hides/unhides columns |
| Nested field promotion | Promoted nested fields appear in correct position |
| Column reordering | Moving fields up/down updates the table immediately |
| UI responsive | Works with wide tables and deeply nested structures |

---

## 🔥 UI and Styling Notes

- Overlay should **dim the background** while open (`rgba(0, 0, 0, 0.5)`).
- Popup should remain **scrollable** for large field lists.
- Style should match the existing viewer (monospace for field names, clear nesting).

---

Would you like me to package this as a `.md` plan file as with previous versions?
