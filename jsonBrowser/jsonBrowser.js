// basic.js

import { state } from './state.js';
// Assuming debounce is in utils.js, otherwise define it here or import differently
import { performSearch, getAllObjectPaths, getValue, robustParseCSV, detectDelimiter, debounce } from './utils.js';
import { render, openModalFocus, closeModalFocus, expandToResult, updateAllPossibleColumns, generateCSV } from './ui.js';

let lastExecutedSearchQuery = null; // Keep this to know if a search has been made

function blurSearchBox() {
    const searchBox = document.getElementById('json-browser-search-box');
    if (searchBox) {
        searchBox.blur();
    }
}

function focusSearchBox() {
    const searchBox = document.getElementById('json-browser-search-box');
    if (searchBox) {
        searchBox.focus();
        searchBox.select(); // Optional: also select existing text
    }
}

// calledFromEnterInSearchBox is true if user pressed Enter while search box was focused.
function executeSearchLogic(calledFromEnterInSearchBox = false) {
    let queryToSearch = state.searchQuery;

    if (calledFromEnterInSearchBox) {
        const searchBox = document.getElementById('json-browser-search-box');
        if (searchBox && searchBox.value !== state.searchQuery) {
            queryToSearch = searchBox.value;
            state.searchQuery = queryToSearch;
        }
    }
    
    if (queryToSearch.trim() === '') {
        state.searchResults = [];
        state.currentSearchIndex = -1;
        lastExecutedSearchQuery = null; 
        state.notify('searchResults'); // This will also trigger re-render using the new currentSearchIndex
    } else {
        state.searchResults = performSearch(state.data, queryToSearch);
        const oldSearchIndex = state.currentSearchIndex;
        state.currentSearchIndex = state.searchResults.length > 0 ? 0 : -1;
        lastExecutedSearchQuery = queryToSearch;
        
        state.notify('searchResults'); // Notifies about the new list and its length.
        // If currentSearchIndex changed and searchResults notification doesn't implicitly handle it for render, notify explicitly.
        // However, usually a 'searchResults' change implies re-evaluation of highlights based on currentSearchIndex.
        // For robustness, if currentSearchIndex changed meaningfully (e.g. from -1 to 0, or 0 to -1)
        // and the 'searchResults' notification isn't guaranteed to refresh highlighting logic for the index:
        if (state.currentSearchIndex !== oldSearchIndex && state.currentSearchIndex !== -1) { // Check if it actually changed to a valid index
             // state.notify('currentSearchIndex'); // Potentially redundant if render() always uses latest state.currentSearchIndex
                                                 // when 'searchResults' changes. Let's assume render is robust.
        }

        if (state.searchResults.length > 0 && state.currentSearchIndex !== -1) {
            expandToResult(state.searchResults[state.currentSearchIndex]);
        }
        // No explicit 'else { state.notify('searchResults'); }' needed here as it's covered by the initial notify or the one above.
    }
    // Blurring is now handled by the explicit action callers (Enter in box, Search button)
}

const debouncedExecuteSearch = debounce(() => executeSearchLogic(false), 300); // 300ms delay

