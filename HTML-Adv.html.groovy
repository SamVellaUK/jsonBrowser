/*
 * Available context bindings:
 *   COLUMNS     List<DataColumn>
 *   ROWS        Iterable<DataRow>
 *   OUT         { append() }
 *   FORMATTER   { format(row, col); formatValue(Object, col); getTypeName(Object, col); isStringLiteral(Object, col); }
 *   TRANSPOSED  Boolean
 * plus ALL_COLUMNS, TABLE, DIALECT
 *
 * where:
 *   DataRow     { rowNumber(); first(); last(); data(): List<Object>; value(column): Object }
 *   DataColumn  { columnNumber(), name() }
 */

import static com.intellij.openapi.util.text.StringUtil.escapeXmlEntities
import groovy.json.JsonSlurper

NEWLINE = System.getProperty("line.separator")
// Define a global constant for HTML pattern matching
HTML_PATTERN = ~"<.+>"

generateHTML()

// Function to print the header row with row numbers
void printHeaderRow(def columns) {
    OUT.append("$NEWLINE<tr>$NEWLINE")
    OUT.append("  <th>#</th>$NEWLINE")
    columns.eachWithIndex { col, index ->
        def header = col.name()
        def escaped = escapeXmlEntities(header.replaceAll("\\t|\\b|\\f", "")).replaceAll("\\r|\\n|\\r\\n", "<br/>")
        OUT.append("  <th data-column-index='${index + 1}' data-sort-dir='desc' onclick='sortColumn(${index + 1})'>$escaped</th>$NEWLINE")
    }
    OUT.append("</tr>")
}

// Function to print a data row with row number, highlighting, and dynamically added columns
void printDataRow(def row, def columns) {
    def rowData = [:]
    columns.each { col ->
        rowData[col.name()] = row.value(col)
    }

    OUT.append("$NEWLINE<tr onclick='highlightRow(this)' data-row='${new groovy.json.JsonBuilder(rowData).toString()}'>$NEWLINE")
    OUT.append("  <td class='row-number'>${row.rowNumber()}</td>$NEWLINE")
    columns.eachWithIndex { col, colIndex ->
        def value = row.value(col)
        def str = FORMATTER.format(row, col)
        if (value == null || value.toString().isEmpty()) {
            OUT.append("  <td class='empty' data-column-index='${colIndex + 1}'>null</td>$NEWLINE")
        
        } else if (looksLikeJSON(value.toString())) {
            def jsonValue
            try {
                jsonValue = new JsonSlurper().parseText(value.toString())
            } catch (e) {
                jsonValue = null
            }

            if (jsonValue != null) {
                def nestedTableId = "nested-" + row.rowNumber() + "-" + col.columnNumber()
                def documentPath = "\$.${col.name()}"
                OUT.append("  <td data-column-index='${colIndex + 1}'><span class='expand-collapse' id='icon-${nestedTableId}' onclick='toggleNested(\"${nestedTableId}\")'>[+]</span>")
                OUT.append(" ${col.name()} {}")
                OUT.append("<div style='display:none' id='${nestedTableId}'>")
                OUT.append(convertToHTMLTable(jsonValue, nestedTableId, documentPath))
                OUT.append("</div></td>$NEWLINE")
            } else {
                def escaped = escapeXmlEntities(str)
                OUT.append("  <td data-column-index='${colIndex + 1}'>$escaped</td>$NEWLINE")
            }
        } else {
            def escaped = str ==~ HTML_PATTERN
                ? str
                : escapeXmlEntities(str.replaceAll("\\t|\\b|\\f", "")).replaceAll("\\r|\\n|\\r\\n", "<br/>")
            OUT.append("  <td data-column-index='${colIndex + 1}'>$escaped</td>$NEWLINE")
        }
    }
    OUT.append("</tr>")
}

