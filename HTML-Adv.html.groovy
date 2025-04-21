/**
 * ------------------------------------------------------------
 * DataGrip Data Extractor Script
 * ------------------------------------------------------------
 * File: HTML-Adv.html.groovy
 * Description: This script is designed to extract and process 
 *              data from DataGrip exports.
 * Author: [Your Name]
 * Created: [Date]
 * Version: 1.0
 * ------------------------------------------------------------
 * Usage:
 * - Customize the script as needed for your specific data 
 *   extraction requirements.
 * - Ensure all dependencies are properly configured.
 * ------------------------------------------------------------
 */

import static com.intellij.openapi.util.text.StringUtil.escapeStringCharacters as escapeStr

NEWLINE = System.getProperty("line.separator")
INDENT = "  "

// Recursive JSON serialization function
def printJSON(level, col, o) {
    switch (o) {
        case null: OUT.append("null"); break
        case Tuple: printJSON(level, o[0], o[1]); break
        case Map:
            OUT.append("{")
            o.entrySet().eachWithIndex { entry, i ->
                OUT.append("${i > 0 ? "," : ""}$NEWLINE${INDENT * (level + 1)}")
                OUT.append("\"${escapeStr(entry.getKey().toString())}\"")
                OUT.append(": ")
                printJSON(level + 1, col, entry.getValue())
            }
            OUT.append("$NEWLINE${INDENT * level}}")
            break
        case Object[]:
        case Iterable:
            OUT.append("[")
            def plain = true
            o.eachWithIndex { item, i ->
                plain = item == null || item instanceof Number || item instanceof Boolean || item instanceof String
                if (plain) {
                    OUT.append(i > 0 ? ", " : "")
                } else {
                    OUT.append("${i > 0 ? "," : ""}$NEWLINE${INDENT * (level + 1)}")
                }
                printJSON(level + 1, col, item)
            }
            if (plain) OUT.append("]") else OUT.append("$NEWLINE${INDENT * level}]")
            break
        case Boolean: OUT.append("$o"); break
        default:
            def str = FORMATTER.formatValue(o, col)
            def typeName = FORMATTER.getTypeName(o, col)
            def shouldQuote = FORMATTER.isStringLiteral(o, col) && !(typeName.equalsIgnoreCase("json") || typeName.equalsIgnoreCase("jsonb"))
            OUT.append(shouldQuote ? "\"${escapeStr(str)}\"" : str);
            break
    }
}

// Transform ROWS to JSON and embed it in the HTML
OUT.append("""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DataGrip JSON Viewer</title>
    <!-- Grid.js CSS -->
    <link href="https://cdn.jsdelivr.net/npm/gridjs/dist/theme/mermaid.min.css" rel="stylesheet">
</head>
<body>
    <!-- Content will be dynamically added here -->
    <div id="table-root"></div>
    
    <script>
        // Grid.js JavaScript
        const data = 
""")
printJSON(0, null, ROWS.transform { row ->
    def map = new LinkedHashMap<String, String>()
    COLUMNS.each { col ->
        if (row.hasValue(col)) {
            def val = row.value(col)
            map.put(col.name(), new Tuple(col, val))
        }
    }
    map
})
OUT.append(""";

        // Include Grid.js library
        const gridJsScript = document.createElement('script');
        gridJsScript.src = "https://cdn.jsdelivr.net/npm/gridjs/dist/gridjs.umd.js";
        gridJsScript.onload = () => {
            // Render the table using Grid.js
            new gridjs.Grid({
                columns: Object.keys(data[0] || {}),
                data: data.map(row => Object.values(row)),
                pagination: true,
                search: true,
                sort: true
            }).render(document.getElementById('table-root'));
        };
        document.head.appendChild(gridJsScript);
    </script>
</body>
</html>
""")