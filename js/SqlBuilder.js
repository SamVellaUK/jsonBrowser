import { splitJsonPath, parsePathSegment } from "./Utils.js";
import { state } from './main.js';

export function buildPostgresSql(tableName) {
  const cols = state.columnState.order.map(path => {
    if (!path.includes('.') && !path.includes('[')) {
      return `"${path}"`;
    }
    
    const parts = splitJsonPath(path);
    const root = parts[0];
    
    // Check if this path contains any filters
    const hasFilter = parts.some(seg => parsePathSegment(seg).type === 'filter');
    
    if (!hasFilter) {
      // Simple nested path - use arrow operators
      let expr = `"${root}"`;
      
      parts.slice(1).forEach((seg, idx) => {
        const parsed = parsePathSegment(seg);
        const isLast = idx === parts.length - 2;
        
        if (parsed.type === 'index') {
          expr += isLast ? `->>${parsed.value}` : `->${parsed.value}`;
        } else {
          expr += isLast ? `->>'${parsed.value}'` : `->'${parsed.value}'`;
        }
      });
      
      const alias = path.replace(/[\.\[\]]+/g, '_');
      return `${expr} AS "${alias}"`;
    } else {
      // Path contains filters - use jsonb_path_query_first
      return buildFilteredPath(path, root, parts);
    }
  });
  
  return `SELECT\n  ${cols.join(',\n  ')}\nFROM ${tableName};`;
}

function buildFilteredPath(fullPath, root, parts) {
  let arrayPath = `"${root}"`;
  let jsonPath = '$';
  let hasProcessedFilter = false;
  
  // Build the path to the array and the JSONPath expression
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    const parsed = parsePathSegment(seg);
    
    if (parsed.type === 'filter' && !hasProcessedFilter) {
      // This is the first filter - build the JSONPath filter expression
      jsonPath += `[*] ? (@.${parsed.field} == "${parsed.value}")`;
      hasProcessedFilter = true;
      
      // If there are more segments after the filter, add them to the JSONPath
      if (i < parts.length - 1) {
        const remainingParts = parts.slice(i + 1);
        remainingParts.forEach(remainingSeg => {
          const remainingParsed = parsePathSegment(remainingSeg);
          if (remainingParsed.type === 'key') {
            jsonPath += `.${remainingParsed.value}`;
          } else if (remainingParsed.type === 'index') {
            jsonPath += `[${remainingParsed.value}]`;
          }
        });
      }
      break;
    } else if (parsed.type === 'key') {
      arrayPath += `->'${parsed.value}'`;
      if (!hasProcessedFilter) {
        jsonPath += `.${parsed.value}`;
      }
    } else if (parsed.type === 'index') {
      arrayPath += `->${parsed.value}`;
      if (!hasProcessedFilter) {
        jsonPath += `[${parsed.value}]`;
      }
    }
  }
  
  const alias = fullPath.replace(/[\.\[\]]+/g, '_').replace(/[=]/g, '_eq_');
  
  // Use subquery with jsonb_array_elements for compatibility
  const expr = `(SELECT jsonb_path_query(${arrayPath}, '${jsonPath}')::text LIMIT 1)`;
  
  return `${expr} AS "${alias}"`;
}

// Alternative approach using subqueries for even cleaner SQL
export function buildPostgresSqlWithSubqueries(tableName) {
  const cols = state.columnState.order.map(path => {
    if (!path.includes('.') && !path.includes('[')) {
      return `"${path}"`;
    }
    
    const parts = splitJsonPath(path);
    const root = parts[0];
    
    // Check if this path contains any filters
    const filterSegments = parts.filter(seg => parsePathSegment(seg).type === 'filter');
    
    if (filterSegments.length === 0) {
      // Simple nested path
      let expr = `"${root}"`;
      parts.slice(1).forEach((seg, idx) => {
        const parsed = parsePathSegment(seg);
        const isLast = idx === parts.length - 2;
        
        if (parsed.type === 'index') {
          expr += isLast ? `->>${parsed.value}` : `->${parsed.value}`;
        } else {
          expr += isLast ? `->>'${parsed.value}'` : `->'${parsed.value}'`;
        }
      });
      
      const alias = path.replace(/[\.\[\]]+/g, '_');
      return `${expr} AS "${alias}"`;
    } else {
      // Use subquery approach for filters
      return buildSubqueryPath(path, root, parts);
    }
  });
  
  return `SELECT\n  ${cols.join(',\n  ')}\nFROM ${tableName};`;
}