void generateHTML() {
    def HTML_PATTERN = ~"<.+>"

    // Collect rows into a list
    def rowsList = []
    ROWS.each { row ->
        rowsList << row
    }

    OUT.append(generateHTMLHeader())
    OUT.append(generateHTMLStyle())
    OUT.append(generateShowColumnOverlayScript())
    OUT.append(generateToggleColumnVisibilityScript())
    OUT.append(generateShowAllColumnsScript())
    OUT.append(generateToggleJSONPathsScript())
    OUT.append(generateInitializeJSONPathsScript())
    OUT.append(generateSearchTableScript())
    OUT.append(generateHighlightRowScript())
    OUT.append(generateSortColumnScript())
    OUT.append(generateToggleNestedScript())
    OUT.append(generateExpandCollapseAllScript())
    OUT.append(generateSelectDeselectAllColumnsScript())
    OUT.append(generateToggleEditModeScript())
    OUT.append(generatePromoteFieldScript())
    OUT.append("</head><body>")
    OUT.append(generateTopMenu())
    OUT.append("<table id='data-table' border='1' style='border-collapse:collapse'>")

    printHeaderRow(COLUMNS)  // Print headers

    rowsList.each { row ->
        printDataRow(row, COLUMNS)  // Print each data row
    }

    OUT.append("</table>")
    OUT.append(generateColumnOverlay(COLUMNS, "data-table"))
    OUT.append("</body></html>")
}

// Function to check if a string is valid JSON
// Function to check if a string looks like JSON without throwing
boolean looksLikeJSON(String str) {
    if (!str) return false;
    str = str.trim();
    return (str.startsWith("{") && str.endsWith("}")) || (str.startsWith("[") && str.endsWith("]"));
}

boolean isJSON(String str) {
    if (str == null || str.isEmpty()) {
        return false
    }
    str = str.trim()
    if ((str.startsWith("{") && str.endsWith("}")) || (str.startsWith("[") && str.endsWith("]"))) {
        try {
            new JsonSlurper().parseText(str)
            return true
        } catch (Exception e) {
            return false
        }
    }
    return false
}

// Function to generate HTML header
String generateHTMLHeader() {
    return """
    <!DOCTYPE html>
    <html>
      <head>
        <title>JSON to HTML Table</title>
        <meta charset="UTF-8">
    """
}

String generateHTMLStyle() {
    return """
<style>
body { font-family: 'Consolas', 'Courier New', Courier, monospace; font-size: 11pt !important; padding-top: 50px; }
table { border-collapse: collapse; width: auto; max-width: 100%; }
table th, table td { border: 1px solid #ddd; padding: 8px; white-space: nowrap; font-size: 11pt !important; }
table th { background-color: #f2f2f2; cursor: pointer; }
table tr:nth-child(even) { background-color: #f9f9f9; }
table tr:hover { background-color: #f1f1f1; }
.highlighted { background-color: #ffffcc !important; }
.nested-table th, .nested-table td { background-color: white !important; }
.nested-table tr { background-color: unset !important; }
.nested-table tr:nth-child(even) { background-color: #ffffff !important; }
.nested-table tr:nth-child(odd) { background-color: #f9f9f9 !important; }
.nested-table tr:hover { background-color: #f1f1f1 !important; }
.array { background-color: #e7f3f7; }
.empty { color: #bbb; }
.expand-collapse { cursor: pointer; color: #007BFF; }
.expand-collapse:hover { text-decoration: underline; }
.row-number { font-size: 8pt; color: #555; !important;}
.top-menu { position: fixed; top: 0; left: 0; width: 100%; background-color: #002855; padding: 10px; z-index: 1000; }
.top-menu button { margin-right: 10px; background-color: #007BFF; color: white; border: none; padding: 10px 20px; font-family: 'Consolas', 'Courier New', Courier, monospace; font-size: 11pt; border-radius: 4px; cursor: pointer; }
.top-menu button:hover { background-color: #0056b3; }
.top-menu input { padding: 10px; font-size: 11pt; }
.overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); display: none; justify-content: center; align-items: center; }
.overlay-content { background-color: white; padding: 20px; border-radius: 10px; max-height: 80%; overflow-y: auto; }
.overlay-content h3 { margin-top: 0; }
.overlay-content .indent-0 { margin-left: 0; }
.overlay-content .indent-1 { margin-left: 20px; }
.overlay-content .indent-2 { margin-left: 40px; }
.overlay-content .indent-3 { margin-left: 60px; }
.overlay-content .indent-4 { margin-left: 80px; }
.overlay-content .indent-5 { margin-left: 100px; }
.key { color: darkblue; }
.json-path { color: gray; display: none; }
</style>
    """
}