const handleKeyboard = (e) => {
  const searchBox = document.getElementById('json-browser-search-box');
  const searchBoxFocused = document.activeElement === searchBox;
  const jsonEditAreaFocused = e.target.id === 'json-edit-area';
  const inModal = e.target.closest('.modal');
  const inPromotePopover = e.target.closest('#promote-key-popover');
  const inAddColumnPopover = e.target.closest('#add-column-popover');

  // CTRL+F / CMD+F to focus search box
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    if (!jsonEditAreaFocused && !e.target.matches('textarea:not(#json-browser-search-box)')) {
        e.preventDefault();
        focusSearchBox();
        return; 
    }
  }

  if (e.key === 'Enter') {
    if (searchBoxFocused) {
      e.preventDefault();
      executeSearchLogic(true); 
      blurSearchBox();          
    } else if (state.searchResults.length > 0 && lastExecutedSearchQuery !== null) {
      e.preventDefault();
      state.currentSearchIndex = (state.currentSearchIndex + 1) % state.searchResults.length;
      state.notify('currentSearchIndex'); // Notify that the active search result index has changed
      expandToResult(state.searchResults[state.currentSearchIndex]);
    }
  } else if (e.key === 'Escape') {
    if (searchBoxFocused) {
        e.preventDefault();
        state.searchQuery = '';
        if(searchBox) searchBox.value = '';
        state.searchResults = [];
        state.currentSearchIndex = -1;
        lastExecutedSearchQuery = null; 
        state.notify('searchResults'); // Covers currentSearchIndex update too
        blurSearchBox(); 
    } else if (state.showAddColumnPopover) { 
        e.preventDefault();
        const cancelButton = document.querySelector('#add-column-popover .add-column-popover-cancel-btn');
        if (cancelButton) cancelButton.click();
        else {
            closeModalFocus('#add-column-popover');
            state.showAddColumnPopover = false;
            if (state.addColumnPopoverAnchor) state.addColumnPopoverAnchor.focus();
            state.addColumnPopoverAnchor = null;
            state.notify('showAddColumnPopover');
        }
    } else if (state.showPromoteKeyPopover) { 
        e.preventDefault();
        const cancelButton = document.querySelector('#promote-key-popover .promote-popover-cancel-btn');
        if (cancelButton) cancelButton.click();
        else {
            closeModalFocus('#promote-key-popover');
            state.showPromoteKeyPopover = false;
            if (state.promoteKeyPopoverContext && state.promoteKeyPopoverContext.triggerElement) {
                state.promoteKeyPopoverContext.triggerElement.focus();
            }
            state.promoteKeyPopoverContext = null;
            state.notify('showPromoteKeyPopover');
        }
    } else if (state.showSqlModal && inModal) { 
        e.preventDefault();
        closeModalFocus('.modal[aria-labelledby="sql-modal-title"]');
        state.showSqlModal = false; state.notify('showSqlModal');
    } else if (state.showCsvModal && inModal) { 
        e.preventDefault();
        closeModalFocus('.modal[aria-labelledby="csv-modal-title"]');
        state.showCsvModal = false; state.notify('showCsvModal');
    } else if (state.showJsonModal && inModal && !jsonEditAreaFocused) { 
        e.preventDefault();
        closeModalFocus('.modal[aria-labelledby="json-modal-title"]');
        state.showJsonModal = false; state.jsonValidationMessage = '';
        state.notify('showJsonModal');
    } else if (state.editModeActive && !searchBoxFocused && !jsonEditAreaFocused && !inModal && !inPromotePopover && !inAddColumnPopover) {
        e.preventDefault();
        state.editModeActive = false; state.notify('editModeActive');
    }
  }

  if ((e.key === 'Enter' || e.key === ' ') &&
      (e.target.matches('.expandable[role="button"]') || e.target.matches('th[role="button"]'))) {
      if (! (e.key === 'Enter' && (searchBoxFocused || (state.searchResults.length > 0 && lastExecutedSearchQuery !== null) ) ) ) {
        e.preventDefault();
        e.target.click();
      }
  }
};

