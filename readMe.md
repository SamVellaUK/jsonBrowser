# jsonBrowser

---

## Quick Start
Download and open **jsonBrowser.html** from the root repo directory. 
Copy and paste SQL query results from your SQL Query tool into the textbox and hit "Apply"

---

## Introduction

Sick of having to pick apart JSON data buried in your database tables? Hate wasting time trying to figure out how to get a SQL query to properly parse the JSON?

Copy and Paste (or save to file) your query data and load it into jsonBrowser. 

- Navigate through the **nested objects**
- Use the **Search function** to find Keys and Values at any depth
- Use the edit function to **promote/flatten elements** to the top level
- Hit the SQL button to get a usable **SQL Query** you can feedback to your SQL Editor


Fully offline.
No External JavaScript Libraries 
Zero privacy issues


---

## Usage

Download the jsonBrowser.html file from the repo root directory and open in your browser locally.
The application is completely self contained, there are no external dependancies and all processing is done locally

See userguide.md in the Documentation for more info. 

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
