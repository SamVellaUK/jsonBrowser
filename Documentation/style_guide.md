
# Web Page Style Guide

## 🌐 Visual Style & UX Overview

### Typography
- **Font**: Monospace stack (`Consolas`, `Courier New`, `Courier`, `monospace`)
- **Font Size**:
  - General text and table cells: `11pt`
  - Row numbers: `8pt`, slightly dimmed (`#555`)

---

### Layout
- **Fixed Top Menu Bar**:
  - **Background**: Deep navy blue (`#002855`)
  - **Padding**: `10px`
  - **Position**: `fixed` (always visible on scroll)
  - **Buttons**: Consistent height/width padding, borderless, white text, and rounded corners.

---

### Table Styling
- **Layout**: Scrollable horizontal table with `border-collapse: collapse`
- **Borders**: Thin (`1px solid #ddd`)
- **Cell Padding**: `8px`, non-wrapping text (`white-space: nowrap`)
- **Header Styling**:
  - Light gray background (`#f2f2f2`)
  - Cursor changes to pointer to indicate clickability (sortable columns)
- **Row Striping**: Alternating background (`#f9f9f9` for even rows)
- **Row Hover**: Light highlight (`#f1f1f1`)
- **Highlighted Row**: Pale yellow (`#ffffcc`) for easy tracking

---

### Nested Table Styling
- Nested content appears in sub-tables (`.nested-table`) with:
  - **White base background** (`#ffffff`)
  - **Alternating background** maintained for clarity
  - No overriding borders — inherits base styling
- Expand/collapse controls: Styled as blue toggles (`#007BFF`) with hover underline

---

### UI Components
- **Expand/Collapse All Buttons**:
  - Toggle all nested rows
- **Column Chooser Overlay**:
  - Dimmed full-screen overlay (`rgba(0,0,0,0.5)`)
  - Centered white card with `border-radius: 10px`, scrollable if content overflows
- **Search Bar**:
  - Integrated into top menu bar
  - Delayed filtering with 300ms debounce
- **JSON Path Toggle**:
  - Hidden by default
  - Toggles dot-notation display for tracing nested data (`color: gray`)
- **“Promote Field” Links**:
  - Appear only in edit mode
  - Styled as blue `+` links
- **Edit Mode Button**:
  - Turns **red** when active
  - Controls visibility of inline promote links

---

### Color Palette

| Element                      | Color         |
|-----------------------------|---------------|
| Header background           | `#f2f2f2`      |
| Row hover                   | `#f1f1f1`      |
| Even row background         | `#f9f9f9`      |
| Highlighted row             | `#ffffcc`      |
| Overlay background          | `rgba(0,0,0,0.5)` |
| Key/field labels            | `darkblue`     |
| Interactive links/buttons   | `#007BFF` (hover `#0056b3`) |
| Top menu background         | `#002855`      |

---

### Responsiveness
- **Tables**: Auto-width with `max-width: 100%`
- **Overlay and top bar**: Responsive across screen sizes
- **Overflow handling**: Nested structures are scrollable if they exceed bounds