function buildSubqueryPath(fullPath, root, parts) {
  let arrayPath = `"${root}"`;
  let filterField = null;
  let filterValue = null;
  let finalField = null;
  
  // Parse the path to identify array path, filter, and final field
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    const parsed = parsePathSegment(seg);
    
    if (parsed.type === 'filter') {
      filterField = parsed.field;
      filterValue = parsed.value;
      
      // If there's a segment after the filter, it's the final field we want
      if (i < parts.length - 1) {
        const nextSeg = parts[i + 1];
        const nextParsed = parsePathSegment(nextSeg);
        if (nextParsed.type === 'key') {
          finalField = nextParsed.value;
        }
      }
      break;
    } else if (parsed.type === 'key') {
      arrayPath += `->'${parsed.value}'`;
    } else if (parsed.type === 'index') {
      arrayPath += `->${parsed.value}`;
    }
  }
  
  const alias = fullPath.replace(/[\.\[\]]+/g, '_').replace(/[=]/g, '_eq_');
  
  if (filterField && filterValue) {
    // Use jsonb_array_elements subquery for maximum compatibility
    const subquery = finalField
      ? `(SELECT elem->>'${finalField}' FROM jsonb_array_elements(${arrayPath}) AS elem WHERE elem->>'${filterField}' = '${filterValue}' LIMIT 1)`
      : `(SELECT elem::text FROM jsonb_array_elements(${arrayPath}) AS elem WHERE elem->>'${filterField}' = '${filterValue}' LIMIT 1)`;
    
    return `${subquery} AS "${alias}"`;
  }
  
  return `NULL AS "${alias}"`;
}

