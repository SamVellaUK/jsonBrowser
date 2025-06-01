// utils.js

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
  if (!query) return [];
  const results = [];
  data.forEach((row, rowIndex) => {
    const flattened = flatten(row); 
    flattened.forEach(({ path, value }) => {
      const strValue = String(value).toLowerCase();
      if (strValue.includes(query.toLowerCase())) {
        results.push({ rowIndex, path, value: String(value) });
      }
    });
  });
  return results;
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
      } catch (e1) {
          try {
              const repairedJSONString = trimmedValue.replace(/""/g, '"');
              return JSON.parse(repairedJSONString);
          } catch (e2) {
              return valueString; 
          }
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
              if (i + 1 < csvString.length && csvString[i + 1] === '"') {
                  currentField += '"';
                  i++; 
              } else {
                  inQuotedField = false;
              }
          } else {
              currentField += char; 
          }
      } else { 
          if (char === '"') {
              if (currentField === "") { 
                  inQuotedField = true;
              } else {
                  currentField += char; 
              }
          } else if (char === delimiter) {
              currentRow.push(currentField);
              currentField = "";
          } else if (char === '\n') {
              currentRow.push(currentField);
              currentField = "";

              if (headers.length === 0) {
                  headers = currentRow.map(h => h.trim());
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
              currentRow = [];
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
      return ',';
  }

  presentDelimiters.sort((a, b) => b.count - a.count);
  return presentDelimiters[0].char;
};

