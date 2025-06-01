# HTML-Adv Data Viewer

---

## Usage

Download the jsonBrowser.html file from the repo root directory and open in your browser locally.
The application is completely self contained, there are no external dependancies and all processing is done locally

---

## Features

- **Interactive HTML Table**: View query results as a fully interactive HTML table
- **Expand/Collapse Nested JSON**: Dynamically explores JSON fields within cells
- **Field Promotion**: Promote nested JSON fields to top-level columns in the table
- **Intelligent Formatting**: Supports primitives, arrays, maps, and mixed-type collections
- **Search & Filter**: Perform quick text searches across all visible data
- **Row Numbering & Highlighting**: Easy navigation and inspection
- **Column Sorting**: Sort by any column (ascending or descending)
- **Column Chooser Overlay**: Hide/show columns dynamically
- **Show JSON Paths**: Toggle visibility of underlying document paths
- **Edit Mode Toggle**: Prepares UI for upcoming inline editing support

---

## Intended Use Cases

- Data engineers debugging embedded JSON in Database tables
- Analysts working with denormalized structures
- Developers exploring deeply nested response payloads
- Fast visual validation of stringified object fields

---

## Planned Enhancements

- Row grouping by key
- Virtual scrolling for very large datasets
- XML parsing

---

## License

MIT License. Use and modify freely.
