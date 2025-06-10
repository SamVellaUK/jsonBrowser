// --- START OF NEW FILE sqlGenerator.js ---

const sqlEscapeString = (str) => {
    if (str === null || str === undefined) return 'NULL';
    return str.replace(/'/g, "''");
};

const toSQLServerJsonPath = (path) => {
    if (!path) return '$';
    return '$.' + path;
};

const buildBaseAccessPath = (fullItemPath, rootDbColumnName, dbDialect, tableAlias = null, forFlattenInput = false) => {
    let pathPrefix = tableAlias ? `"${tableAlias}".` : '';
    let pathWithinRoot = fullItemPath.substring(rootDbColumnName.length);
    if (pathWithinRoot.startsWith('.')) {
        pathWithinRoot = pathWithinRoot.substring(1);
    }

    // If we are selecting a top-level column (no path inside it) for a standard SELECT,
    // just return the column name directly without any JSON functions.
    if (!pathWithinRoot && !forFlattenInput) {
        return `${pathPrefix}"${rootDbColumnName}"`;
    }

    if (dbDialect === 'postgresql') {
        let pgPath = `${pathPrefix}"${rootDbColumnName}"`;
        if (!pathWithinRoot) return forFlattenInput ? pgPath : `${pgPath}::text`;

        const segments = pathWithinRoot.replace(/\[(\d+)\]/g, '.$1').split('.');
        segments.forEach((seg, idx) => {
            const isLastSegment = idx === segments.length - 1;
            pgPath += (forFlattenInput || !isLastSegment) ? '->' : '->>';
            if (seg.match(/^\d+$/)) pgPath += seg;
            else pgPath += `'${sqlEscapeString(seg)}'`;
        });
        return pgPath;

    } else if (dbDialect === 'snowflake') {
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
            if (part.startsWith('[') && part.endsWith(']')) sfPath += part;
            else sfPath += `:${part.replace(/:/g, "\\:")}`;
        });
        return forFlattenInput ? sfPath : `${sfPath}::VARCHAR`;

    } else if (dbDialect === 'sqlserver') {
        const baseCol = `${pathPrefix}"${rootDbColumnName}"`;
        const sqlServerPath = toSQLServerJsonPath(pathWithinRoot);
        
        const func = forFlattenInput ? 'JSON_QUERY' : 'JSON_VALUE';
        return `${func}(${baseCol}, '${sqlServerPath}')`;
    }
    // Fallback for unsupported dialect
    return `"${fullItemPath}"`;
};

const buildPathWithinElement = (elementBase, valuePathWithin, dbDialect) => {
    if (dbDialect === 'postgresql') {
        let pgPath = elementBase;
        if (!valuePathWithin) return `${pgPath}::text`;

        const segments = valuePathWithin.replace(/\[(\d+)\]/g, '.$1').split('.');
        segments.forEach((seg, idx) => {
            pgPath += (idx === segments.length - 1 ? '->>' : '->');
            if (seg.match(/^\d+$/)) pgPath += seg;
            else pgPath += `'${sqlEscapeString(seg)}'`;
        });
        return pgPath;

    } else if (dbDialect === 'snowflake') {
        let sfPath = elementBase;
        if (!valuePathWithin) return `${sfPath}::VARCHAR`;

        const pathParts = valuePathWithin.replace(/\[(\d+)\]/g, '[$1]').split('.');
        pathParts.forEach(part => {
            if (part.startsWith('[') && part.endsWith(']')) sfPath += part;
            else sfPath += `:${part.replace(/:/g, "\\:")}`;
        });
        return `${sfPath}::VARCHAR`;

    } else if (dbDialect === 'sqlserver') {
        const sqlServerPath = toSQLServerJsonPath(valuePathWithin);
        return `JSON_VALUE(${elementBase}, '${sqlServerPath}')`;
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
                    fromParts.push(`, LATERAL jsonb_array_elements((${pgPathToArrForFlatten})::jsonb) AS ${flattenAlias}(element_value)`);
                    const selectPath = buildPathWithinElement(`${flattenAlias}.element_value`, valueFieldPathWithinElement, 'postgresql');
                    selectExpressions.push(`${selectPath} AS "${uiColumnAlias}"`);
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

                } else if (dialect === 'sqlserver') {
                    const ssPathToArrForFlatten = buildBaseAccessPath(fullPathToArray, rootForArrayPath, 'sqlserver', mainTableAlias, true);
                    fromParts.push(`CROSS APPLY OPENJSON(${ssPathToArrForFlatten}) AS ${flattenAlias}`);
                    
                    const selectPath = buildPathWithinElement(`${flattenAlias}.value`, valueFieldPathWithinElement, 'sqlserver');
                    selectExpressions.push(`${selectPath} AS "${uiColumnAlias}"`);

                    const keyPathForWhere = toSQLServerJsonPath(keyFieldInArrayElement);
                    whereConditions.push(`JSON_VALUE(${flattenAlias}.value, '${keyPathForWhere}') = '${sqlEscapeString(keyValueInArrayElement)}'`);
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