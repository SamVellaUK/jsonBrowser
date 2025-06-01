import { generateSQL } from './sqlGenerator.js';
import { state } from './state.js';
import { escapeStringForDataAttribute, getValue, highlightText, escapeCsvField, getAllObjectPaths } from './utils.js';


// Focus Management
let previouslyFocusedElement = null;

export function openModalFocus(modalElementQuerySelector) {
    previouslyFocusedElement = document.activeElement;
    requestAnimationFrame(() => {
        const modal = document.querySelector(modalElementQuerySelector);
        if (modal) {
            const firstFocusableElement = modal.querySelector(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (firstFocusableElement) {
                firstFocusableElement.focus();
            }
            modal.addEventListener('keydown', trapFocusInModal);
        }
    });
}

export function closeModalFocus(modalElementQuerySelector) {
    const modal = document.querySelector(modalElementQuerySelector);
    if (modal) {
        modal.removeEventListener('keydown', trapFocusInModal);
    }
    if (previouslyFocusedElement) {
        if (document.body.contains(previouslyFocusedElement) && typeof previouslyFocusedElement.focus === 'function') {
           previouslyFocusedElement.focus();
        }
        previouslyFocusedElement = null;
    }
}

function trapFocusInModal(e) {
    if (e.key !== 'Tab') return;
    const modal = e.currentTarget;
    const focusableElements = Array.from(
        modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter(el => el.offsetParent !== null && !el.disabled);
    if (focusableElements.length === 0) return;
    const firstFocusableElement = focusableElements[0];
    const lastFocusableElement = focusableElements[focusableElements.length - 1];
    if (e.shiftKey) {
        if (document.activeElement === firstFocusableElement) {
            lastFocusableElement.focus();
            e.preventDefault();
        }
    } else {
        if (document.activeElement === lastFocusableElement) {
            firstFocusableElement.focus();
            e.preventDefault();
        }
    }
}

const scrollToCurrentSearchResult = () => {
  const currentResultElement = document.querySelector('.highlight.current');
  if (currentResultElement) {
    currentResultElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center', 
      inline: 'nearest' 
    });
  }
};