String generateShowColumnOverlayScript() {
    return """
    <script>
    function showColumnOverlay() {
        var overlay = document.getElementById('column-overlay');
        overlay.style.display = 'flex';
    }

    function hideColumnOverlay() {
        var overlay = document.getElementById('column-overlay');
        overlay.style.display = 'none';
    }
    </script>
    """
}


// Function to generate the toggleNested JavaScript function
String generateToggleNestedScript() {
    return """
    <script>
    function toggleNested(tableId) {
        var table = document.getElementById(tableId);
        var display = table.style.display === 'none' ? 'table-row-group' : 'none';
        table.style.display = display;
        var icon = document.getElementById('icon-' + tableId);
        icon.innerHTML = display === 'none' ? '[+]' : '[-]';
    }
    </script>
    """
}

// Function to generate the expand/collapse all JavaScript function
String generateExpandCollapseAllScript() {
    return """
    <script>
    function toggleAllNested(expand) {
        var icons = document.querySelectorAll('.expand-collapse');
        icons.forEach(icon => {
            var tableId = icon.id.replace('icon-', '');
            var table = document.getElementById(tableId);
            var display = expand ? 'table-row-group' : 'none';
            table.style.display = display;
            icon.innerHTML = expand ? '[-]' : '[+]';
        });
    }
    </script>
    """
}

String generateToggleColumnVisibilityScript() {
    return """
    <script>
    function toggleColumnVisibility(tableId, colIndex, checkbox) {
        var table = document.getElementById(tableId);
        var rows = table.rows;
        var isHidden = !checkbox.checked;
        for (var i = 0; i < rows.length; i++) {
            var cell = rows[i].cells[colIndex];
            if (cell) {
                cell.style.display = isHidden ? 'none' : '';
            }
        }
    }
    </script>
    """
}

String generateShowAllColumnsScript() {
    return """
    <script>
    function showAllColumns() {
        var table = document.getElementById('data-table');
        var rows = table.rows;
        for (var i = 0; i < rows[0].cells.length; i++) {
            for (var j = 0; j < rows.length; j++) {
                rows[j].cells[i].style.display = '';
            }
        }
        // Also ensure all checkboxes in the overlay are checked
        var checkboxes = document.querySelectorAll('#column-overlay input[type="checkbox"]');
        checkboxes.forEach(function(checkbox) {
            checkbox.checked = true;
        });
    }
    </script>
    """
}

String generateToggleJSONPathsScript() {
    return """
    <script>
    function toggleJSONPaths() {
        var paths = document.querySelectorAll('.json-path');
        var toggleButton = document.querySelector('button[onclick="toggleJSONPaths()"]');
        var pathsVisible = paths[0].style.display === 'block';

        paths.forEach(function(path) {
            if (pathsVisible) {
                path.style.display = 'none';
            } else {
                path.style.display = 'block';
            }
        });

        // Update button text
        if (pathsVisible) {
            toggleButton.textContent = 'Show JSON Paths';
        } else {
            toggleButton.textContent = 'Hide JSON Paths';
        }
    }
    </script>
    """
}

String generateInitializeJSONPathsScript() {
    return """
    <script>
    function initializeJSONPaths() {
        var paths = document.querySelectorAll('.json-path');
        paths.forEach(function(path) {
            path.style.display = 'none';
        });
    }

    document.addEventListener('DOMContentLoaded', function() {
        initializeJSONPaths();
    });
    </script>
    """
}

String generateSearchTableScript() {
    return """
    <script>
    var searchTimeout;

    function delayedSearch() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(searchTable, 300);  // Adjust the delay as needed
    }

    function searchTable() {
        var input = document.getElementById('search-bar');
        var filter = input.value.toLowerCase();
        var table = document.getElementById('data-table');
        var rows = table.getElementsByTagName('tr');

        // Function to recursively search in nested tables
        function searchInNestedTable(nestedTable) {
            var nestedRows = nestedTable.getElementsByTagName('tr');
            for (var k = 0; k < nestedRows.length; k++) {
                var nestedCells = nestedRows[k].getElementsByTagName('td');
                var nestedRowContainsFilter = false;
                for (var l = 0; l < nestedCells.length; l++) {
                    if (nestedCells[l] && nestedCells[l].innerText.toLowerCase().indexOf(filter) > -1) {
                        nestedRowContainsFilter = true;
                        break;
                    }
                }
                nestedRows[k].style.display = nestedRowContainsFilter ? '' : 'none';
            }
        }

        for (var i = 1; i < rows.length; i++) { // Start from 1 to skip the header row
            var cells = rows[i].getElementsByTagName('td');
            var rowContainsFilter = false;
            for (var j = 0; j < cells.length; j++) {
                if (cells[j] && cells[j].innerText.toLowerCase().indexOf(filter) > -1) {
                    rowContainsFilter = true;
                    break;
                }
            }
            rows[i].style.display = rowContainsFilter ? '' : 'none';

            // Check nested tables
            var nestedTables = rows[i].getElementsByClassName('nested-table');
            for (var m = 0; m < nestedTables.length; m++) {
                searchInNestedTable(nestedTables[m]);
            }
        }
    }
    </script>
    """
}

