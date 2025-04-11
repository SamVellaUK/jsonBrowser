# HTML-Adv Data Viewer for DataGrip

A custom data extractor script for [DataGrip](https://www.jetbrains.com/datagrip/) designed to provide a rich, interactive data exploration experience — particularly well-suited for inspecting nested structures like JSON and XML.

---

## 🚀 Features

- 🔍 **Interactive HTML Table**: View query results as a fully interactive HTML table
- 📂 **Expand/Collapse Nested JSON**: Dynamically explores JSON fields within cells
- 🎯 **Field Promotion**: Promote nested JSON fields to top-level columns in the table
- 🧠 **Intelligent Formatting**: Supports primitives, arrays, maps, and mixed-type collections
- 🧭 **Search & Filter**: Perform quick text searches across all visible data
- 🔢 **Row Numbering & Highlighting**: Easy navigation and inspection
- 📊 **Column Sorting**: Sort by any column (ascending or descending)
- 👓 **Column Chooser Overlay**: Hide/show columns dynamically
- 🔗 **Show JSON Paths**: Toggle visibility of underlying document paths
- ✍️ **Edit Mode Toggle**: Prepares UI for upcoming inline editing support

---

## 🛠️ Usage

1. Open DataGrip.
2. Navigate to **File → Settings → Tools → Data Extractors**.
3. Click **+** to add a new extractor.
4. Set the name (e.g. `HTML Advanced Viewer`) and select the file type as `*.html`.
5. Paste in the contents of `HTML-Adv.html.groovy`.
6. Run any SQL query and export the results using the extractor.

---

## 📦 Intended Use Cases

- Data engineers debugging embedded JSON in PostgreSQL rows
- Analysts working with denormalized structures
- Developers exploring deeply nested response payloads
- Fast visual validation of stringified object fields

---

## 🧩 Planned Enhancements

- Row grouping by key
- Virtual scrolling for very large datasets
- XML parsing

---

## 📄 License

MIT License. Use and modify freely.
