# Structured Data Browser & SQL Generator - User Guide

Welcome to the Data Browser! This tool allows you to load, view, explore, search, and transform complex JSON, CSV, or TSV data. You can also generate SQL (Snowflake or PostgreSQL) queries based on the data structure you define.

## 1. Getting Started: Loading Your Data

There are a few ways to load data into the browser:

- **Automatic (for developers):** If the application is launched with a JavaScript variable named `jsonData` available globally, the tool will attempt to load this data automatically on startup.
- **Manual Input ("View/Edit Data" Modal):**
    - Click the "View/Edit Data" button in the header. This opens a modal.
    - **Paste Data:** You can directly paste your JSON, CSV, or TSV data into the large text area.
    - **Load from File:** Click the "Load File" button to select a `.json`, `.csv`, `.tsv`, or `.txt` file from your computer. The content will be loaded into the text area.
    - **Drag and Drop File:** Drag a compatible file (JSON, CSV, TSV, TXT) directly onto the modal content area (the text area or the space around it).
    - **Apply Changes:** Once your data is in the text area:
        - You can optionally click "Validate JSON" if you've pasted JSON to check its syntax.
        - Click "Apply & Close". The tool will attempt to parse the content:
            - First as JSON.
            - If JSON parsing fails, it will try to parse it as CSV/TSV, automatically detecting common delimiters (comma, tab, pipe).
            - The parsed data will then populate the main table view.

## 2. Main Interface Overview

The interface consists of two main parts:

- **Header:** Contains controls for searching, display options, and actions.
- **Main Table Area:** Displays your data in a scrollable, interactive table.

### Header Elements:

- **Search Box:** Type your search query here and press Enter.
- **Search Navigation (← →):** Navigate between search results (previous/next). Disabled if no results.
- **Controls:**
    - **Expand All:** Expands all nested objects/arrays in the table.
    - **Collapse All:** Collapses all nested objects/arrays.
    - **Paths:** Toggles the display of the full JSON path for each cell's data below its value. (Active state is green).
    - **Edit Mode:** Toggles editing capabilities like column reordering, removal, and promoting nested values. (Active state is green).
    - **SQL:** Opens a modal to show generated SQL based on the current view.
    - **View/Edit Data:** Opens the modal for loading/editing raw data.
- **Search Info:**
    - Displays the current search result count (e.g., "1 of 5").
    - Indicates if some search results are in hidden/collapsed columns/paths: (X hidden).
    - If no search is active, shows the total number of rows (e.g., "10 rows").

### Main Table Area:

