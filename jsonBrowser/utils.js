
export const escapeStringForDataAttribute = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&') // Escape ampersands first
            .replace(/"/g, '"'); // Escape double quotes
};

export const flatten = (obj, prefix = '', result = []) => {
  if (!obj || typeof obj !== 'object') {
    if (prefix) result.push({ path: prefix, value: obj });
    return result;
  }
  
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const arrayPath = prefix ? `${prefix}[${index}]` : `[${index}]`;
      if (item && typeof item === 'object') {
        flatten(item, arrayPath, result);
      } else {
        result.push({ path: arrayPath, value: item });
      }
    });
  } else {
    Object.entries(obj).forEach(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object') {
        flatten(value, path, result);
      } else {
        result.push({ path, value });
      }
    });
  }
  
  return result;
};

export const getAllObjectPaths = (obj, currentPath = '', allPaths = []) => {
  if (obj && typeof obj === 'object') {
      if (currentPath) {
          allPaths.push(currentPath);
      }

      if (Array.isArray(obj)) {
          obj.forEach((item, index) => {
              const newPath = currentPath ? `${currentPath}[${index}]` : `[${index}]`;
              getAllObjectPaths(item, newPath, allPaths);
          });
      } else {
          for (const key in obj) {
              if (Object.prototype.hasOwnProperty.call(obj, key)) {
                  const newPath = currentPath ? `${currentPath}.${key}` : key;
                  getAllObjectPaths(obj[key], newPath, allPaths);
              }
          }
      }
  }
  return allPaths;
};

export const getValue = (obj, path) => {
  if (!obj || !path) return undefined;
  
  try {
      if (!path.includes('.') && !path.includes('[')) {
          return obj[path];
      }

      let processedPath = path.replace(/\[(\d+)\]/g, '.$1'); 
      const pathSegments = processedPath.split('.');
      
      let current = obj;
      const arraySelectorRegex = /^(\w+)\[(.+?)="([^"]*)"\]$/; 

      for (const segment of pathSegments) {
          if (current == null) return undefined;

          const selectorMatch = segment.match(arraySelectorRegex);
          
          if (selectorMatch) {
              const arrayNameInSegment = selectorMatch[1];
              const keyField = selectorMatch[2]; 
              const keyValue = selectorMatch[3].replace(/\\"/g, '"'); 
              
              const arrayItself = current[arrayNameInSegment];
              if (!Array.isArray(arrayItself)) return undefined; 
              
              const foundItem = arrayItself.find(item => item && typeof item === 'object' && String(item[keyField]) === keyValue);
              if (!foundItem) return undefined; 
              current = foundItem; 
          } else {
              current = current[segment];
          }
      }
      return current;
  } catch (e) {
      return undefined;
  }
};

export const highlightText = (text, query, isActive = false) => {
  if (text === null || text === undefined) text = '';
  if (!query) return String(text);
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return String(text).replace(regex, `<span class="highlight ${isActive ? 'current' : ''}">$1</span>`);
};

