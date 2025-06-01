## 🧩 Version 1.0 — Embed JSON in HTML (No Rendering)

### Goal

Produce a valid HTML file from within DataGrip that embeds the query results as a `const data = [...]` JavaScript variable. This will not render the JSON or show anything visually in the browser yet — it sets up the foundation for later work.

---

### Subtasks

| ID   | Task Description | Status   | Notes |
|------|------------------|----------|-------|
| 1.1  | **Set up Groovy script structure**<br>Create a new `.groovy` extractor script with a basic HTML shell embedded via `OUT.append(...)`. Use triple-quoted strings for readability. | ✅ Complete | File will be invoked from DataGrip’s “Copy as Extractor” |
| 1.2  | **Transform DataGrip `ROWS` to JSON**<br>Iterate over `ROWS` and `COLUMNS`, building a list of maps (`Map<String, Object>`) representing each row. | ✅ Complete | Use LinkedHashMap to preserve column order |
| 1.3  | **Escape JSON for safe embedding**<br>Sanitize and escape any special characters (quotes, newlines) to make it safe for inline use inside a `<script>` tag. | ✅ Complete | Prefer embedding raw JSON as-is with care; use `StringEscapeUtils` if needed |
| 1.4  | **Embed the JSON into a `<script>` tag**<br>Add the variable declaration `const data = ...;` in a script block in the final HTML output. | ✅ Complete | Place just before `</body>` to support progressive rendering later |
| 1.5  | **Emit complete, valid HTML document**<br>Output a full page including `<!DOCTYPE html>`, `<html>`, `<head>`, and `<body>` — even if the body is empty. | ✅ Complete | Page must open without error in any browser |
| 1.6  | **Verify correctness in browser**<br>Export a sample dataset and open the output HTML. Confirm that the `data` object exists and contains the full JSON structure. | ✅ Complete | Use dev tools console: `console.log(data)` |
| 1.7  | **Version and document the script**<br>Add a file header with name, purpose, author (if needed), and `// Version: 1.0` marker. | ✅ Complete | Keep script metadata readable for future maintainers |
