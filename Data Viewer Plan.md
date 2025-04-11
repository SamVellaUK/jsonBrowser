# HTML Data Viewer Planner

## ✅ Features Implemented

- Render JSON to interactive HTML table
- Expand/Collapse nested JSON structures
- Column visibility toggling (overlay UI)
- Inline row highlighting
- Sorting per column (with direction tracking)
- Inline JSON path display toggle
- Promote nested fields to main table columns
- Fixed top menu bar with buttons
- Responsive styling for readability
- Supports both Map and List JSON types


## 🧩 Features to Be Added

- Performance improvements
- rearranging columns
- Keep the header row in view
- JSON Viewer window to view the RAW prettified JSON
- Dark mode styling toggle
- Grouping/filtering rows by field value
- Search functionality
- Support for large datasets via virtual scrolling
- Keyboard navigation / accessibility improvements
- Embedded help 


## 🛠️ Tasks & Progress

| Task | Status |
|------|--------|
| Dark mode toggle |  Planned |
| Save promoted field config | ❌ Not started |
| Toggle column visibility overlay | ✅ Done |
| JSON path display toggle | ✅ Done |
| Search across all rows and nested tables | ✅ Done |
| Promote field to main table | ✅ Done |


## 🐞 Bug List
| Bug | Status | Details |
|-----|--------|---------|
|Some deeper nested values are not being promoted|Unresolved|we get an "undefined" value in the table $.raw_event.responseElements.instancesSet.items[0].currentState.name possibly due to an index [0] reference|

ctrl+k v to view