export const performSearch = (data, query) => {
    if (!query || String(query).trim() === '') return [];
    const results = [];
    const queryLower = String(query).toLowerCase();

    data.forEach((row, rowIndex) => {
        function searchItem(item, currentPath) {
            if (item === null || item === undefined) {
                return;
            }

            if (typeof item === 'object' && !Array.isArray(item)) {
                for (const key in item) {
                    if (Object.prototype.hasOwnProperty.call(item, key)) {
                        const valuePath = currentPath ? `${currentPath}.${key}` : key;
                        // Search Key
                        if (key.toLowerCase().includes(queryLower)) {
                            results.push({
                                rowIndex,
                                path: valuePath, // Path to the value of the matched key
                                value: item[key], // Actual value of the key
                                matchedPart: 'key',
                                matchedKeyName: key // The key string that matched
                            });
                        }
                        // Recurse for value associated with this key
                        searchItem(item[key], valuePath);
                    }
                }
            } else if (Array.isArray(item)) {
                item.forEach((element, index) => {
                    const elementPath = `${currentPath}[${index}]`;
                    searchItem(element, elementPath);
                });
            } else {
                // Search Value (primitive)
                if (String(item).toLowerCase().includes(queryLower)) {
                    results.push({
                        rowIndex,
                        path: currentPath, // Path to this primitive value
                        value: item, // Original primitive value
                        matchedPart: 'value'
                    });
                }
            }
        }
        searchItem(row, ''); // Start search for the current row object
    });

    // Deduplicate results:
    // If a key match and a value match occur for the exact same path,
    // prioritize the key match. This is because a key match is often more specific.
    const uniqueResultsMap = new Map();
    for (const res of results) {
        const resultKey = `${res.rowIndex}-${res.path}`;
        const existing = uniqueResultsMap.get(resultKey);
        if (!existing) {
            uniqueResultsMap.set(resultKey, res);
        } else {
            // If existing is a value match and new one is a key match for the same path, prefer key match.
            if (existing.matchedPart === 'value' && res.matchedPart === 'key') {
                uniqueResultsMap.set(resultKey, res);
            }
            // Otherwise (existing is key, new is value; or both are same type), keep the existing (first one found).
        }
    }
    return Array.from(uniqueResultsMap.values());
};


export const escapeCsvField = (field) => {
  if (field === null || field === undefined) {
      return '';
  }
  const stringField = String(field);
  if (stringField.includes(',') || stringField.includes('\n') || stringField.includes('"')) {
      return `"${stringField.replace(/"/g, '""')}"`;
  }
  return stringField;
};

export const processCellValueForRecord = (valueString) => {
  const trimmedValue = typeof valueString === 'string' ? valueString.trim() : valueString;
  if (typeof trimmedValue === 'string' &&
      ((trimmedValue.startsWith('{') && trimmedValue.endsWith('}')) ||
       (trimmedValue.startsWith('[') && trimmedValue.endsWith(']')))) {
      try {
          return JSON.parse(trimmedValue);
      } catch (e) {
          // If parsing fails, it's either not JSON or malformed JSON.
          // Return the original string as is.
          return valueString; 
      }
  }
  return valueString;
};