export function buildSnowflakeSql(tableName) {
  const cols = state.columnState.order.map(path => {
    if (!path.includes('.') && !path.includes('[')) {
      return `e."${path}"`;
    }
    
    const parts = splitJsonPath(path);
    const root = parts[0];
    
    // Check if this path contains any filters
    const hasFilters = parts.some(seg => parsePathSegment(seg).type === 'filter');
    
    if (!hasFilters) {
      // Simple path - use traditional colon notation
      let expr = `e."${root}"`;
      parts.slice(1).forEach(seg => {
        const parsed = parsePathSegment(seg);
        if (parsed.type === 'index') {
          expr += `[${parsed.value}]`;
        } else {
          expr += `:"${parsed.value}"`;
        }
      });
      expr += '::STRING';
      
      const alias = path.replace(/[\.\[\]]+/g, '_');
      return `${expr} AS "${alias}"`;
    } else {
      // For filter paths, we'll handle these in the FROM clause
      // Just return a placeholder for now
      const alias = path.replace(/[\.\[\]]+/g, '_').replace(/[=]/g, '_eq_');
      return `-- ${alias} handled via LATERAL FLATTEN`;
    }
  });
  
  // Build the FROM clause with LATERAL FLATTEN for filtered paths
  const filterPaths = state.columnState.order.filter(path => {
    const parts = splitJsonPath(path);
    return parts.some(seg => parsePathSegment(seg).type === 'filter');
  });
  
  let fromClause = `FROM ${tableName} AS e`;
  const whereConditions = [];
  const selectCols = [];
  
  // Add regular columns to select
  state.columnState.order.forEach(path => {
    const parts = splitJsonPath(path);
    const hasFilters = parts.some(seg => parsePathSegment(seg).type === 'filter');
    
    if (!hasFilters) {
      // Regular column - already handled above
      if (!path.includes('.') && !path.includes('[')) {
        selectCols.push(`e."${path}"`);
      } else {
        let expr = `e."${parts[0]}"`;
        parts.slice(1).forEach(seg => {
          const parsed = parsePathSegment(seg);
          if (parsed.type === 'index') {
            expr += `[${parsed.value}]`;
          } else {
            expr += `:"${parsed.value}"`;
          }
        });
        expr += '::STRING';
        const alias = path.replace(/[\.\[\]]+/g, '_');
        selectCols.push(`${expr} AS "${alias}"`);
      }
    }
  });
  
  // Handle filtered paths
  filterPaths.forEach((path, idx) => {
    const parts = splitJsonPath(path);
    const root = parts[0];
    let arrayPath = `e."${root}"`;
    let filterField = null;
    let filterValue = null;
    let finalField = null;
    
    // Build the path to the array and identify filter conditions
    parts.slice(1).forEach(seg => {
      const parsed = parsePathSegment(seg);
      if (parsed.type === 'filter') {
        filterField = parsed.field;
        filterValue = parsed.value;
      } else if (parsed.type === 'index') {
        arrayPath += `[${parsed.value}]`;
      } else {
        if (filterField) {
          // This is the field we want after filtering
          finalField = parsed.value;
        } else {
          arrayPath += `:"${parsed.value}"`;
        }
      }
    });
    
    if (filterField && filterValue) {
      const flattenAlias = `f${idx}`;
      fromClause += `\n  , LATERAL FLATTEN(input => ${arrayPath}) AS ${flattenAlias}`;
      whereConditions.push(`${flattenAlias}.value:"${filterField}"::STRING = '${filterValue}'`);
      
      if (finalField) {
        const alias = path.replace(/[\.\[\]]+/g, '_').replace(/[=]/g, '_eq_');
        selectCols.push(`${flattenAlias}.value:"${finalField}"::STRING AS "${alias}"`);
      } else {
        const alias = path.replace(/[\.\[\]]+/g, '_').replace(/[=]/g, '_eq_');
        selectCols.push(`${flattenAlias}.value::STRING AS "${alias}"`);
      }
    }
  });
  
  let sql = `SELECT\n  ${selectCols.join(',\n  ')}\n${fromClause}`;
  
  if (whereConditions.length > 0) {
    sql += `\nWHERE ${whereConditions.join('\n  AND ')}`;
  }
  
  return sql + ';';
}

export function buildSqlServerSql(tableName) {
  const cols = state.columnState.order.map(path => {
    if (!/[.\[]/.test(path)) {
      return `[${path}]`;
    }
    
    const parts = splitJsonPath(path);
    const root = parts.shift();
    const jsonPath = '$.' + parts.map(seg => {
      const parsed = parsePathSegment(seg);
      if (parsed.type === 'index') {
        return `[${parsed.value}]`;
      } else if (parsed.type === 'filter') {
        // SQL Server JSON_VALUE doesn't support filtering directly
        return `[0]`; // Simplified
      } else {
        return `.${parsed.value}`;
      }
    }).join('');
    
    const alias = path.replace(/[\.\[\]]+/g, '_');
    return `JSON_VALUE([${root}], '${jsonPath}') AS [${alias}]`;
  });

  return [
    `SELECT`,
    `  ${cols.join(',\n  ')}`,
    `FROM [${tableName}];`
  ].join('\n');
}

export function buildOracleSql(tableName) {
  const cols = state.columnState.order.map(path => {
    if (!/[.\[]/.test(path)) {
      return `"${path}"`;
    }
    
    const parts = splitJsonPath(path);
    const root = parts.shift();
    const jsonPath = '$.' + parts.map(seg => {
      const parsed = parsePathSegment(seg);
      if (parsed.type === 'index') {
        return `[${parsed.value}]`;
      } else if (parsed.type === 'filter') {
        // Oracle JSON_VALUE doesn't support filtering directly
        return `[0]`; // Simplified
      } else {
        return `.${parsed.value}`;
      }
    }).join('');
    
    const alias = path.replace(/[\.\[\]]+/g,'_');
    return `JSON_VALUE("${root}", '${jsonPath}') AS "${alias}"`;
  });

  return [
    `SELECT`,
    `  ${cols.join(',\n  ')}`,
    `FROM "${tableName}";`
  ].join('\n');
}