- **Sticky Row Numbers (#):** The first column always shows the row number and stays visible when scrolling horizontally.
- **Column Headers:**
    - Display the field names (or promoted paths).
    - **Click to Sort:** Click a column header to sort the data by that column. Click again to reverse the sort order. An arrow (↑ or ↓) indicates the current sort.
    - **Draggable (in Edit Mode):** When "Edit Mode" is active, you can drag column headers to reorder them.
    - **Remove Button (in Edit Mode):** A small red - button appears next to the column name in "Edit Mode". Click it to remove the column from the view.
- **Data Cells:**
    - Display the values from your data.
    - **Expandable Content:** If a cell contains an object or array, it will show as `Object(X)` or `Array(X)`.
        - Click the `+` icon (or the text) to expand it inline. The icon changes to `-`.
        - Expanded content can be a simple list, or a nested table if it's an array of similar objects.
    - **Promote Button (in Edit Mode):** A small green `+` button appears next to primitive values within nested structures when "Edit Mode" is active. See "Promoting Nested Values" below.
    - **Search Highlighting:** Matched search terms are highlighted in yellow. The currently active search result is highlighted in orange.

## 3. Core Features

### 3.1. Viewing and Exploring Data

- **Expanding/Collapsing:** Use the `+/-` icons in cells or the "Expand All"/"Collapse All" buttons to navigate through nested data.
- **Sorting:** Click column headers to sort.
- **Show Paths:** Use the "Paths" button to see the exact JSON path for each piece of data, useful for understanding complex structures.

### 3.2. Searching

- Type your query into the Search Box.
- Press Enter.
- Results are highlighted. The tool automatically expands paths and scrolls to the first result.
- Use the `←` (Previous) and `→` (Next) buttons to navigate through matches.
- If some results are in columns that are currently hidden (e.g., due to promoting a value from deep within a structure that isn't fully expanded as a column), the "Search Info" area will indicate `(X hidden)`. You might need to promote the relevant path to a column to see these easily.
- To clear the search, delete the text from the search box and press Enter, or press Escape while the search box is focused.

### 3.3. Editing Data Structure (Edit Mode)

- Click the "Edit Mode" button to activate these features. The button will turn green.
- **Reordering Columns:** Click and drag a column header to a new position.
- **Removing Columns:** Click the red `-` button on a column header.
- **Promoting Nested Values to Columns:**
    - This is a key feature for flattening complex JSON for easier viewing or SQL generation.
    - When Edit Mode is active, if you hover over a primitive value (string, number, boolean) inside an expanded object or array, a green `+` button will appear next to it.
    - **Simple Promotion:** If the value is in a simple path like `object.field.value`, clicking `+` will add a new column to the main table with the header `object.field.value`, displaying this value for each row.
    - **Promotion from Array Item (Advanced):** If the value is inside an object within an array (e.g., `myArray[0].targetField`), clicking `+` will open a small popover. This is because the browser needs to know how to uniquely identify which item in `myArray` you want to promote `targetField` from for every row.
        - The popover will list sibling key-value pairs from that specific array item, plus an "Original position" option.
        - Example: If `myArray[0]` is `{ "id": "abc", "name": "Item 1", "targetField": "Value A" }`
        - The popover might show:
            - `id: "abc"`
            - `name: "Item 1"`
            - `Original position ([0])`
        - If you choose `id: "abc"`, a new column will be created with a header like `myArray[id="abc"].targetField`. This tells the browser to find the item in `myArray` where `id` is `"abc"` and then get its `targetField`.
        - If you choose `Original position ([0])`, the column header will be `myArray[0].targetField`.
        - This allows you to "pin" specific information from array elements as top-level columns.

### 3.4. Generating SQL

- Arrange your columns as desired using visible top-level fields, sorting, and promoting nested values. The SQL generator will use these visible columns.
- Click the "SQL" button.
- A modal will appear:
    - **SQL Output Area:** Shows the generated SQL.
    - **Dialect Selector:** Choose between Snowflake and PostgreSQL. The SQL syntax will adapt.
    - **Copy Button:** Copies the generated SQL to your clipboard.
    - **Close Button (×):** Closes the SQL modal.
- The generated SQL assumes your base table is named `json_data` (aliased as `e`) and the columns selected/promoted are fields within the JSON stored in this table. For complex promoted paths (especially from arrays), it will use `LATERAL FLATTEN` (Snowflake) or `jsonb_array_elements` (PostgreSQL) and appropriate `WHERE` clauses.

### 3.5. Managing Raw Data (View/Edit Data Modal)

- Accessed via the "View/Edit Data" button.
- **Text Area:** Shows the current raw data (JSON stringified, or original CSV/TSV). You can edit it here.
- **Load File:** Loads a file into the text area.
- **Select All:** Selects all text in the text area.
- **Copy:** Copies the text area content to the clipboard.
- **Clear:** Clears the text area.
- **Validate JSON:** If you believe the content is JSON, this button will try to parse it.
    - **Success:** Formats the JSON nicely (indented) and shows a green "JSON is valid" message.
    - **Failure:** Shows a red error message.
- **Apply & Close:**
    - Parses the content (JSON, then CSV/TSV with auto-delimiter detection).
    - Updates the main browser view with the new data.
    - Closes the modal.
    - If parsing fails, an error message is shown in the modal.
- **Validation Status:** A small message area at the bottom of the modal shows feedback (e.g., "JSON is valid," "Copied to clipboard," error messages).
- **Close Button (×):** Closes the modal without applying changes from the text area (unless already applied via "Apply & Close").

## 4. Keyboard Shortcuts

- **Global:**
    - `Tab` / `Shift+Tab`: Navigate between focusable elements.
    - `Enter` or `Space`: Activate focused buttons, expand/collapse items, trigger column sorts.
    - `Escape`:
        - If promote popover is open: Closes popover.
        - If SQL or JSON modal is open: Closes the modal.
        - If search box is focused: Clears search query and results.
        - If in "Edit Mode" (and no modal/popover open): Exits "Edit Mode".
- **Search Box:**
    - `Enter`: Perform search.
    - `Escape`: Clear search query and results.
- **JSON Edit Area (in View/Edit Data modal):**
    - Standard text editing shortcuts apply.
    - Escape does not close the modal if the text area is focused, allowing you to use Escape for other text operations if your OS supports it.

## 5. Tips & Troubleshooting

- **No Data Displayed?** If the table is empty after loading, click "View/Edit Data" to ensure your data was pasted/loaded correctly and then click "Apply & Close". Check the validation status for any errors.
- **CSV/TSV Delimiters:** The tool attempts to auto-detect common delimiters (comma, tab, pipe) when you "Apply & Close" data that isn't valid JSON. If parsing seems incorrect, ensure your CSV/TSV is well-formed.
- **Performance:** Very large JSON files or extremely deeply nested structures might impact browser performance, especially with "Expand All" or extensive promotions.
- **Understanding Promoted Paths:** The column headers for promoted paths (e.g., `raw_event.requestParameters.tags[key="Environment"].value`) directly reflect how the data is accessed. This syntax is used for SQL generation.
- **SQL Generation:** The SQL generated is based on the currently visible and promoted columns. If you want a field in your SQL, make sure it's a column in the table view.