String generateHighlightRowScript() {
    return """
    <script>
    function highlightRow(row) {
        // Check if the row belongs to the main table
        var table = row.closest('table');
        if (table && table.id === 'data-table') {
            var highlighted = document.querySelectorAll('#data-table .highlighted');
            highlighted.forEach(function(item) {
                item.classList.remove('highlighted');
            });
            row.classList.add('highlighted');
        }
    }
    </script>
    """
}

String generateSortColumnScript() {
    return """
    <script>
    function sortColumn(index) {
        try {
            var table = document.getElementById('data-table');
            if (!table) {
                alert('Table not found!');
                return;
            }
            var rows = Array.from(table.rows).slice(1); // Skip the header row
            var header = table.querySelector('th[data-column-index="' + index + '"]');
            var sortDir = header.getAttribute('data-sort-dir') === 'asc' ? 'desc' : 'asc';
            header.setAttribute('data-sort-dir', sortDir);

            rows.sort(function(rowA, rowB) {
                var cellA = rowA.cells[index].innerText;
                var cellB = rowB.cells[index].innerText;

                if (!isNaN(cellA) && !isNaN(cellB)) {
                    cellA = parseFloat(cellA);
                    cellB = parseFloat(cellB);
                }

                if (sortDir === 'asc') {
                    return cellA > cellB ? 1 : -1;
                } else {
                    return cellA < cellB ? 1 : -1;
                }
            });

            rows.forEach(function(row, i) {
                row.cells[0].innerText = i + 1;  // Rewrite row numbers
                table.appendChild(row);
            });
        } catch (error) {
            alert('Error: ' + error.message);
        }
    }
    </script>
    """
}


String generateSelectDeselectAllColumnsScript() {
    return """
    <script>
    function selectAllColumns() {
        var checkboxes = document.querySelectorAll('#column-overlay input[type="checkbox"]');
        checkboxes.forEach(function(checkbox) {
            checkbox.checked = true;
            var colIndex = checkbox.id.replace('checkbox-', '');
            toggleColumnVisibility('data-table', colIndex, checkbox);
        });
    }

    function deselectAllColumns() {
        var checkboxes = document.querySelectorAll('#column-overlay input[type="checkbox"]');
        checkboxes.forEach(function(checkbox) {
            checkbox.checked = false;
            var colIndex = checkbox.id.replace('checkbox-', '');
            toggleColumnVisibility('data-table', colIndex, checkbox);
        });
    }
    </script>
    """
}

String generateToggleEditModeScript() {
    return """
    <script>
    function toggleEditMode() {
        var editModeButton = document.getElementById('edit-mode');
        var promoteLinks = document.querySelectorAll('.promote-link');
        var inEditMode = editModeButton.getAttribute('data-edit-mode') === 'true';

        promoteLinks.forEach(function(link) {
            link.style.display = inEditMode ? 'none' : 'inline';
        });

        editModeButton.setAttribute('data-edit-mode', !inEditMode);
        editModeButton.style.backgroundColor = !inEditMode ? 'red' : '#007BFF';
    }
    </script>
    """
}