export const expandToResult = (result) => {
  try {
    const pathParts = result.path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let currentPath = '';
    let needsExpandedPathNotify = false;
    
    pathParts.forEach((part, index) => {
      currentPath = index === 0 ? part : `${currentPath}.${part}`;
      const objectPathForExpansion = currentPath.replace(/\.(\d+)(?=\.|$)/g, '[$1]');
      const value = getValue(state.data[result.rowIndex], objectPathForExpansion);
      if (index < pathParts.length - 1 && value && typeof value === 'object') {
        if (!state.expandedPaths.has(`${result.rowIndex}-${objectPathForExpansion}`)) {
            state.expandedPaths.add(`${result.rowIndex}-${objectPathForExpansion}`);
            needsExpandedPathNotify = true;
        }
      }
    });
    
    const finalValue = getValue(state.data[result.rowIndex], result.path);
     if (finalValue && typeof finalValue === 'object' && !state.expandedPaths.has(`${result.rowIndex}-${result.path}`)) {
         state.expandedPaths.add(`${result.rowIndex}-${result.path}`);
         needsExpandedPathNotify = true;
     }

    const rootColumn = result.path.split(/[.\[]/)[0];
    let columnChanged = false;
    const newVisibleColumns = [...state.visibleColumns];

    if (!newVisibleColumns.includes(result.path) && !newVisibleColumns.includes(rootColumn)) {
        newVisibleColumns.push(rootColumn);
        columnChanged = true;
    }
    
    if (columnChanged) {
        state.visibleColumns = newVisibleColumns; 
        updateAllPossibleColumns();
    }

    if (needsExpandedPathNotify) {
        state.notify('expandedPaths'); 
    }
    
    requestAnimationFrame(scrollToCurrentSearchResult);

  } catch (e) {
    console.warn('Error expanding to result:', e);
  }
};

export const updateAllPossibleColumns = () => {
  const newAllPossible = new Set();
  state.data.forEach(row => {
      if (row && typeof row === 'object' && row !== null) {
          Object.keys(row).forEach(key => newAllPossible.add(key));
      }
  });
  state.visibleColumns.forEach(colPath => newAllPossible.add(colPath));
  state.allPossibleColumns.forEach(colPath => newAllPossible.add(colPath));
  if (newAllPossible.size !== state.allPossibleColumns.size || ![...newAllPossible].every(item => state.allPossibleColumns.has(item))) {
      state.allPossibleColumns = newAllPossible;
  }
};

export const generateCSV = () => {
  if (!state.data || state.data.length === 0) {
      return 'No data to export.';
  }
  if (!state.visibleColumns || state.visibleColumns.length === 0) {
      return 'No columns currently visible for export.';
  }
  const headers = state.visibleColumns.map(header => escapeCsvField(header));
  const rows = state.data.map(row => {
      return state.visibleColumns.map(colKey => {
          const value = getValue(row, colKey);
          let cellValue;
          if (value === null || value === undefined) {
              cellValue = '';
          } else if (typeof value === 'object') {
              const stringified = JSON.stringify(value);
              const previewLength = 15;
              const preview = stringified.substring(0, previewLength);
              const prefix = Array.isArray(value) ? "<Json Array> " : "<Json Object> ";
              cellValue = prefix + preview + (stringified.length > previewLength ? "..." : "");
          } else {
              cellValue = String(value);
          }
          return escapeCsvField(cellValue);
      }).join(',');
  });
  return [headers.join(','), ...rows].join('\n');
};

const renderCsvModal = () => {
  if (!state.showCsvModal) return '';
  return `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="csv-modal-title">
      <div id="csv-modal-content-wrapper" class="modal-content" style="width: 900px; display: flex; flex-direction: column; max-height: 80vh;">
        <div class="modal-header">
          <h3 id="csv-modal-title">CSV Export</h3>
          <div>
            <button data-action="copy-csv" style="margin-right: 10px;">Copy CSV</button>
            <button data-action="download-csv" style="margin-right: 10px;">Download CSV</button>
            <button class="close-btn" data-action="close-csv" aria-label="Close CSV modal">×</button>
          </div>
        </div>
        <textarea id="csv-output-area" class="sql-output" readonly style="flex-grow: 1; width: 100%; resize: none; margin-top: 10px;">${escapeStringForDataAttribute(state.csvOutputContent)}</textarea>
        <div style="font-size: 12px; color: #666; margin-top: 5px;">Exports currently visible top-level columns. Nested objects/arrays are summarized.</div>
      </div>
    </div>
  `;
};
  
const renderHeader = () => {
  const hiddenCount = state.searchResults.filter(result => {
      const rootColumn = result.path.split(/[.\[]/)[0];
      return !state.visibleColumns.includes(rootColumn) && !state.visibleColumns.includes(result.path);
    }
  ).length;

  return `
    <div class="header">
      <input 
        aria-label="Search JSON content"
        id="json-browser-search-box" 
        type="text" 
        class="search-box" 
        placeholder="Search (Press Enter)" 
        value="${escapeStringForDataAttribute(state.searchQuery)}"
        data-action="search"
      >
      <div class="search-nav">
        <button aria-label="Previous search result" data-action="search-prev" ${state.searchResults.length === 0 ? 'disabled' : ''}>←</button>
        <button aria-label="Next search result" data-action="search-next" ${state.searchResults.length === 0 ? 'disabled' : ''}>→</button>
      </div>
      <div class="controls">
        <button data-action="reset-view">Reset View</button>
        <button data-action="expand-all">Expand All</button>
        <button data-action="collapse-all">Collapse All</button>
        <button data-action="toggle-paths" class="${state.showPaths ? 'active' : ''}">
          Paths
        </button>
        <button data-action="toggle-edit-mode" class="${state.editModeActive ? 'active' : ''}">
          ${state.editModeActive ? 'Done Editing' : 'Edit Mode'}
        </button>
        ${state.editModeActive ? `<button id="add-column-button" data-action="show-add-column-popover" aria-haspopup="true" aria-expanded="${state.showAddColumnPopover}">Add Column +</button>` : ''}
        <button data-action="show-sql">SQL</button>
        <button data-action="show-json">View/Edit Data</button>
        <button data-action="show-csv">Export CSV</button>
      </div>
      <div class="search-info" role="status" aria-live="polite" aria-atomic="true">
        ${state.searchResults.length > 0 
          ? `${state.currentSearchIndex + 1} of ${state.searchResults.length}${hiddenCount > 0 ? `<span class="hidden-indicator">(${hiddenCount} hidden)</span>` : ''}` 
          : state.searchQuery && state.searchResults.length === 0 ? 'No matches' : `${state.data.length} rows`}
      </div>
    </div>
  `;
};

const renderCell = (value, path, rowIndex, isNestedCall = false) => {
  const isExpandable = value && typeof value === 'object';
  const expandKey = `${rowIndex}-${path}`;
  const isExpanded = state.expandedPaths.has(expandKey);
  const isTopLevelCell = !isNestedCall;

  let cellDisplayHtml = '';
  const currentResult = state.searchResults[state.currentSearchIndex];
  const isCurrentMatchForHighlight = currentResult &&
                                    currentResult.rowIndex === rowIndex &&
                                    currentResult.path === path;

  if (isExpandable) {
      const displayValueText = Array.isArray(value) 
          ? `Array(${value.length})` 
          : `Object(${Object.keys(value).length})`;
      const highlightedDisplayValue = highlightText(displayValueText, state.searchQuery, isCurrentMatchForHighlight && !isExpanded);
      
      const nestedContentId = `nested-content-${rowIndex}-${path.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const nestedDivContent = isExpanded ? renderNestedObject(value, path, rowIndex) : '';
      
      cellDisplayHtml = `
        <div 
          class="expandable" 
          data-action="toggle" 
          data-path="${escapeStringForDataAttribute(path)}" 
          data-row="${rowIndex}"
          role="button"
          tabindex="0"
          aria-expanded="${isExpanded ? 'true' : 'false'}"
          aria-controls="${nestedContentId}">
          <span class="toggle" aria-hidden="true">${isExpanded ? '−' : '+'}</span>
          ${highlightedDisplayValue}
        </div>
        <div class="nested ${isExpanded ? 'expanded' : ''}" id="${nestedContentId}" data-parent-path="${escapeStringForDataAttribute(path)}" data-row-index-for-nested="${rowIndex}">
          ${nestedDivContent}
        </div>
      `;
  } else {
      let textForHighlighting;
      let finalDisplay;
      if (isTopLevelCell) {
          if (value === null) {
              textForHighlighting = '<null>';
              finalDisplay = `<span class="value-special value-null">${highlightText(textForHighlighting, state.searchQuery, isCurrentMatchForHighlight)}</span>`;
          } else if (value === undefined) {
              textForHighlighting = '<undefined>';
              finalDisplay = `<span class="value-special value-undefined">${highlightText(textForHighlighting, state.searchQuery, isCurrentMatchForHighlight)}</span>`;
          } else {
              textForHighlighting = String(value);
              finalDisplay = highlightText(textForHighlighting, state.searchQuery, isCurrentMatchForHighlight);
          }
      } else {
          textForHighlighting = (value === null || value === undefined) ? '' : String(value);
          finalDisplay = highlightText(textForHighlighting, state.searchQuery, isCurrentMatchForHighlight);
      }
      cellDisplayHtml = finalDisplay;
      const isPrimitive = value !== null && value !== undefined && typeof value !== 'object';
      if (state.editModeActive && isPrimitive && isNestedCall) { 
          cellDisplayHtml += `
            <button 
              class="promote-btn" 
              data-action="promote-value" 
              data-path-to-value="${escapeStringForDataAttribute(path)}" 
              data-row-index="${rowIndex}"
              aria-label="Promote '${escapeStringForDataAttribute(path)}' to column"
              title="Promote '${escapeStringForDataAttribute(path)}' to column"
            >+</button>`;
      }
  }
  
  const pathDisplay = state.showPaths ? `<div class="path-display">${path}</div>` : '';
  
  if (isTopLevelCell) {
      return `<td class="${path === 'id' ? 'col-id' : ''}"><div>${cellDisplayHtml}</div>${pathDisplay}</td>`;
  } else {
      return `<div>${cellDisplayHtml}</div>`;
  }
};

const renderNestedObject = (obj, basePath, rowIndex) => {
  if (!obj || typeof obj !== 'object') {
    const currentResult = state.searchResults[state.currentSearchIndex];
    const isCurrentMatch = currentResult && 
      currentResult.rowIndex === rowIndex && 
      currentResult.path === basePath;
    
    let promoteButtonHtml = '';
    const isPrimitive = obj !== null && obj !== undefined && typeof obj !== 'object';
    if (state.editModeActive && isPrimitive) { 
      promoteButtonHtml = `
        <button 
          class="promote-btn" 
          data-action="promote-value" 
          data-path-to-value="${escapeStringForDataAttribute(basePath)}" 
          data-row-index="${rowIndex}"
          aria-label="Promote '${escapeStringForDataAttribute(basePath)}' to column"
          title="Promote '${escapeStringForDataAttribute(basePath)}' to column"
        >+</button>`;
    }
    return `<div>${highlightText(String(obj || ''), state.searchQuery, isCurrentMatch)}${promoteButtonHtml}</div>`;
  }
  
  let rows = '';
  let tableHtml = '';

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return '<div><i>(empty array)</i></div>';
    }
    const firstItem = obj[0];
    let isArrayOfObjects = typeof firstItem === 'object' && firstItem !== null && !Array.isArray(firstItem);
    if (isArrayOfObjects) {
      const columnKeys = new Set();
      const sampleSize = Math.min(obj.length, 10); 
      for (let i = 0; i < sampleSize; i++) {
          if (typeof obj[i] === 'object' && obj[i] !== null && !Array.isArray(obj[i])) {
              Object.keys(obj[i]).forEach(key => columnKeys.add(key));
          }
      }
      if (columnKeys.size === 0) {
           if (obj.every(item => typeof item === 'object' && item !== null && !Array.isArray(item) && Object.keys(item).length === 0)) {
              isArrayOfObjects = false; 
           } else {
              isArrayOfObjects = false;
           }
      }
      if (isArrayOfObjects) { 
          const headers = Array.from(columnKeys).sort(); 
          let headerRow = '<tr>'; 
          headers.forEach(header => {
              const currentResult = state.searchResults[state.currentSearchIndex];
              const isHeaderMatch = currentResult && state.searchQuery &&
                                  header.toLowerCase().includes(state.searchQuery.toLowerCase()) &&
                                  currentResult.path.startsWith(basePath);
              headerRow += `<th>${highlightText(header, state.searchQuery, isHeaderMatch)}</th>`;
          });
          headerRow += '</tr>';
          let bodyRows = obj.map((item, index) => {
              const itemBasePath = `${basePath}[${index}]`;
              let rowCells = ``; 
              if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                  headers.forEach(key => {
                      const cellPath = `${itemBasePath}.${key}`;
                      const cellContent = renderCell(item[key], cellPath, rowIndex, true); 
                      const pathDisplay = state.showPaths ? `<div class="path-display">${cellPath}</div>` : '';
                      rowCells += `<td>${cellContent}${pathDisplay}</td>`;
                  });
              } else { 
                  const cellContent = renderCell(item, itemBasePath, rowIndex, true);
                  const pathDisplay = state.showPaths ? `<div class="path-display">${itemBasePath}</div>` : '';
                  rowCells += `<td colspan="${headers.length}">${cellContent}${pathDisplay}</td>`;
              }
              return `<tr>${rowCells}</tr>`;
          }).join('');
          tableHtml = `<table class="nested-table"><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>`;
      }
    } 
    if (!isArrayOfObjects) { 
      rows = obj.map((item, index) => {
        const itemPath = `${basePath}[${index}]`;
        const itemContent = renderCell(item, itemPath, rowIndex, true); 
        const pathDisplay = state.showPaths ? `<div class="path-display">${itemPath}</div>` : '';
        return `
          <tr>
            <td class="row-number">[${index}]</td>
            <td>${itemContent}${pathDisplay}</td> 
          </tr>
        `;
      }).join('');
      tableHtml = `<table class="nested-table"><tbody>${rows}</tbody></table>`;
    }
  } else {  
      rows = Object.entries(obj).map(([key, value]) => {
        const itemPath = `${basePath}.${key}`;
        const valueContent = renderCell(value, itemPath, rowIndex, true); 
        const pathDisplay = state.showPaths ? `<div class="path-display">${itemPath}</div>` : '';
        const currentResult = state.searchResults[state.currentSearchIndex];
        const isKeyMatch = currentResult && state.searchQuery &&
          key.toLowerCase().includes(state.searchQuery.toLowerCase()) && 
          currentResult.path.startsWith(basePath);
      return `
          <tr>
            <td><div><strong>${highlightText(key, state.searchQuery, isKeyMatch)}</strong></div></td>
            <td>${valueContent}${pathDisplay}</td>
          </tr>
      `;
      }).join('');
      tableHtml = `<table class="nested-table"><tbody>${rows}</tbody></table>`;
  }
  return tableHtml;
};

const renderTable = () => {
  if (state.data.length === 0 && !state.showJsonModal) {
    return '<div class="no-results" role="status" aria-live="polite">No data available. Click "View/Edit Data" to load or paste data.</div>';
  }
  if (state.data.length === 0 && state.showJsonModal) {
      return '';
  }

  const sortedData = [...state.data];
  if (state.sortBy) {
    sortedData.sort((a, b) => {
      const aVal = getValue(a, state.sortBy);
      const bVal = getValue(b, state.sortBy);
      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
      } else if (typeof aVal === 'string' && typeof bVal === 'string') {
          comparison = aVal.localeCompare(bVal);
      } else {
          comparison = String(aVal).localeCompare(String(bVal));
      }
      return state.sortDirection === 'asc' ? comparison : -comparison;
    });
  }

  return `
    <div class="json-table">
      <table>
        <thead>
          <tr>
            <th class="row-number"><div>#</div></th>
            ${state.visibleColumns.map(col => {
              let removeButtonHtml = '';
              const draggableAttribute = state.editModeActive ? 'draggable="true"' : '';
              const thStyles = state.editModeActive ? 'cursor: grab;' : '';
              if (state.editModeActive) {
                  removeButtonHtml = `
                    <button 
                        class="remove-col-btn-header" 
                        data-action="remove-column-header" 
                        data-column="${encodeURIComponent(col)}"
                        aria-label="Remove column '${escapeStringForDataAttribute(col)}'" 
                        title="Remove column '${escapeStringForDataAttribute(col)}'" 
                    >−</button>`;
              }
              return `
              <th 
                role="button"
                tabindex="0"
                data-action="sort" 
                data-column="${encodeURIComponent(col)}" 
                class="${state.sortBy === col ? `sorted ${state.sortDirection}` : ''} ${col.toLowerCase() === 'id' ? 'col-id' : ''}"
                ${draggableAttribute}
                style="${thStyles}"
                aria-sort="${state.sortBy === col ? (state.sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}"
              >
                <div>
                  ${col}
                  ${removeButtonHtml}
                </div>
                ${state.showPaths ? `<div class="path-display">${col}</div>` : ''}
              </th>
            `}).join('')}
          </tr>
        </thead>
        <tbody>
          ${sortedData.map((row, index) => {
            const originalRowIndex = state.data.indexOf(row); 
            return `
            <tr>
              <td class="row-number"><div>${index + 1}</div></td>
              ${state.visibleColumns.map(col => 
                renderCell(getValue(row, col), col, originalRowIndex, false) 
              ).join('')}
            </tr>
          `}).join('')}
        </tbody>
      </table>
    </div>
  `;
};
  
const renderSqlModal = () => {
  if (!state.showSqlModal) return '';
  return `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="sql-modal-title">
      <div id="sql-modal-content-wrapper" class="modal-content" style="width: 900px;">
        <div class="modal-header">
          <h3 id="sql-modal-title">Generated SQL</h3>
          <div>
            <select data-action="change-dialect" style="margin-right: 10px;">
              <option value="snowflake" ${state.sqlDialect === 'snowflake' ? 'selected' : ''}>Snowflake</option>
              <option value="postgresql" ${state.sqlDialect === 'postgresql' ? 'selected' : ''}>PostgreSQL</option>
            </select>
            <button data-action="copy-sql" style="margin-right: 10px;">Copy</button>
            <button class="close-btn" data-action="close-sql" aria-label="Close SQL modal">×</button>
          </div>
        </div>
        <textarea class="sql-output" readonly>${generateSQL(state.visibleColumns, state.sqlDialect)}</textarea>
      </div>
    </div>
  `;
};

const renderJsonModal = () => {
  if (!state.showJsonModal) return '';
  return `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="json-modal-title">
      <div id="json-modal-content" class="modal-content" style="width: 900px; height: 80vh; display: flex; flex-direction: column;">
        <div class="modal-header">
          <h3 id="json-modal-title">Raw Data (JSON, CSV, TSV)</h3>
          <button class="close-btn" data-action="close-json" aria-label="Close raw data modal">×</button>
        </div>
        <textarea 
            id="json-edit-area" 
            class="json-edit-output" 
            aria-label="Raw JSON, CSV, or TSV editor"
            style="flex-grow: 1; width: 100%; resize: none; margin-bottom: 10px; font-family: 'Consolas', monospace;"
            placeholder="Paste JSON, CSV, or TSV data here, or load from file."
        >${state.rawJsonEditContent}</textarea>
        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding-top:10px; border-top: 1px solid #eee;">
          <div class="json-modal-actions-left">
            <input type="file" id="json-file-input" accept=".json,.csv,.tsv,.txt" style="display: none;">
            <button data-action="trigger-file-load" style="margin-right: 10px;">Load File</button>
            <button data-action="select-all-json" style="margin-right: 10px;">Select All</button>
            <button data-action="copy-json" style="margin-right: 10px;">Copy</button>
            <button data-action="clear-json" style="margin-right: 10px;">Clear</button>
            <button data-action="validate-json">Validate JSON</button>
          </div>
          <div class="json-modal-actions-right">
              <button data-action="apply-json-changes" style="margin-left: 10px; background-color: #28a745; color:white; border:none; padding: 8px 12px; border-radius:4px; cursor:pointer;">Apply & Close</button>
          </div>
        </div>
         <span class="json-validation-status" role="status" aria-live="polite" aria-atomic="true" style="font-size: 12px; min-height: 1.2em; margin-top: 5px; text-align: right;">${state.jsonValidationMessage}</span>
      </div>
    </div>
  `;
};

const renderPromoteKeyPopover = () => {
  if (!state.showPromoteKeyPopover || !state.promoteKeyPopoverContext) {
      return '';
  }
  const { targetElementRect, pathToArrayElement, valueFieldName, siblingKeysAndValues } = state.promoteKeyPopoverContext;
  const popoverTop = targetElementRect.bottom + window.scrollY + 5;
  const popoverLeft = targetElementRect.left + window.scrollX;
  const popoverStyle = `
      position: absolute; top: ${popoverTop}px; left: ${popoverLeft}px;
      background-color: white; border: 1px solid #ccc; border-radius: 4px;
      padding: 10px; z-index: 1050; box-shadow: 0 2px 10px rgba(0,0,0,0.15);
      font-size: 0.9em; min-width: 200px;
  `;
  const arrayName = pathToArrayElement.substring(0, pathToArrayElement.lastIndexOf('['));
  const itemIdentifierInArray = pathToArrayElement.substring(pathToArrayElement.lastIndexOf('['));
  let content = `<div style="margin-bottom: 8px; font-weight: bold;">Promote field: <code>${valueFieldName}</code></div>`;
  content += `<div style="margin-bottom: 8px; font-size: 0.9em;">From item in <code>${arrayName}</code>. Identify this item by:</div>`;
  content += '<ul style="list-style: none; padding: 0; margin: 0;">';
  siblingKeysAndValues.forEach(skv => {
      let displayValue = String(skv.value);
      if (displayValue.length > 25) displayValue = displayValue.substring(0, 22) + "...";
      content += `
          <li style="margin-bottom: 5px;">
              <button class="promote-popover-btn" data-action="confirm-promote-with-key" data-selected-key="${escapeStringForDataAttribute(skv.key)}">
                  ${skv.key}: "${escapeStringForDataAttribute(displayValue)}"
              </button>
          </li>`;
  });
  content += `
      <li style="margin-bottom: 5px;">
          <button class="promote-popover-btn" data-action="confirm-promote-with-key" data-selected-key="INDEX">
              Original position (<code>${itemIdentifierInArray}</code>)
          </button>
      </li>
      <li style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 8px;">
          <button class="promote-popover-btn promote-popover-cancel-btn" data-action="cancel-promote-popover">Cancel</button>
      </li>
  </ul>`;
  return `<div id="promote-key-popover" class="promote-key-popover" style="${popoverStyle}" role="dialog" aria-modal="true" aria-labelledby="promote-key-popover-title">
              <h4 id="promote-key-popover-title" class="sr-only">Promote Key Options</h4>
              ${content}
          </div>`;
};

const renderAddColumnPopover = () => {
  if (!state.showAddColumnPopover || !state.addColumnPopoverAnchor) return '';
  const anchorRect = state.addColumnPopoverAnchor.getBoundingClientRect();
  const popoverTop = anchorRect.bottom + window.scrollY + 5;
  const popoverWidth = 250;
  let popoverLeft = anchorRect.left + window.scrollX;
  if (popoverLeft + popoverWidth > window.innerWidth) popoverLeft = anchorRect.right + window.scrollX - popoverWidth;
  popoverLeft = Math.max(0, popoverLeft);
  const popoverStyle = `
      position: absolute; top: ${popoverTop}px; left: ${popoverLeft}px;
      background-color: white; border: 1px solid #ccc; border-radius: 4px;
      padding: 10px; z-index: 1050; box-shadow: 0 2px 10px rgba(0,0,0,0.15);
      font-size: 0.9em; min-width: ${popoverWidth}px; max-height: 300px; overflow-y: auto;
  `;
  const availableColumnsToAdd = [...state.allPossibleColumns].filter(
      col => !state.visibleColumns.includes(col)
  ).sort((a,b) => a.localeCompare(b, undefined, {sensitivity: 'base'}));
  let content = `<div style="margin-bottom: 8px; font-weight: bold; padding-bottom: 5px; border-bottom: 1px solid #eee;">Available Columns to Add</div>`;
  if (availableColumnsToAdd.length === 0) {
      content += '<div style="padding: 5px 0;"><i>No more columns to add.</i></div>';
  } else {
      content += '<ul style="list-style: none; padding: 0; margin: 0;">';
      availableColumnsToAdd.forEach(col => {
          content += `
              <li style="margin-bottom: 5px;">
                  <button class="add-column-popover-btn" data-action="add-column-from-popover" data-column-to-add="${escapeStringForDataAttribute(col)}" title="Add column: ${escapeStringForDataAttribute(col)}">
                     + ${escapeStringForDataAttribute(col)}
                  </button>
              </li>`;
      });
      content += '</ul>';
  }
  content += `
      <div style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 8px; text-align: right;">
          <button class="add-column-popover-cancel-btn" data-action="cancel-add-column-popover">Close</button>
      </div>
  `;
  return `<div id="add-column-popover" class="add-column-popover" style="${popoverStyle}" role="dialog" aria-modal="true" aria-labelledby="add-column-popover-title">
              <h4 id="add-column-popover-title" class="sr-only">Reinstate Column</h4>
              ${content}
          </div>`;
};

// Drag-and-drop state
let dragSourceElement = null;

// Drag-and-Drop Handlers for Column Reordering
function handleThDragStart(e) {
  if (!state.editModeActive) return;
  this.classList.add('dragging');
  dragSourceElement = this;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.column);
}

function handleThDragOver(e) {
  if (!state.editModeActive || !dragSourceElement) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (this !== dragSourceElement) this.classList.add('drag-over');
  return false;
}

function handleThDragEnter(e) {
  if (!state.editModeActive || !dragSourceElement) return;
  e.preventDefault();
  if (this !== dragSourceElement) this.classList.add('drag-over');
}

function handleThDragLeave() {
  if (!state.editModeActive) return;
  this.classList.remove('drag-over');
}

function handleThDrop(e) {
  if (!state.editModeActive || !dragSourceElement) return;
  e.stopPropagation(); 
  e.preventDefault();  
  this.classList.remove('drag-over');
  if (dragSourceElement !== this) {
      const sourceColumnEncoded = e.dataTransfer.getData('text/plain');
      const targetColumnEncoded = this.dataset.column;
      const sourceColumn = decodeURIComponent(sourceColumnEncoded);
      const targetColumn = decodeURIComponent(targetColumnEncoded);
      const currentCols = [...state.visibleColumns];
      const sourceIndex = currentCols.indexOf(sourceColumn);
      const targetIndex = currentCols.indexOf(targetColumn);
      if (sourceIndex !== -1 && targetIndex !== -1 && sourceIndex !== targetIndex) {
          const [movedItem] = currentCols.splice(sourceIndex, 1); 
          currentCols.splice(targetIndex, 0, movedItem);          
          state.visibleColumns = currentCols; 
      }
  }
  return false;
}

function handleThDragEnd() {
  if (!state.editModeActive) return;
  this.classList.remove('dragging');
  const tableHead = this.closest('thead');
  if (tableHead) {
      tableHead.querySelectorAll('th.drag-over').forEach(th => th.classList.remove('drag-over'));
  }
  dragSourceElement = null; 
}

export const render = () => {
  const appElement = document.getElementById('app');
  if (!appElement) return;
  
  const activeElement = document.activeElement;
  let activeElementId = activeElement ? activeElement.id : null;
  let selectionStart, selectionEnd;

  if (activeElement && (activeElement.id === 'json-browser-search-box' || activeElement.id === 'json-edit-area')) {
      selectionStart = activeElement.selectionStart;
      selectionEnd = activeElement.selectionEnd;
  }

  const jsonTableElement = appElement.querySelector('.json-table');
  let mainScrollLeft = 0;
  let mainScrollTop = 0;

  if (jsonTableElement) {
      mainScrollLeft = jsonTableElement.scrollLeft; 
      mainScrollTop = jsonTableElement.scrollTop;
  }
  
  appElement.innerHTML = `
    ${renderHeader()}
    ${renderTable()}
    ${renderSqlModal()} 
    ${renderJsonModal()}
    ${renderPromoteKeyPopover()}
    ${renderAddColumnPopover()} 
    ${renderCsvModal()} 
  `;

  if (state.showJsonModal) {
      const jsonEditArea = document.getElementById('json-edit-area');
      const modalContentElement = document.getElementById('json-modal-content'); 
      const modalContentTarget = modalContentElement || jsonEditArea;
      
      if (modalContentTarget && !modalContentTarget.dataset.dndListenersAttached) {
          modalContentTarget.dataset.dndListenersAttached = 'true';
          const dragOverHandler = (e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; modalContentTarget.classList.add('drag-over-active'); };
          const dragLeaveHandler = (e) => { e.preventDefault(); e.stopPropagation(); modalContentTarget.classList.remove('drag-over-active'); };
          const dropHandler = (e) => {
              e.preventDefault(); e.stopPropagation(); modalContentTarget.classList.remove('drag-over-active');
              const files = e.dataTransfer.files;
              if (files.length > 0) {
                  const file = files[0];
                  const reader = new FileReader();
                  reader.onload = (loadEvent) => {
                      state.rawJsonEditContent = loadEvent.target.result;
                      state.jsonValidationMessage = 'File dropped. Validate or Apply & Close.';
                      if (jsonEditArea) jsonEditArea.value = state.rawJsonEditContent;
                  };
                  reader.onerror = () => { state.jsonValidationMessage = '<span style="color: red;">Error reading dropped file.</span>'; };
                  reader.readAsText(file);
              }
          };
          modalContentTarget.addEventListener('dragover', dragOverHandler);
          modalContentTarget.addEventListener('dragleave', dragLeaveHandler);
          modalContentTarget.addEventListener('drop', dropHandler);
          modalContentTarget._dndHandlers = { dragOverHandler, dragLeaveHandler, dropHandler };
      }
  } else {
      const modalContentTarget = document.getElementById('json-modal-content') || document.getElementById('json-edit-area');
      if (modalContentTarget && modalContentTarget.dataset.dndListenersAttached) {
          if (modalContentTarget._dndHandlers) {
              modalContentTarget.removeEventListener('dragover', modalContentTarget._dndHandlers.dragOverHandler);
              modalContentTarget.removeEventListener('dragleave', modalContentTarget._dndHandlers.dragLeaveHandler);
              modalContentTarget.removeEventListener('drop', modalContentTarget._dndHandlers.dropHandler);
              delete modalContentTarget._dndHandlers;
          }
          delete modalContentTarget.dataset.dndListenersAttached;
          modalContentTarget.classList.remove('drag-over-active');
      }
  }

  const newJsonTableElement = appElement.querySelector('.json-table');
  if (newJsonTableElement) {
      if (mainScrollTop !== undefined) newJsonTableElement.scrollTop = mainScrollTop;
      if (mainScrollLeft !== undefined) newJsonTableElement.scrollLeft = mainScrollLeft; 
  }

  if (state.editModeActive) {
      const thElements = appElement.querySelectorAll('table > thead > tr > th[data-column][draggable="true"]');
      thElements.forEach(th => {
          th.addEventListener('dragstart', handleThDragStart);
          th.addEventListener('dragenter', handleThDragEnter);
          th.addEventListener('dragover', handleThDragOver);
          th.addEventListener('dragleave', handleThDragLeave);
          th.addEventListener('drop', handleThDrop);
          th.addEventListener('dragend', handleThDragEnd);
      });
  }

  if (activeElementId) {
      const newActiveElement = document.getElementById(activeElementId);
      if (newActiveElement && document.activeElement !== newActiveElement) { 
          newActiveElement.focus();
          if ((activeElementId === 'json-browser-search-box' || activeElementId === 'json-edit-area') && 
              selectionStart !== undefined && selectionEnd !== undefined) {
              try { newActiveElement.setSelectionRange(selectionStart, selectionEnd); } catch (ex) { /* ignore */ }
          }
      }
  }
  if (state.showJsonModal) {
      const jsonEditArea = document.getElementById('json-edit-area');
      if (jsonEditArea && jsonEditArea.value !== state.rawJsonEditContent) {
          jsonEditArea.value = state.rawJsonEditContent; 
          if (activeElementId === 'json-edit-area' && document.getElementById(activeElementId) === jsonEditArea) {
               try { jsonEditArea.setSelectionRange(selectionStart, selectionEnd); } catch (ex) {/* ignore */}
          }
      }
  }
};
