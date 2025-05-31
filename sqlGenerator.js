
const sqlEscapeString = (str) => {
    if (str === null || str === undefined) return 'NULL';
    return str.replace(/'/g, "''");
};

const buildBaseAccessPath = (fullItemPath, rootDbColumnName, dbDialect, tableAlias = null, forFlattenInput = false) => {
    let pathPrefix = tableAlias ? `"${tableAlias}".` : '';
    let pathWithinRoot = fullItemPath.substring(rootDbColumnName.length);
    if (pathWithinRoot.startsWith('.')) {
        pathWithinRoot = pathWithinRoot.substring(1);
    }

    if (dbDialect === 'postgresql') {
        let pgPath = `${pathPrefix}"${rootDbColumnName}"`;
        // If no pathWithinRoot, it means we are accessing the rootDbColumnName itself.
        // If forFlattenInput, return as is (expecting JSONB).
        // If for SELECT, cast to text.
        if (!pathWithinRoot) return forFlattenInput ? pgPath : `${pgPath}::text`;

        const segments = pathWithinRoot.replace(/\[(\d+)\]/g, '.$1').split('.');
        segments.forEach((seg, idx) => {
            const isLastSegment = idx === segments.length - 1;
            // For intermediate paths or for FLATTEN input, use '->'
            // For the final segment in a SELECT, use '->>' to get text
            pgPath += (forFlattenInput || !isLastSegment) ? '->' : '->>';
            if (seg.match(/^\d+$/)) pgPath += seg; // Array index
            else pgPath += `'${sqlEscapeString(seg)}'`; // Object key
        });
        return pgPath;
    } else if (dbDialect === 'snowflake') {
        // Base access string, defaults to direct column access
        let sfAccessBase = `${pathPrefix}"${rootDbColumnName}"`;

        // Determine if parsing is needed for the base column
        // Parsing is needed if:
        // 1. There's a path *within* the root (e.g., "data.user", pathWithinRoot is ".user")
        // 2. Or, if this column is being used as direct input to FLATTEN (forFlattenInput is true)
        const needsParsing = pathWithinRoot || forFlattenInput;

        if (needsParsing) {
            sfAccessBase = `parse_json(${pathPrefix}"${rootDbColumnName}"::variant)`;
        }

        // If there's no further path within the root column:
        if (!pathWithinRoot) {
            // If it was parsed (because forFlattenInput was true), return the parsed base.
            // Otherwise (it wasn't parsed, and not forFlattenInput), return the direct column access.
            // No ::VARCHAR here for direct column access, or for FLATTEN input.
            return sfAccessBase;
        }

        // If there IS a pathWithinRoot, append it to the (potentially parsed) base
        let sfPath = sfAccessBase;
        const pathParts = pathWithinRoot.replace(/\[(\d+)\]/g, '[$1]').split('.');
        pathParts.forEach(part => {
            if (part.startsWith('[') && part.endsWith(']')) { // Array index
                sfPath += part;
            } else { // Object key
                sfPath += `:${part.replace(/:/g, "\\:")}`;
            }
        });

        // If this path is for FLATTEN input, don't cast to VARCHAR yet.
        // Otherwise (for SELECT), cast the final extracted value to VARCHAR.
        return forFlattenInput ? sfPath : `${sfPath}::VARCHAR`;
    }
    // Fallback for unsupported dialect
    return `"${fullItemPath}"`;
};

const buildPathWithinElement = (elementBase, valuePathWithin, dbDialect) => {
    // elementBase is like 'f0.value' (Snowflake) or 'flat_alias.element_value' (PostgreSQL)
    // This element is already a JSON object/variant, so no initial parse_json needed here.

    if (dbDialect === 'postgresql') {
        let pgPath = elementBase;
        // If valuePathWithin is empty/null, we want the element itself, cast to text.
        if (!valuePathWithin) return `${pgPath}::text`;

        const segments = valuePathWithin.replace(/\[(\d+)\]/g, '.$1').split('.');
        segments.forEach((seg, idx) => {
            pgPath += (idx === segments.length - 1 ? '->>' : '->');
            if (seg.match(/^\d+$/)) pgPath += seg;
            else pgPath += `'${sqlEscapeString(seg)}'`;
        });
        return pgPath;
    } else if (dbDialect === 'snowflake') {
        let sfPath = elementBase; // e.g., f0.value which is a VARIANT
        // If valuePathWithin is empty/null, we want the element itself, cast to VARCHAR.
        if (!valuePathWithin) return `${sfPath}::VARCHAR`;

        const pathParts = valuePathWithin.replace(/\[(\d+)\]/g, '[$1]').split('.');
        pathParts.forEach(part => {
            if (part.startsWith('[') && part.endsWith(']')) {
                sfPath += part;
            } else {
                sfPath += `:${part.replace(/:/g, "\\:")}`;
            }
        });
        // Final value extracted from the element is cast to VARCHAR.
        return `${sfPath}::VARCHAR`;
    }
    // Fallback
    return `${elementBase}${valuePathWithin ? '.' + valuePathWithin : ''}`;
};

export const generateSQL = (visibleColumns, dialect = 'snowflake') => {
    try {
        const tableName = 'json_data';
        const columns = visibleColumns;

        if (!columns || columns.length === 0) {
            return '-- No columns selected';
        }

        const mainTableAlias = "e";
        let fromParts = [`"${tableName}" AS "${mainTableAlias}"`];
        let selectExpressions = [];
        let whereConditions = [];
        let flattenCounter = 0;

        columns.forEach(col => {
            const uiColumnAlias = col.replace(/[.\[\]=:"']/g, '_');
            // rootDbColumnName is the first part of the path, e.g., "data" from "data.user.id"
            const rootDbColumnName = col.split(/[.\[]/)[0];
            const complexPathRegex = /^(.+?)\[([^=\]]+)="([^"]+)"\](?:\.(.+))?$/;
            const complexMatch = col.match(complexPathRegex);

            if (complexMatch) { // Path like "array_col[key="val"].field"
                const flattenAlias = `f${flattenCounter++}`;
                const fullPathToArray = complexMatch[1]; // e.g., "data.items"
                const keyFieldInArrayElement = complexMatch[2]; // e.g., "id"
                const keyValueInArrayElement = complexMatch[3].replace(/\\"/g, '"'); // e.g., "123"
                const valueFieldPathWithinElement = complexMatch[4]; // e.g., "name", or undefined

                // The root column for the path leading *to the array* needs to be determined from fullPathToArray
                const rootForArrayPath = fullPathToArray.split(/[.\[]/)[0];

                if (dialect === 'postgresql') {
                    const pgPathToArrForFlatten = buildBaseAccessPath(fullPathToArray, rootForArrayPath, 'postgresql', mainTableAlias, true);
                    fromParts.push(`, LATERAL jsonb_array_elements(${pgPathToArrForFlatten}) AS ${flattenAlias}(element_value)`);
                    
                    const selectPath = buildPathWithinElement(`${flattenAlias}.element_value`, valueFieldPathWithinElement, 'postgresql');
                    selectExpressions.push(`${selectPath} AS "${uiColumnAlias}"`);
                    
                    // Key for WHERE condition is directly on the element_value
                    whereConditions.push(`${flattenAlias}.element_value->>'${sqlEscapeString(keyFieldInArrayElement)}' = '${sqlEscapeString(keyValueInArrayElement)}'`);
                } else if (dialect === 'snowflake') {
                    // For FLATTEN, input path (fullPathToArray) needs 'forFlattenInput = true'
                    const sfPathToArrForFlatten = buildBaseAccessPath(fullPathToArray, rootForArrayPath, 'snowflake', mainTableAlias, true);
                    fromParts.push(`, LATERAL FLATTEN(input => ${sfPathToArrForFlatten}) AS ${flattenAlias}`);

                    // selectPath is built from the flattened element ('flattenAlias.value')
                    const selectPath = buildPathWithinElement(`${flattenAlias}.value`, valueFieldPathWithinElement, 'snowflake');
                    selectExpressions.push(`${selectPath} AS "${uiColumnAlias}"`);
                    
                    // Accessing the key for WHERE condition from the flattened element
                    let keyAccessPath = `${flattenAlias}.value`; // Start with the element (VARIANT)
                    const keyFieldParts = keyFieldInArrayElement.replace(/\[(\d+)\]/g, '[$1]').split('.');
                     keyFieldParts.forEach(part => {
                        if (part.startsWith('[') && part.endsWith(']')) keyAccessPath += part;
                        else keyAccessPath += `:${part.replace(/:/g, "\\:")}`;
                    });
                    // Compare the key's value as VARCHAR
                    whereConditions.push(`${keyAccessPath}::VARCHAR = '${sqlEscapeString(keyValueInArrayElement)}'`);
                }
            } else { // Simple path like "id" or "user.name"
                // rootDbColumnName is correctly derived from 'col'
                // 'forFlattenInput' is false here as we are selecting a value, not providing input to FLATTEN.
                selectExpressions.push(`${buildBaseAccessPath(col, rootDbColumnName, dialect, mainTableAlias, false)} AS "${uiColumnAlias}"`);
            }
        });
        
        let sql = `SELECT\n  ${selectExpressions.join(',\n  ')}\nFROM ${fromParts.join('\n  ')}`;
        if (whereConditions.length > 0) {
            sql += `\nWHERE ${whereConditions.join('\n  AND ')};`;
        } else {
            sql += ';';
        }

        return sql;

    } catch (e) {
        console.error("Error generating SQL:", e);
        return `-- Error generating SQL: ${e.message}\n-- Stack: ${e.stack ? e.stack.split('\n').map(s => `-- ${s}`).join('\n') : ''}`;
    }
};