String generatePromoteFieldScript() {

    return """
    <script>
    var promotedFields = [];

    /**
     * Extract a value from a JSON object using a dot-notation path
     * Handles nested objects, arrays, and edge cases
     * 
     * @param {Object|Array} obj - The JSON object or array to extract from
     * @param {String} path - Dot notation path (e.g. "person.address.city" or "items.0.name")
     * @return {*} The extracted value or undefined if not found
     */
    function getValueFromJsonPath(obj, path) {
        // Handle empty inputs
        if (obj === null || obj === undefined || !path) {
            return undefined;
        }
        
        // Handle string JSON that needs parsing
        let data = obj;
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.log('Failed to parse JSON string:', e);
                return undefined;
            }
        }
        
        // Split the path into parts and process
        const parts = path.split('.');
        let current = data;
        
        // Process each path segment
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            
            // Return undefined if we hit a dead end
            if (current === null || current === undefined) {
                return undefined;
            }
            
            // Handle array indexing
            if (Array.isArray(current)) {
                // Handle numeric indices
                if (!isNaN(part)) {
                    const index = parseInt(part, 10);
                    if (index >= 0 && index < current.length) {
                        current = current[index];
                        continue;
                    }
                } 
                
                // If not a valid index, search for objects with the key
                // This supports paths like "items.name" to get all names from items array
                if (i === parts.length - 1) {
                    // If this is the last part and we're in an array, try to collect all values
                    const values = current
                        .filter(item => item && typeof item === 'object')
                        .map(item => item[part])
                        .filter(val => val !== undefined);
                    
                    return values.length > 0 ? values : undefined;
                } else {
                    // If not the last part, try to find first match and continue
                    const matchingItem = current.find(item => 
                        item && typeof item === 'object' && part in item
                    );
                    
                    if (matchingItem) {
                        current = matchingItem[part];
                    } else {
                        return undefined;
                    }
                }
            } 
            // Handle object properties
            else if (typeof current === 'object') {
                if (part in current) {
                    current = current[part];
                } else {
                    return undefined;
                }
            } else {
                // We've hit a primitive value but still have path segments
                return undefined;
            }
        }
        
        return current;
    }

    function promoteField(jsonPath, fieldName) {
        if (!promotedFields.includes(jsonPath)) {
            promotedFields.push(jsonPath);
            updateMainTable();
        }
    }

    function updateMainTable() {
    var table = document.getElementById('data-table');
    var headerRow = table.rows[0];

    // Track existing column headers by name
    let existingHeaders = Array.from(headerRow.cells).map(cell => cell.innerText);

    promotedFields.forEach(function(jsonPath) {
        var parts = jsonPath.split('.');
        var column = parts[1];  // e.g., "profile"
        var fieldName = parts[parts.length - 1]; // e.g., "email"
        var innerPath = parts.slice(2).join('.'); // e.g., "user.details.contact.email"

        // Skip if column already exists
        if (!existingHeaders.includes(fieldName)) {
            var jsonColumnIndex = Array.from(headerRow.cells).findIndex(cell => cell.innerText === column);
    var insertAt = jsonColumnIndex + 1;

    // Create header <th>
    var th = document.createElement('th');
    th.innerText = fieldName;
    var jsonPathDiv = document.createElement('div');
    jsonPathDiv.className = 'json-path';
    jsonPathDiv.innerText = jsonPath;
    th.appendChild(jsonPathDiv);
    th.setAttribute('data-column-index', insertAt);
    th.setAttribute('data-sort-dir', 'desc');
    th.onclick = function() { sortColumn(insertAt); };
    headerRow.insertBefore(th, headerRow.cells[insertAt]);

            // For each data row
            for (var i = 1; i < table.rows.length; i++) {
                var row = table.rows[i];
                var rowData = JSON.parse(row.getAttribute('data-row'));
                var value = rowData[column];

                // If value is stringified JSON, parse it
                if (value && typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
                    try {
                        value = JSON.parse(value);
                    } catch (e) {
                        console.warn("Failed to parse nested JSON:", e);
                    }
                }

                value = getValueFromJsonPath(value, innerPath);

                var td = document.createElement('td');
    td.innerText = value !== undefined && value !== null ? value : 'undefined';
    td.setAttribute('data-column-index', insertAt);
    row.insertBefore(td, row.cells[insertAt]);
            }
        }
    });

    // Clear promoted fields after applying
    promotedFields = [];
}

    </script>
    """
}


