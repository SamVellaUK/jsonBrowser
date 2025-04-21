
# 🧩 DataGrip HTML JSON Viewer — Incremental Build Plan

## ✅ Project Overview

This project delivers a custom [DataGrip](https://www.jetbrains.com/datagrip/) **extractor script** written in **Groovy** that outputs the results of a query as an **interactive HTML+JavaScript-based JSON data explorer**. It is tailored for developers or analysts working with structured or nested JSON data (e.g., audit logs, API results).

The generated HTML will be:
- **Self-contained**: includes all data, scripts, and styles in a single file
- **Interactive**: users can explore, sort, search, and inspect deeply nested JSON
- **Progressively Enhanced**: each new version adds one small feature at a time
- **DataGrip-Compatible**: integrates cleanly with DataGrip’s “Copy as Extractor” feature

The JSON data is generated in Groovy from the result set (`ROWS`) and embedded in the final HTML as a JavaScript object. JavaScript handles all rendering, UI controls, and interaction logic.

This plan is aimed at **incrementally building** the full-featured viewer in a way that ensures maintainability, testability, and maximum clarity. Each version will consist of:
1. **Feature Implementation**
2. **Visual Styling and Layout Enhancements**

---

## 📈 Feature Development Roadmap

| Version | Feature Description                         | Status   | Notes |
|---------|----------------------------------------------|----------|-------|
| 1.0     | Embed data as `const data = [...]` JSON in HTML (no rendering) | ⬜ Planned | Output valid HTML with embedded JS variable; no UI |
| 2.0     | Render basic HTML table from `data`          | ⬜ Planned | Raw tabular view with no interaction |
| 3.0     | Initial CSS styling + layout                 | ⬜ Planned | Monospace, scrollable table, fixed top bar |
| 4.0     | JS architecture planning + dependency selection | ⬜ Planned | Finalize module strategy and library usage |

---

## 🧩 Version 1.0 — Embed JSON in HTML (No Rendering)

### Goal

Produce a valid HTML file from within DataGrip that embeds the query results as a `const data = [...]` JavaScript variable. This will not render the JSON or show anything visually in the browser yet — it sets up the foundation for later work.

### Subtasks

| ID   | Task Description | Status   | Notes |
|------|------------------|----------|-------|
| 1.1  | **Set up Groovy script structure**<br>Create a new `.groovy` extractor script with a basic HTML shell embedded via `OUT.append(...)`. Use triple-quoted strings for readability. | ⬜ Planned | File will be invoked from DataGrip’s “Copy as Extractor” |
| 1.2  | **Transform DataGrip `ROWS` to JSON**<br>Iterate over `ROWS` and `COLUMNS`, building a list of maps (`Map<String, Object>`) representing each row. | ⬜ Planned | Use LinkedHashMap to preserve column order |
| 1.3  | **Escape JSON for safe embedding**<br>Sanitize and escape any special characters (quotes, newlines) to make it safe for inline use inside a `<script>` tag. | ⬜ Planned | Prefer embedding raw JSON as-is with care; use `StringEscapeUtils` if needed |
| 1.4  | **Embed the JSON into a `<script>` tag**<br>Add the variable declaration `const data = ...;` in a script block in the final HTML output. | ⬜ Planned | Place just before `</body>` to support progressive rendering later |
| 1.5  | **Emit complete, valid HTML document**<br>Output a full page including `<!DOCTYPE html>`, `<html>`, `<head>`, and `<body>` — even if the body is empty. | ⬜ Planned | Page must open without error in any browser |
| 1.6  | **Verify correctness in browser**<br>Export a sample dataset and open the output HTML. Confirm that the `data` object exists and contains the full JSON structure. | ⬜ Planned | Use dev tools console: `console.log(data)` |
| 1.7  | **Version and document the script**<br>Add a file header with name, purpose, author (if needed), and `// Version: 1.0` marker. | ⬜ Planned | Keep script metadata readable for future maintainers |

---

## 🗃️ Feature Backlog

Each of the following will be delivered in two phases (logic + layout), in future versions.

| Priority | Feature                        | Notes |
|----------|--------------------------------|-------|
| 🔜       | Column sorting                 | Clickable headers to sort asc/desc |
| 🔜       | Expand/collapse nested JSON    | Visual toggles for nested objects/arrays |
| 🔜       | Search input for all rows      | Instant filtering across visible fields |
| 🔜       | Row highlighting on click      | Helps user track focus |
| 🔜       | Column visibility toggler      | Overlay or dropdown UI to hide/show |
| 🔜       | JSON path display toggle       | Show dot-notation path to any value |
| 🔜       | Promote nested field to column | Inline "+" adds field to top-level columns |
| 🔜       | Responsive polish              | CSS for mobile, wrapping, sizing, etc. |

---

## 🧠 Notes

- Script is intended to work entirely inside DataGrip with **no external build step**
- JSON is extracted client-side, and UI logic is all JavaScript
- HTML must degrade gracefully even with large nested structures
