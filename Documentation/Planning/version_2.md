## 🧩 Version 2.0 — Render JSON to Basic HTML Table

### Goal

Take the embedded `const data = [...]` variable from Version 1 and render it into a plain HTML table using **vanilla JavaScript**. This is a non-interactive, unstyled table designed to ensure JSON values can be parsed and displayed as rows/columns before more advanced features are added.

### Assumptions

- `const data = [...]` is available in a `<script>` tag in the page
- Each entry in `data` is a flat object (no nested rendering yet)
- Rendering should occur automatically on page load

---

### Subtasks

| ID   | Task Description | Status | Notes |
|------|------------------|--------|-------|
| 2.1  | **Insert empty table container in HTML**<br>Add a `<div id="table-root"></div>` or similar in the `<body>` section to serve as the placeholder for the generated table. | ✅ Complete | This div will be dynamically populated by JS |
| 2.2  | **Create a JS function to build the table**<br>Write a `renderTable(data)` function that creates a `<table>`, adds headers from object keys, and rows from object values. | ✅ Complete | Use `document.createElement()` to avoid innerHTML for now |
| 2.3  | **Auto-detect column headers from first row**<br>Extract keys from the first object in the array to build column headers (`<th>` elements). | ✅ Complete | Skip this step and warn if `data.length === 0` |
| 2.4  | **Loop over each row of data**<br>For each object in `data`, create a `<tr>` and add one `<td>` per column using the same key order as headers. | ✅ Complete | `undefined` values should render as empty cells |
| 2.5  | **Append the table to the page**<br>Attach the generated table to `#table-root`. Ensure this happens after the DOM is ready (e.g., in `window.onload`). | ✅ Complete | Table should appear automatically on load |
| 2.6  | **Test with full JSON dataset**<br>Open the resulting HTML in a browser and confirm the table renders correctly with multiple rows and columns. | ✅ Complete | Validate against sample JSON from `cloudtrail_logs.json` |
| 2.7  | **Error handling / fallbacks**<br>If `data` is empty, render a message (“No data found.”). If it's not an array, log a clear error. | ✅ Complete | Ensure consistent error visibility for debugging |
| 2.8  | **Comment and version the JS**<br>Document the table generation logic, including any assumptions about structure. Add a version comment like `// Version: 2.0`. | ✅ Complete | Keep JS readable and traceable |

---

### Example Output (Unstyled)

```html
<table>
  <thead>
    <tr><th>id</th><th>event_time</th><th>event_name</th>...</tr>
  </thead>
  <tbody>
    <tr><td>1</td><td>2023-03-21...</td><td>StopInstances</td>...</tr>
    <tr><td>2</td><td>2023-03-16...</td><td>RebootInstances</td>...</tr>
  </tbody>
</table>