export const robustParseCSV = (csvString, delimiter = '\t') => {
  const objects = [];
  let headers = [];
  
  let currentRow = [];
  let currentField = "";
  let inQuotedField = false;
  let i = 0;

  csvString = csvString.replace(/\r\n?/g, '\n').trim();

  if (csvString === "") {
      robustParseCSV.lastHeaders = [];
      return [];
  }

  while (i < csvString.length) {
      const char = csvString[i];

      if (inQuotedField) {
          if (char === '"') {
              // Check for escaped quote (RFC 4180 compliant: "")
              if (i + 1 < csvString.length && csvString[i + 1] === '"') {
                  currentField += '"'; // Add one quote to the field
                  i++; // And skip the second quote of the pair
              }
              // Lenient check: Is this quote a field terminator?
              // A quote terminates a field if it's the last char, or followed by a delimiter or newline.
              else if (
                  (i + 1 === csvString.length) || // End of the entire string
                  (i + 1 < csvString.length && (csvString[i + 1] === delimiter || csvString[i + 1] === '\n'))
              ) {
                  inQuotedField = false; // End of quoted field. The quote itself is not part of the data.
              }
              // Lenient part: If it's a quote, but not an RFC-escaped one, and not a field terminator
              // (e.g., a quote inside a JSON string that wasn't CSV-escaped), treat it as literal data.
              else {
                  currentField += char; // Add the quote as data
              }
          } else {
              currentField += char; // Append other characters (including newline) to current field
          }
      } else { // Not in a quoted field
          if (char === '"') {
              // If we are not in a quoted field and we see a quote:
              // If currentField is empty, it's the start of a new quoted field.
              if (currentField.length === 0) {
                  inQuotedField = true;
                  // The quote itself is not added to currentField here; it's a wrapper.
              } else {
                  // A quote appears in an unquoted field, not at the start. Treat as literal.
                  currentField += char;
              }
          } else if (char === delimiter) {
              currentRow.push(currentField);
              currentField = "";
          } else if (char === '\n') {
                            // Heuristic for unquoted newlines within fields:
              // If headers are parsed, and we haven't collected all expected fields for the current row yet
              // (i.e., number of fields in currentRow is less than total headers - 1),
              // and the current field has content, assume this newline is part of the current field.
              // This handles unquoted newlines in fields that are not the last field of a record,
              // assuming records are not sparse (i.e., all delimiters are present).
              if (headers.length > 0 && 
                  currentRow.length < headers.length - 1 &&  // We expect more delimiters on this logical line
                  currentField.length > 0                   // Current field is not empty
                 ) {
                  currentField += char; // Append newline to currentField and continue to next char
              } else {
                  // Original logic: Treat newline as a row delimiter
                  currentRow.push(currentField);
                  currentField = "";

                  if (headers.length === 0) {
                      // First row, assume it's headers
                      headers = currentRow.map(h => h.trim());
                  } else {
                      // Data row
                      // Ensure record creation only if row has some substance
                      if (currentRow.some(val => val !== undefined && (typeof val === 'string' ? val.trim() !== '' : true))) {
                          const record = {};
                          headers.forEach((header, index) => {
                              const H = header || `_col_${index+1}`; // Use header or generate one if empty
                              const rawValue = currentRow[index] !== undefined ? currentRow[index] : "";
                              record[H] = processCellValueForRecord(rawValue);
                          });
                          objects.push(record);
                      }
                  }
                  currentRow = []; // Reset for next row
              }
          } else {
              currentField += char;
          }
      }
      i++;
  }

  currentRow.push(currentField); 

  if (currentRow.length > 0) {
      if (headers.length === 0) { 
          headers = currentRow.map(h => h.trim());
          // If headers were derived from the only line, and it wasn't an empty line,
          // there are no data objects to create.
          if (objects.length === 0 && !currentRow.every(f => f === "")) {
              // Do not create an empty object if this was the header line.
          }
      } else {
          if (currentRow.some(val => val !== undefined && (typeof val === 'string' ? val.trim() !== '' : true))) {
              const record = {};
              headers.forEach((header, index) => {
                  const H = header || `_col_${index+1}`;
                  const rawValue = currentRow[index] !== undefined ? currentRow[index] : "";
                  record[H] = processCellValueForRecord(rawValue);
              });
              objects.push(record);
          }
      }
  }
  
  if (headers.length > 0 && headers.every(h => h === '')) {
      console.warn("CSV Warning: All parsed headers are empty. CSV might be malformed or start with an empty line treated as headers.");
      headers = []; 
  }

  robustParseCSV.lastHeaders = headers.filter(h => h !== ''); 
  return objects;
};
robustParseCSV.lastHeaders = []; 

export const detectDelimiter = (textSample) => {
  if (!textSample || textSample.trim() === '') return ','; 
  const firstLineBreak = textSample.indexOf('\n');
  const firstLine = firstLineBreak === -1 ? textSample.trim() : textSample.substring(0, firstLineBreak).trim();

  if (firstLine.length === 0) return ','; 

  const delimiters = [
      { char: ',', count: (firstLine.match(/,/g) || []).length },
      { char: '\t', count: (firstLine.match(/\t/g) || []).length },
      { char: '|', count: (firstLine.match(/\|/g) || []).length },
  ];

  const presentDelimiters = delimiters.filter(d => d.count > 0);

  if (presentDelimiters.length === 0) {
      // If no common delimiters found, check if it might be single-column data
      // (e.g., a list of JSON objects, each on a new line, without typical CSV delimiters)
      // In such cases, any delimiter would work, but ',' is a common default.
      return ',';
  }

  presentDelimiters.sort((a, b) => b.count - a.count);
  return presentDelimiters[0].char;
};

export function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

