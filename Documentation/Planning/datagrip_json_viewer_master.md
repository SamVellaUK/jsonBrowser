# 🧩 DataGrip HTML JSON Viewer — Master Project Plan

## ✅ Project Overview

This project delivers a custom [DataGrip](https://www.jetbrains.com/datagrip/) **extractor script** written in **Groovy** that outputs the results of a query as an **interactive HTML+JavaScript-based JSON data explorer**. It is tailored for developers or analysts working with structured or nested JSON data (e.g., audit logs, API results).

The generated HTML will be:
- **Self-contained**: includes all data, scripts, and styles in a single file
- **Interactive**: users can explore, sort, search, and inspect deeply nested JSON
- **Progressively Enhanced**: each new version adds one small feature at a time
- **DataGrip-Compatible**: integrates cleanly with DataGrip’s “Copy as Extractor” feature

Each version includes:
1. Feature Implementation
2. Visual Styling and Layout Enhancements

---


## 📈 Feature Development Roadmap

| Version | Feature Description                         | Status   | Link |
|---------|----------------------------------------------|----------|------|
| 1.0     | Embed data as `const data = [...]` JSON in HTML (no rendering) | ✅ Complete | [Version 1 Plan](version_1.md) |
| 2.0     | Render basic HTML table from `data`          | ✅ Complete | [Version 2 Plan](version_2.md) |
| 3.0     | Initial CSS styling + layout                 | ✅ Complete | [Version 3 Plan](version_3.md) |
| 4.0     | JS architecture planning + dependency selection | ✅ Complete | [Version 4 Plan](version_4.md) |
| 5.0     | Render deeply nested JSON structures with collapsible toggles using vanilla JS | ✅ Complete | [Version 5 Plan](version_5.md) |
| 6.0     | Add global expand/collapse controls and JSON path display toggle | ✅ Complete | [Version 6 Plan](version_6.md) |
| 7.0     | Promote deeply nested JSON fields to top-level columns (flattening) | 🔜 Planned | [Version 7 Plan](version_7.md) |


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
| 🔜       | Flatten nested field to column | Inline "+" adds field to top-level columns |
| 🔜       | Responsive polish              | CSS for mobile, wrapping, sizing, etc. |

---

## 🧠 General Notes

- Script is intended to work entirely inside DataGrip with **no external build step**
- JSON is extracted client-side, and UI logic is all JavaScript
- HTML must degrade gracefully even with large nested structures