// Function to generate the top menu with buttons and search bar
String generateTopMenu() {
    return """
    <div class='top-menu'>
        <button onclick='toggleAllNested(true)'>[+] Expand All</button>
        <button onclick='toggleAllNested(false)'>[-] Collapse All</button>
        <button onclick='showColumnOverlay()'>Choose Columns</button>
        <button onclick='showAllColumns()'>Show All</button>
        <button onclick='toggleJSONPaths()'>Show JSON Paths</button>
        <button id='edit-mode' data-edit-mode='false' onclick='toggleEditMode()'>Edit Mode</button>
        <input type='text' id='search-bar' oninput='delayedSearch()' placeholder='Search...'>
    </div>
    """
}

// Function to generate the column overlay for choosing columns
String generateColumnOverlay(def columns, String tableId) {
    def html = new StringBuilder()

    html.append("<div id='column-overlay' class='overlay' onclick='hideColumnOverlay()'>")
    html.append("<div class='overlay-content' onclick='event.stopPropagation()'>")
    html.append("<h3>Choose Columns</h3>")
    html.append("<button onclick='selectAllColumns()'>Select All</button>")
    html.append("<button onclick='deselectAllColumns()'>Deselect All</button>")
    html.append("<div>")
    html.append("<input type='checkbox' id='checkbox-0' checked onclick='toggleColumnVisibility(\"").append(tableId).append("\", 0, this)'> ")
    html.append("<label for='checkbox-0'>#</label></div>")
    columns.eachWithIndex { col, index ->
        def columnName = col.name()
        html.append("<div>")
        html.append("<input type='checkbox' id='checkbox-").append(index + 1).append("' ")
        html.append("checked onclick='toggleColumnVisibility(\"").append(tableId).append("\", ").append(index + 1).append(", this)'> ")
        html.append("<label for='checkbox-").append(index + 1).append("'>").append(columnName).append("</label></div>")
    }
    html.append("<button onclick='hideColumnOverlay()'>Close</button>")
    html.append("</div></div>")

    return html.toString()
}

// Function to collect all headers, including nested ones
Set collectHeaders(def columns) {
    def headers = new LinkedHashSet()

    def collectHeadersHelper = { def json, Set collectedHeaders, String prefix ->
        if (json instanceof Map) {
            json.each { key, value ->
                String header = prefix.isEmpty() ? key : prefix + "." + key
                collectedHeaders.add(header)
                collectHeadersHelper(value, collectedHeaders, header)
            }
        } else if (json instanceof List) {
            json.each { item ->
                collectHeadersHelper(item, collectedHeaders, prefix)
            }
        }
    }

    ROWS.each { row ->
        columns.each { col ->
            collectHeadersHelper(row.value(col), headers, col.name())
        }
    }
    return headers
}

// Function to convert JSON to HTML table
String convertToHTMLTable(def data, String tableId, String currentPath) {
    if (data instanceof Map) {
        return convertMapToHTMLTable(data, tableId, currentPath)
    } else if (data instanceof List) {
        if (!data.isEmpty() && data[0] instanceof Map) {
            return convertListOfMapsToTable(data, tableId, currentPath)
        } else {
            return convertListToHTMLTable(data, tableId, currentPath)
        }
    } else {
        return escapeXmlEntities(data?.toString() ?: "null")
    }
}