const handleEvent = (e) => {
  const eventTarget = e.target;

  if (state.showAddColumnPopover) {
      const popoverElement = document.querySelector('#add-column-popover');
      const clickedAddColumnButton = eventTarget.closest('[data-action="show-add-column-popover"]');
      const clickedInsidePopover = popoverElement && popoverElement.contains(eventTarget);
      if (!clickedInsidePopover && !clickedAddColumnButton) {
          const cancelButton = document.querySelector('#add-column-popover .add-column-popover-cancel-btn');
          if (cancelButton) cancelButton.click(); else { closeModalFocus('#add-column-popover'); state.showAddColumnPopover = false; if (state.addColumnPopoverAnchor) state.addColumnPopoverAnchor.focus(); state.addColumnPopoverAnchor = null; state.notify('showAddColumnPopover');}
      }
  }
  if (state.showPromoteKeyPopover) {
      const popoverElement = document.querySelector('#promote-key-popover');
      const clickedPromoteButton = eventTarget.closest('[data-action="promote-value"]');
      const clickedInsidePopover = popoverElement && popoverElement.contains(eventTarget);
      if (!clickedInsidePopover && !clickedPromoteButton) {
          const cancelButton = document.querySelector('#promote-key-popover .promote-popover-cancel-btn');
           if (cancelButton) cancelButton.click(); else { closeModalFocus('#promote-key-popover'); state.showPromoteKeyPopover = false; if (state.promoteKeyPopoverContext && state.promoteKeyPopoverContext.triggerElement) state.promoteKeyPopoverContext.triggerElement.focus(); state.promoteKeyPopoverContext = null; state.notify('showPromoteKeyPopover');}
      }
  }

  let target = eventTarget;
  let action = target.dataset.action;

  if (!action && target.closest('[data-action]')) {
      target = target.closest('[data-action]');
      action = target.dataset.action;
  }
  if (!action) return;

  const { path, row, column } = target.dataset;

  switch (action) {
    case 'search': 
      if (state.searchQuery !== target.value) {
        state.searchQuery = target.value;
        if (state.searchQuery.trim() === '') {
            state.searchResults = [];
            state.currentSearchIndex = -1;
            lastExecutedSearchQuery = null;
            state.notify('searchResults'); // Covers currentSearchIndex update
        } else {
            debouncedExecuteSearch();
        }
      }
      break;
    case 'execute-search': 
        const searchInput = document.getElementById('json-browser-search-box');
        if (searchInput && state.searchQuery !== searchInput.value) {
            state.searchQuery = searchInput.value;
        }
        executeSearchLogic(false); 
        blurSearchBox();           
        break;
    case 'search-next':
      if (state.searchResults.length > 0) {
        state.currentSearchIndex = (state.currentSearchIndex + 1) % state.searchResults.length;
        state.notify('currentSearchIndex'); // Notify that the active search result index has changed
        expandToResult(state.searchResults[state.currentSearchIndex]);
      }
      break;
    case 'search-prev':
      if (state.searchResults.length > 0) {
        state.currentSearchIndex = (state.currentSearchIndex - 1 + state.searchResults.length) % state.searchResults.length;
        state.notify('currentSearchIndex'); // Notify that the active search result index has changed
        expandToResult(state.searchResults[state.currentSearchIndex]);
      }
      break;
    case 'toggle':
      const expandKey = `${row}-${path}`;
      if (state.expandedPaths.has(expandKey)) state.expandedPaths.delete(expandKey);
      else state.expandedPaths.add(expandKey);
      state.notify('expandedPaths');
      break;
    case 'expand-all':
      state.data.forEach((rowData, rowIndex) => {
        getAllObjectPaths(rowData).forEach(itemPath => state.expandedPaths.add(`${rowIndex}-${itemPath}`));
      });
      state.notify('expandedPaths');
      break;
    case 'collapse-all':
      state.expandedPaths.clear();
      state.notify('expandedPaths');
      break;
    case 'toggle-paths':
      state.showPaths = !state.showPaths;
      state.notify('showPaths');
      break;
    case 'toggle-edit-mode':
      state.editModeActive = !state.editModeActive;
      if (!state.editModeActive) {
          if (state.showPromoteKeyPopover) { state.showPromoteKeyPopover = false; state.promoteKeyPopoverContext = null; state.notify('showPromoteKeyPopover'); }
          if (state.showAddColumnPopover) { state.showAddColumnPopover = false; state.addColumnPopoverAnchor = null; state.notify('showAddColumnPopover'); }
      }
      state.notify('editModeActive'); 
      break;
    case 'promote-value':
      const pathClicked = target.dataset.pathToValue;
      const rowIndexForContext = parseInt(target.dataset.rowIndex);
      const rowData = state.data[rowIndexForContext];
      const lastDotIndex = pathClicked.lastIndexOf('.');
      if (lastDotIndex === -1) {
          if (!state.visibleColumns.includes(pathClicked)) {
              state.visibleColumns = [...state.visibleColumns, pathClicked];
              updateAllPossibleColumns();
              state.notify('visibleColumns');
          }
          if (state.showPromoteKeyPopover) { state.showPromoteKeyPopover = false; state.promoteKeyPopoverContext = null; state.notify('showPromoteKeyPopover'); }
          break;
      }
      const parentObjectPath = pathClicked.substring(0, lastDotIndex);
      const fieldName = pathClicked.substring(lastDotIndex + 1);
      const arrayElementMatch = parentObjectPath.match(/^(.*)\[(\d+)\]$/);
      if (arrayElementMatch) {
          const pathToArrayElement = parentObjectPath;
          const objectInArray = getValue(rowData, pathToArrayElement);
          if (objectInArray && typeof objectInArray === 'object' && !Array.isArray(objectInArray)) {
              const siblingKeysAndValues = [];
              for (const key in objectInArray) {
                  const val = objectInArray[key];
                  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
                      siblingKeysAndValues.push({ key, value: val });
                  }
              }
              if (siblingKeysAndValues.length > 0) {
                  state.promoteKeyPopoverContext = {
                      rowIndex: rowIndexForContext, originalPathToValue: pathClicked,
                      pathToArrayElement: pathToArrayElement, valueFieldName: fieldName,
                      targetElementRect: target.getBoundingClientRect(), siblingKeysAndValues,
                      triggerElement: target,
                  };
                  state.showPromoteKeyPopover = true;
                  state.notify('showPromoteKeyPopover');
                  return; 
              }
          }
      }
      if (!state.visibleColumns.includes(pathClicked)) {
          state.visibleColumns = [...state.visibleColumns, pathClicked];
          updateAllPossibleColumns();
          state.notify('visibleColumns');
      }
      if (state.showPromoteKeyPopover) { state.showPromoteKeyPopover = false; state.promoteKeyPopoverContext = null; state.notify('showPromoteKeyPopover');}
      break;
    case 'confirm-promote-with-key':
      if (!state.promoteKeyPopoverContext) break;
      const { rowIndex, originalPathToValue, pathToArrayElement, valueFieldName, triggerElement: promoteTrigger } = state.promoteKeyPopoverContext;
      const selectedKeyForId = target.dataset.selectedKey;
      const rowDataForPromotion = state.data[rowIndex];
      let pathToPromote;
      if (selectedKeyForId === 'INDEX') {
          pathToPromote = originalPathToValue;
      } else {
          const arrayBasePath = pathToArrayElement.substring(0, pathToArrayElement.lastIndexOf('['));
          const objectInArray = getValue(rowDataForPromotion, pathToArrayElement);
          if (objectInArray && typeof objectInArray === 'object' && objectInArray.hasOwnProperty(selectedKeyForId)) {
              const identifyingKeyValue = String(objectInArray[selectedKeyForId]);
              const safeIdentifyingKeyValue = identifyingKeyValue.replace(/"/g, '\\"');
              pathToPromote = `${arrayBasePath}[${selectedKeyForId}="${safeIdentifyingKeyValue}"].${valueFieldName}`;
          } else {
              pathToPromote = originalPathToValue;
              console.warn("Could not find selected key for promotion, falling back to index path.");
          }
      }
      if (!state.visibleColumns.includes(pathToPromote)) {
          state.visibleColumns = [...state.visibleColumns, pathToPromote];
          updateAllPossibleColumns();
          state.notify('visibleColumns');
      }
      closeModalFocus('#promote-key-popover');
      state.showPromoteKeyPopover = false;
      state.promoteKeyPopoverContext = null;
      state.notify('showPromoteKeyPopover');
      if (promoteTrigger) requestAnimationFrame(() => promoteTrigger.focus());
      break;
    case 'cancel-promote-popover':
      const promoteAnchor = state.promoteKeyPopoverContext ? state.promoteKeyPopoverContext.triggerElement : null;
      closeModalFocus('#promote-key-popover');
      state.showPromoteKeyPopover = false;
      state.promoteKeyPopoverContext = null;
      state.notify('showPromoteKeyPopover');
      if (promoteAnchor) requestAnimationFrame(() => promoteAnchor.focus());
      break;
    case 'sort':
        const sortColumn = decodeURIComponent(column);
        if (state.sortBy === sortColumn) state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        else { state.sortBy = sortColumn; state.sortDirection = 'asc'; }
        state.notify('sort');
        break;
    case 'remove-column-header':
        const colToRemove = decodeURIComponent(target.dataset.column);
        state.visibleColumns = state.visibleColumns.filter(c => c !== colToRemove);
        if (state.sortBy === colToRemove) { state.sortBy = null; state.sortDirection = 'asc'; } // Reset sort if sorted column is removed
        state.notify('visibleColumns'); // Notify about visibleColumns change
        state.notify('sort'); // Also notify sort, in case sortBy was reset
        break;
    case 'show-sql': state.showSqlModal = true; state.notify('showSqlModal'); break;
    case 'close-sql':
      closeModalFocus('.modal[aria-labelledby="sql-modal-title"]');
      state.showSqlModal = false;
      state.notify('showSqlModal');
      break;
    case 'change-dialect': state.sqlDialect = target.value; state.notify('sqlDialect'); break;
    case 'copy-sql':
      {
        const sqlOutputElement = document.querySelector('.sql-output');
        if (sqlOutputElement) {
          navigator.clipboard.writeText(sqlOutputElement.value).then(() => {
            target.textContent = 'Copied!'; setTimeout(() => target.textContent = 'Copy', 2000);
          }).catch(err => {
              console.error('Failed to copy SQL: ', err);
              target.textContent = 'Failed!'; setTimeout(() => target.textContent = 'Copy', 2000);
          });
        }
      }
      break;
    case 'show-json':
      if (!state.showJsonModal) {
        try {
          state.rawJsonEditContent = state.data.length > 0 ? JSON.stringify(state.data, null, 2) : '';
        } catch (e) {
           console.error("Error stringifying data for JSON modal:", e);
           state.rawJsonEditContent = "Error: Could not serialize current data. Please clear and paste new data.";
        }
        state.jsonValidationMessage = state.data.length === 0 ? 'Paste or load data.' : '';
      }
      state.showJsonModal = true;
      state.notify('showJsonModal'); 
      break;
    case 'close-json':
      closeModalFocus('.modal[aria-labelledby="json-modal-title"]');
      state.showJsonModal = false; state.jsonValidationMessage = '';
      state.notify('showJsonModal');
      break;
    case 'trigger-file-load':
      document.getElementById('json-file-input')?.click();
      break;
    case 'clear-json':
      state.rawJsonEditContent = '';
      const jsonEditAreaForClear = document.getElementById('json-edit-area');
      if (jsonEditAreaForClear) jsonEditAreaForClear.value = '';
      state.jsonValidationMessage = 'Paste or load data.';
      state.notify('rawJsonEditContent'); 
      state.notify('jsonValidationMessage');
      break;
    case 'select-all-json':
      const jsonEditAreaSelect = document.getElementById('json-edit-area');
      if (jsonEditAreaSelect) { jsonEditAreaSelect.focus(); jsonEditAreaSelect.select(); }
      break;
    case 'copy-json':
      const jsonEditAreaCopy = document.getElementById('json-edit-area');
      if (jsonEditAreaCopy) {
          navigator.clipboard.writeText(jsonEditAreaCopy.value).then(() => {
              state.jsonValidationMessage = '<span style="color: green;">Copied to clipboard!</span>';
              state.notify('jsonValidationMessage');
          }).catch(err => {
              console.error('Failed to copy JSON: ', err);
              state.jsonValidationMessage = '<span style="color: red;">Failed to copy.</span>';
              state.notify('jsonValidationMessage');
          });
      }
      break;
    case 'validate-json':
      try {
        const jsonEditAreaVal = document.getElementById('json-edit-area');
        const currentTextVal = jsonEditAreaVal ? jsonEditAreaVal.value : state.rawJsonEditContent;
        const parsedJson = JSON.parse(currentTextVal);
        state.rawJsonEditContent = JSON.stringify(parsedJson, null, 2); 
        state.jsonValidationMessage = '<span style="color: green;">JSON is valid.</span>';
      } catch (err) {
        state.jsonValidationMessage = `<span style="color: red;">Invalid JSON: ${err.message}</span>`;
      }
      state.notify('jsonValidationMessage'); 
      state.notify('rawJsonEditContent');   
      break;
    case 'apply-json-changes':
      {
          const jsonEditAreaApply = document.getElementById('json-edit-area');
          const currentTextApply = jsonEditAreaApply ? jsonEditAreaApply.value : state.rawJsonEditContent;
          let parsedData = null; let parseMethod = ''; let detectedHeaders = [];
          robustParseCSV.lastHeaders = []; 
          if (currentTextApply.trim() === '') { parsedData = []; parseMethod = 'empty'; }
          else {
              try {
                  const jsonData = JSON.parse(currentTextApply);
                  if (Array.isArray(jsonData)) { parsedData = jsonData; parseMethod = 'JSON'; }
                  else if (typeof jsonData === 'object' && jsonData !== null) { parsedData = [jsonData]; parseMethod = 'JSON (single object)';}
              } catch (e) {  }

              if (parsedData === null) { 
                  try {
                      const delimiter = detectDelimiter(currentTextApply.substring(0, Math.min(currentTextApply.length, 2000)));
                      const csvObjects = robustParseCSV(currentTextApply, delimiter);
                      detectedHeaders = robustParseCSV.lastHeaders; 
                      if (csvObjects.length > 0 || (detectedHeaders.length > 0 && detectedHeaders.some(h => h !== ''))) {
                         parsedData = csvObjects; parseMethod = delimiter === '\t' ? 'TSV' : 'CSV';
                         if (csvObjects.length === 0 && detectedHeaders.length > 0) parseMethod += ' (headers only)';
                      }
                  } catch (csvErr) { console.error("CSV parsing error during apply:", csvErr); }
              }
          }

          if (parsedData !== null) {
              state.data = parsedData;
              closeModalFocus('.modal[aria-labelledby="json-modal-title"]');
              state.showJsonModal = false; state.jsonValidationMessage = '';
              let newVisibleColumns = [];
              if (detectedHeaders.length > 0 && detectedHeaders.some(h => h && h.trim() !== '')) {
                newVisibleColumns = detectedHeaders.filter(h => h && h.trim() !== '');
              } else if (state.data.length > 0 && typeof state.data[0] === 'object' && state.data[0] !== null) {
                newVisibleColumns = Object.keys(state.data[0]); 
              }
              state.visibleColumns = newVisibleColumns;
              updateAllPossibleColumns(); 
              state.searchQuery = ''; state.searchResults = []; state.currentSearchIndex = -1;
              lastExecutedSearchQuery = null; 
              state.expandedPaths.clear(); state.sortBy = null;
              state.notify('dataApplied'); 
              console.log(`Data applied successfully using ${parseMethod} parser.`);
          } else {
              state.jsonValidationMessage = '<span style="color: red;">Cannot apply: Invalid data format. Not recognized as JSON, CSV, or TSV.</span>';
              state.notify('jsonValidationMessage');
          }
      }
      break;
    case 'show-add-column-popover':
      state.addColumnPopoverAnchor = target; state.showAddColumnPopover = true;
      state.notify('showAddColumnPopover');
      break;
    case 'cancel-add-column-popover':
      const addColumnAnchor = state.addColumnPopoverAnchor;
      closeModalFocus('#add-column-popover');
      state.showAddColumnPopover = false; state.addColumnPopoverAnchor = null;
      state.notify('showAddColumnPopover');
      if (addColumnAnchor) requestAnimationFrame(() => addColumnAnchor.focus());
      break;
    case 'add-column-from-popover':
      const columnToAdd = target.dataset.columnToAdd;
      if (columnToAdd && !state.visibleColumns.includes(columnToAdd)) {
          state.visibleColumns = [...state.visibleColumns, columnToAdd];
          state.notify('visibleColumns');
      }
      break;
    case 'reset-view':
      state.searchQuery = '';
      const searchBoxReset = document.getElementById('json-browser-search-box');
      if (searchBoxReset) searchBoxReset.value = '';
      state.searchResults = []; state.currentSearchIndex = -1;
      lastExecutedSearchQuery = null; 
      state.sortBy = null; state.sortDirection = 'asc'; state.expandedPaths.clear();

      let resetToColumns = [];
      if (robustParseCSV.lastHeaders && robustParseCSV.lastHeaders.length > 0 && robustParseCSV.lastHeaders.some(h => h && h.trim() !== '')) {
          resetToColumns = robustParseCSV.lastHeaders.filter(h => h && h.trim() !== '');
      }
      else if (state.data.length > 0 && state.data[0] && typeof state.data[0] === 'object' && state.data[0] !== null) {
          resetToColumns = Object.keys(state.data[0]);
      }
      state.visibleColumns = [...resetToColumns];
      updateAllPossibleColumns();
      state.notify('viewReset');
      break;
    case 'show-csv':
      state.csvOutputContent = generateCSV(); state.showCsvModal = true;
      state.notify('showCsvModal');
      break;
    case 'close-csv':
      closeModalFocus('.modal[aria-labelledby="csv-modal-title"]');
      state.showCsvModal = false;
      state.notify('showCsvModal');
      break;
    case 'copy-csv':
      {
        const csvOutputArea = document.getElementById('csv-output-area');
        if (csvOutputArea) {
          navigator.clipboard.writeText(csvOutputArea.value).then(() => {
            target.textContent = 'Copied!'; setTimeout(() => { target.textContent = 'Copy CSV'; }, 2000);
          }).catch(err => {
            console.error('Failed to copy CSV: ', err);
            target.textContent = 'Failed!'; setTimeout(() => { target.textContent = 'Copy CSV'; }, 2000);
          });
        }
      }
      break;
    case 'download-csv':
      {
        const blob = new Blob([state.csvOutputContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
          const url = URL.createObjectURL(blob);
          link.setAttribute("href", url); link.setAttribute("download", "export.csv");
          link.style.visibility = 'hidden'; document.body.appendChild(link);
          link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
        } else {
          alert("CSV download not supported. Please use 'Copy CSV'.");
        }
      }
      break;

  }
};

const init = async () => {
  try {
    let rawDataInput; let dataSuccessfullyLoaded = false;
    robustParseCSV.lastHeaders = [];
    if (typeof window.jsonData !== 'undefined') {
        rawDataInput = window.jsonData;
        console.log("Global `jsonData` found and used.");
    } else {
        rawDataInput = null;
        console.log("Global `jsonData` not found.");
    }

    if (rawDataInput !== null) {
      if (Array.isArray(rawDataInput)) {
          state.data = rawDataInput; dataSuccessfullyLoaded = true;
      } else if (typeof rawDataInput === 'string') {
          try {
              const parsedJsonAttempt = JSON.parse(rawDataInput);
              if (Array.isArray(parsedJsonAttempt)) state.data = parsedJsonAttempt;
              else if (typeof parsedJsonAttempt === 'object' && parsedJsonAttempt !== null) state.data = [parsedJsonAttempt];
              else { // If not array or object, try CSV/TSV (e.g. if it's just a string "foo" which is valid JSON)
                  const delimiter = detectDelimiter(rawDataInput.substring(0, Math.min(rawDataInput.length, 2000)));
                  state.data = robustParseCSV(rawDataInput, delimiter);
              }
              dataSuccessfullyLoaded = true;
          } catch (e) {
              console.warn("Initial data (string) parsing as JSON failed, trying CSV/TSV.", e);
              const delimiter = detectDelimiter(rawDataInput.substring(0, Math.min(rawDataInput.length, 2000)));
              state.data = robustParseCSV(rawDataInput, delimiter); // robustParseCSV handles empty/malformed
              dataSuccessfullyLoaded = true;
          }
      } else if (typeof rawDataInput === 'object' && rawDataInput !== null) {
          state.data = [rawDataInput]; dataSuccessfullyLoaded = true;
      }
    }
    if (!dataSuccessfullyLoaded || !Array.isArray(state.data)) state.data = [];

    let initialVisible = [];
    if (robustParseCSV.lastHeaders && robustParseCSV.lastHeaders.length > 0 && robustParseCSV.lastHeaders.some(h => h && h.trim() !== '')) {
        initialVisible = robustParseCSV.lastHeaders.filter(h => h && h.trim() !== '');
    } else if (state.data.length > 0 && typeof state.data[0] === 'object' && state.data[0] !== null) {
        initialVisible = Object.keys(state.data[0]);
    }
    state.visibleColumns = initialVisible;
    updateAllPossibleColumns();

    if (state.data.length === 0 && typeof window.jsonData === 'undefined') {
      state.showJsonModal = true; state.rawJsonEditContent = '';
      state.jsonValidationMessage = 'Paste JSON, CSV, or TSV data, or load from file.';
    }

    state.subscribe((changedProperty) => {
        const wasSqlModalVisible = !!document.querySelector('.modal[aria-labelledby="sql-modal-title"]');
        const wasJsonModalVisible = !!document.querySelector('.modal[aria-labelledby="json-modal-title"]');
        const wasCsvModalVisible = !!document.querySelector('.modal[aria-labelledby="csv-modal-title"]');
        const wasAddColumnPopoverVisible = !!document.getElementById('add-column-popover'); // Check actual element existence
        const wasPromotePopoverVisible = !!document.getElementById('promote-key-popover'); // Check actual element existence
        
        render();

        if (state.showSqlModal && !wasSqlModalVisible) openModalFocus('.modal[aria-labelledby="sql-modal-title"]');
        if (state.showJsonModal && !wasJsonModalVisible) {
            const jsonModal = document.querySelector('.modal[aria-labelledby="json-modal-title"]');
            // Only focus if the modal itself or one of its children doesn't already have focus
            if (!jsonModal || !jsonModal.contains(document.activeElement)) {
                openModalFocus('.modal[aria-labelledby="json-modal-title"]');
            }
        }
        if (state.showCsvModal && !wasCsvModalVisible) openModalFocus('.modal[aria-labelledby="csv-modal-title"]');
        // For popovers, focus logic is often tied to their anchor or first focusable element within.
        // openModalFocus for popovers should be called after they are rendered and visible.
        if (state.showAddColumnPopover && !wasAddColumnPopoverVisible) {
             requestAnimationFrame(() => openModalFocus('#add-column-popover'));
        }
        if (state.showPromoteKeyPopover && !wasPromotePopoverVisible) {
            requestAnimationFrame(() => openModalFocus('#promote-key-popover'));
        }
    });

    document.addEventListener('click', handleEvent);
    document.addEventListener('input', (e) => {
      const target = e.target;
      if (target.id === 'json-browser-search-box') {
          handleEvent(e); 
      } else if (target.id === 'json-edit-area') {
          if (state.rawJsonEditContent !== target.value) {
              state.rawJsonEditContent = target.value;
          }
          // Clear validation message on input if it's an error/success message or initial prompt
          if (state.jsonValidationMessage && (state.jsonValidationMessage.includes('color: red') || state.jsonValidationMessage.includes('color: green') || state.jsonValidationMessage.startsWith("Paste") || state.jsonValidationMessage.startsWith("File loaded") || state.jsonValidationMessage.startsWith("File dropped"))) {
              state.jsonValidationMessage = ''; // Just clear, don't notify yet, render will pick it up or further actions.
              state.notify('jsonValidationMessage'); // Explicitly notify to clear message from UI
          }
      }
    });
    document.addEventListener('change', (e) => {
      const target = e.target;
      if (target?.dataset?.action === "change-dialect") handleEvent(e);
      else if (target.id === 'json-file-input' && target.files) {
          const file = target.files[0];
          if (file) {
              const reader = new FileReader();
              reader.onload = (loadEvent) => {
                  if (loadEvent.target && typeof loadEvent.target.result === 'string') {
                      state.rawJsonEditContent = loadEvent.target.result;
                      state.jsonValidationMessage = 'File loaded. Validate JSON or Apply & Close.';
                       // Notify both raw content and validation message to ensure UI updates
                      state.notify('rawJsonEditContent');
                      state.notify('jsonValidationMessage'); 
                  } else {
                      state.jsonValidationMessage = '<span style="color: red;">Error: Could not read file content.</span>';
                      state.notify('jsonValidationMessage');
                  }
                  target.value = ''; // Reset file input
              };
              reader.onerror = () => {
                  state.jsonValidationMessage = '<span style="color: red;">Error reading file.</span>';
                  state.notify('jsonValidationMessage');
                  target.value = ''; // Reset file input
              };
              reader.readAsText(file);
          }
      }
    });
    document.addEventListener('keydown', handleKeyboard); 
    render(); 
  } catch (error) {
    console.error('Initialization error:', error);
    const appElement = document.getElementById('app');
    if (appElement) appElement.innerHTML = `<div class="no-results" style="color: red; border: 1px solid red; padding: 20px;">Initialization Error: ${error.message}<br><pre>${error.stack}</pre></div>`;
  }
};

if (typeof window.jsonData === 'undefined' && (document.readyState === 'loading' || document.readyState === 'interactive')) {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}