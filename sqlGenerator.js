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
        // If forFlattenInput, return as is (expecting JSONB input for functions like jsonb_array_elements,
        // actual cast to jsonb will be handled at call site if root is json).
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

        const needsParsing = pathWithinRoot || forFlattenInput;

        if (needsParsing) {
            sfAccessBase = `parse_json(${pathPrefix}"${rootDbColumnName}"::variant)`;
        }

        if (!pathWithinRoot) {
            return sfAccessBase;
        }

        let sfPath = sfAccessBase;
        const pathParts = pathWithinRoot.replace(/\[(\d+)\]/g, '[$1]').split('.');
        pathParts.forEach(part => {
            if (part.startsWith('[') && part.endsWith(']')) { // Array index
                sfPath += part;
            } else { // Object key
                sfPath += `:${part.replace(/:/g, "\\:")}`;
            }
        });
        return forFlattenInput ? sfPath : `${sfPath}::VARCHAR`;
    }
    // Fallback for unsupported dialect
    return `"${fullItemPath}"`;
};

const buildPathWithinElement = (elementBase, valuePathWithin, dbDialect) => {
    // elementBase is like 'f0.value' (Snowflake) or 'flat_alias.element_value' (PostgreSQL)
    // This element is already a JSON object/variant, so no initial parse_json needed here.

    if (dbDialect === 'postgresql') {
        let pgPath = elementBase; // This will be jsonb if coming from jsonb_array_elements
        if (!valuePathWithin) return `${pgPath}::text`; // Cast jsonb to text

        const segments = valuePathWithin.replace(/\[(\d+)\]/g, '.$1').split('.');
        segments.forEach((seg, idx) => {
            pgPath += (idx === segments.length - 1 ? '->>' : '->'); // -> on jsonb returns jsonb, ->> returns text
            if (seg.match(/^\d+$/)) pgPath += seg;
            else pgPath += `'${sqlEscapeString(seg)}'`;
        });
        return pgPath;
    } else if (dbDialect === 'snowflake') {
        let sfPath = elementBase; // e.g., f0.value which is a VARIANT
        if (!valuePathWithin) return `${sfPath}::VARCHAR`;

        const pathParts = valuePathWithin.replace(/\[(\d+)\]/g, '[$1]').split('.');
        pathParts.forEach(part => {
            if (part.startsWith('[') && part.endsWith(']')) {
                sfPath += part;
            } else {
                sfPath += `:${part.replace(/:/g, "\\:")}`;
            }
        });
        return `${sfPath}::VARCHAR`;
    }
    // Fallback
    return `${elementBase}${valuePathWithin ? '.' + valuePathWithin : ''}`;
};

export const generateSQL = (visibleColumns, dialect = 'snowflake') => {
    try {
        const tableName = 'json_data'; // Note: Your example query uses 'cloudtrail_logs'. This might need to be configurable.
        const columns = visibleColumns;

        if (!columns || columns.length === 0) {
            return '-- No columns selected';
        }

        const mainTableAlias = "e";
        let fromParts = [`"${tableName}" AS "${mainTableAlias}"`]; // Adjust if your table name is different
        let selectExpressions = [];
        let whereConditions = [];
        let flattenCounter = 0;

        columns.forEach(col => {
            const uiColumnAlias = col.replace(/[.\[\]=:"']/g, '_');
            const rootDbColumnName = col.split(/[.\[]/)[0];
            const complexPathRegex = /^(.+?)\[([^=\]]+)="([^"]+)"\](?:\.(.+))?$/;
            const complexMatch = col.match(complexPathRegex);

            if (complexMatch) { // Path like "array_col[key="val"].field"
                const flattenAlias = `f${flattenCounter++}`;
                const fullPathToArray = complexMatch[1];
                const keyFieldInArrayElement = complexMatch[2];
                const keyValueInArrayElement = complexMatch[3].replace(/\\"/g, '"');
                const valueFieldPathWithinElement = complexMatch[4];

                const rootForArrayPath = fullPathToArray.split(/[.\[]/)[0];

                if (dialect === 'postgresql') {
                    const pgPathToArrForFlatten = buildBaseAccessPath(fullPathToArray, rootForArrayPath, 'postgresql', mainTableAlias, true);
                    // MODIFICATION: Added ::jsonb cast to the input of jsonb_array_elements
                    fromParts.push(`, LATERAL jsonb_array_elements((${pgPathToArrForFlatten})::jsonb) AS ${flattenAlias}(element_value)`);
                    
                    const selectPath = buildPathWithinElement(`${flattenAlias}.element_value`, valueFieldPathWithinElement, 'postgresql');
                    selectExpressions.push(`${selectPath} AS "${uiColumnAlias}"`);
                    
                    // element_value is jsonb, ->> extracts text for comparison
                    whereConditions.push(`${flattenAlias}.element_value->>'${sqlEscapeString(keyFieldInArrayElement)}' = '${sqlEscapeString(keyValueInArrayElement)}'`);
                } else if (dialect === 'snowflake') {
                    const sfPathToArrForFlatten = buildBaseAccessPath(fullPathToArray, rootForArrayPath, 'snowflake', mainTableAlias, true);
                    fromParts.push(`, LATERAL FLATTEN(input => ${sfPathToArrForFlatten}) AS ${flattenAlias}`);

                    const selectPath = buildPathWithinElement(`${flattenAlias}.value`, valueFieldPathWithinElement, 'snowflake');
                    selectExpressions.push(`${selectPath} AS "${uiColumnAlias}"`);
                    
                    let keyAccessPath = `${flattenAlias}.value`; 
                    const keyFieldParts = keyFieldInArrayElement.replace(/\[(\d+)\]/g, '[$1]').split('.');
                     keyFieldParts.forEach(part => {
                        if (part.startsWith('[') && part.endsWith(']')) keyAccessPath += part;
                        else keyAccessPath += `:${part.replace(/:/g, "\\:")}`;
                    });
                    whereConditions.push(`${keyAccessPath}::VARCHAR = '${sqlEscapeString(keyValueInArrayElement)}'`);
                }
            } else { // Simple path like "id" or "user.name"
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