// Function to convert List to HTML table with hidden JSON path divs and promotion links
String convertListToHTMLTable(List list, String tableId, String parentPath) {
    def html = new StringBuilder()
    html.append("<table id='").append(tableId).append("' class='nested-table'><thead><tr>")
    def headers = new LinkedHashSet()

    // Collect all unique headers from the list of maps
    if (headers.isEmpty()) {
        // If it's a list of primitives, show Index + Value
        def primitiveHtml = new StringBuilder()
        primitiveHtml.append("<table id='").append(tableId).append("' class='nested-table'><thead><tr><th>Index</th><th>Value</th></tr></thead><tbody>")
        list.eachWithIndex { item, index ->
            primitiveHtml.append("<tr><td>").append(index).append("</td><td>").append(item?.toString() ?: 'null').append("</td></tr>")
        }
        primitiveHtml.append("</tbody></table>")
        return primitiveHtml.toString()
    }

    list.each { item ->
        if (item instanceof Map) {
            headers.addAll(item.keySet())
        }
    }

    // Add headers to the table with JSON paths and promotion links
    headers.each { header ->
        def headerPath = parentPath + "." + header
        html.append("<th title='Path: ${headerPath}'>").append(header)
        html.append("<div class='json-path'>").append(headerPath).append("</div>")
        if (!(value instanceof Map) && !(value instanceof List)) {
            html.append(" <a href='#' class='promote-link' title='Promote field' style='display:none; color:#007BFF; font-weight:bold; text-decoration:none;' onclick='promoteField(\"${headerPath}\", \"${header}\")'>+</a></th>")
        }
    }
    html.append("</tr></thead><tbody>")

    // Iterate over each item in the list
    list.eachWithIndex { item, index ->
        def documentPath = parentPath + "[" + index + "]"
        html.append("<tr>")

        // Iterate over each header for the current item
        headers.each { header ->
            def value = item[header]
            def nestedPath = documentPath + "." + header

            // Add the value cell
            html.append("<td>")
            if (value instanceof Map || value instanceof List) {
                // If the value is a nested structure, add an expand/collapse control
                def nestedTableId = tableId + "-" + index + "-" + header
                html.append("<span class='expand-collapse' id='icon-").append(nestedTableId).append("' onclick='toggleNested(\"").append(nestedTableId).append("\")'>[+]</span>")
                html.append(" ").append(header).append(" {}")
                html.append("<div style='display:none' id='").append(nestedTableId).append("'>")
                html.append(convertToHTMLTable(value, nestedTableId, nestedPath))
                html.append("</div>")
            } else if (value == null || value.toString().isEmpty()) {
                // If the value is null or empty, add a placeholder
                html.append("<span class='empty'>null</span>")
            } else {
                // Otherwise, add the value itself
                html.append(value.toString())
            }
            html.append("</td>")
        }
        html.append("</tr>")
    }
    html.append("</tbody></table>")
    return html.toString()
}

// Function to convert Map to HTML table with hidden JSON path divs and promotion links
String convertMapToHTMLTable(Map map, String tableId, String parentPath) {
    def html = new StringBuilder()
    html.append("<table id='").append(tableId).append("' class='nested-table'><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>")
    map.each { key, value ->
        def documentPath = parentPath + "." + key
        html.append("<tr><td class='key' title='Path: ${documentPath}'>").append(key)
        html.append("<div class='json-path'>").append(documentPath).append("</div>")
        if (!(value instanceof Map) && !(value instanceof List)) {
            html.append(" <a href='#' class='promote-link' title='Promote field' style='display:none; color:#007BFF; font-weight:bold; text-decoration:none;' onclick='promoteField(\"${documentPath}\", \"${key}\")'>+</a></td>")
        }
        html.append("<td>")
        if (value instanceof Map || value instanceof List) {
            def nestedTableId = tableId + "-" + key
            html.append("<span class='expand-collapse' id='icon-").append(nestedTableId).append("' onclick='toggleNested(\"").append(nestedTableId).append("\")'>[+]</span>")
            html.append(" ").append(key).append(" {}")
            html.append("<div style='display:none' id='").append(nestedTableId).append("'>")
            html.append(convertToHTMLTable(value, nestedTableId, documentPath))
            html.append("</div>")
        } else if (value == null || value.toString().isEmpty()) {
            html.append("<span class='empty'>null</span>")
        } else {
            html.append(value.toString())
        }
        html.append("</td></tr>")
    }
    html.append("</tbody></table>")
    return html.toString()
}

String convertListOfMapsToTable(List<Map> list, String tableId, String path) {
    def headers = list.collectMany { it.keySet() }.unique()
    def sb = new StringBuilder()
    sb.append("<table id='${tableId}' class='nested-table'><thead><tr><th>Index</th>")
    headers.each { key ->
        sb.append("<th>${escapeXmlEntities(key.toString())}</th>")
    }
    sb.append("</tr></thead><tbody>")
    list.eachWithIndex { item, index ->
        sb.append("<tr><td>${index}</td>")
        headers.each { key ->
            def val = item[key]
            def nestedPath = path + "[" + index + "]." + key
            def cell = (val instanceof Map || val instanceof List)
                ? convertToHTMLTable(val, "${tableId}-${index}-${key}", nestedPath)
                : escapeXmlEntities(val?.toString() ?: "null")
            sb.append("<td>${cell}</td>")
        }
        sb.append("</tr>")
    }
    sb.append("</tbody></table>")
    return sb.toString()
}

