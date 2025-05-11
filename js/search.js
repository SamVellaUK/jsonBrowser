import { state } from './main.js';
import { splitJsonPath, parseArrayPath  } from './Utils.js';

// Helper function to clear highlights within a specific element
function clearHighlightsInElement(element) {
  if (!element) return;
  element.querySelectorAll('.highlight, .highlight-active').forEach(span => {
    const parent = span.parentNode;
    if (!parent) return;
    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
  });
}

export function performSearch(query) {
  clearHighlights(); 
  state.search.matches = [];
  state.search.domMatches = [];
  state.search.index = -1; 
  state.search.query = '';

  if (!query || !query.trim()) {
    updateSearchCounter(); 
    return;
  }

  const lower = query.toLowerCase();
  state.search.query = lower;

  const allMatches = [];
  state.data.forEach((row, rowIndex) => {
    allMatches.push(...deepSearch(row, rowIndex, lower, query.length)); // Pass query.length for termLength
  });
  state.search.matches = allMatches;

  console.log('[Search] Total logical occurrences found:', state.search.matches.length);

  applySearchHighlightsToNewContent(document.getElementById('data-table'));
}

export function navigateSearch(direction) {
  const totalLogicalMatches = state.search.matches.length;

  if (totalLogicalMatches === 0) {
    console.log('[navigateSearch] No matches to navigate');
    return;
  }

  let newIndex = state.search.index;
  if (direction === 'next') {
    newIndex = (state.search.index + 1) % totalLogicalMatches;
  } else if (direction === 'prev') {
    newIndex = (state.search.index - 1 + totalLogicalMatches) % totalLogicalMatches;
  }
  state.search.index = newIndex;

  const currentLogicalMatch = state.search.matches[state.search.index];
  
  refreshDomMatches(); 

  let visibleSpan = state.search.domMatches.find(
    span => span.dataset.matchKey === currentLogicalMatch.key
  );

  if (visibleSpan) {
    // console.log('[navigateSearch] Span for logical match is visible — highlighting.');
    highlightCurrentMatch(); 
    updateSearchCounter();
    visibleSpan.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }

  console.log('[navigateSearch] Span for logical match hidden — attempting to expand...');
  
  const pathParts = splitJsonPath(currentLogicalMatch.path);
  if (pathParts.length > 0) {
    expandPathSequentially(pathParts, String(currentLogicalMatch.rowIndex), () => {
      refreshDomMatches();
      const success = highlightCurrentMatch(); 
      updateSearchCounter();
      if (success) {
        const newlyVisibleSpan = document.querySelector(`span.highlight-active[data-match-key="${currentLogicalMatch.key}"]`);
        newlyVisibleSpan?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        // console.log('[navigateSearch] Successfully expanded and highlighted match.');
      } else {
        console.log('[navigateSearch] Failed to highlight after expansion. Logical match might still not be visible or DOM attributes mismatch.');
      }
    });
  } else {
    // Path was empty, cannot expand. Highlight based on current DOM.
    highlightCurrentMatch();
    updateSearchCounter();
  }
}

export function highlightCurrentMatch() {
  document.querySelectorAll('span.highlight-active')
    .forEach(el => el.classList.remove('highlight-active'));

  if (state.search.index < 0 || state.search.index >= state.search.matches.length) {
    return false;
  }

  const currentLogicalMatch = state.search.matches[state.search.index];
  if (!currentLogicalMatch) return false;
 
  refreshDomMatches();  // Ensure domMatches is up-to-date

  // Find the specific DOM span that corresponds to the currentLogicalMatch using its unique key
  let target = state.search.domMatches.find(
    span => span.dataset.matchKey === currentLogicalMatch.key
  );
  
  if (!target) {
    // console.log('[highlightCurrentMatch] No matching DOM span found for current logical match key:', currentLogicalMatch.key);
    return false; 
  }

  target.classList.add('highlight-active');
  // Scrolling is handled by navigateSearch to avoid double scroll or scroll on mere re-highlight
  // target.scrollIntoView({ block: 'center', behavior: 'smooth' }); 
  return true;
}

function clearHighlights() {
  clearHighlightsInElement(document.body); 
  // state.search.domMatches = []; // Will be rebuilt by refreshDomMatches
  // state.search.query = ''; // Handled by performSearch
  // state.search.index = -1; // Handled by performSearch
  clearActiveHighlight(); 
}

function clearActiveHighlight() {
  document.querySelectorAll('.highlight-active').forEach(el =>
    el.classList.remove('highlight-active')
  );
}

function deepSearch(root, rowIndex, lowerQuery, termLength) { // Added termLength
  const matches = [];
  const stack = [{ node: root, pathSegments: [] }]; // Renamed 'path' to 'pathSegments' for clarity

  while (stack.length) {
    const { node, pathSegments } = stack.pop();
    if (node == null) continue;

    if (typeof node === 'object') {
      if (Array.isArray(node)) {
        for (let i = node.length - 1; i >= 0; i--) {
          stack.push({ node: node[i], pathSegments: [...pathSegments, `[${i}]`] });
        }
      } else {
        const entries = Object.entries(node);
        for (let k = entries.length - 1; k >= 0; k--) {
          const [key, val] = entries[k];
          stack.push({ node: val, pathSegments: [...pathSegments, key] });
        }
      }
      continue;
    }

    const valueStr = String(node);
    const lowerValue = valueStr.toLowerCase();
    
    let offset = lowerValue.indexOf(lowerQuery);
    while (offset !== -1) {
      const pathStr = pathSegments.reduce((acc, seg) => {
          if (seg.startsWith('[')) return `${acc}${seg}`; 
          return acc ? `${acc}.${seg}` : seg; 
        }, '');

      // Create a unique key for this specific occurrence
      const key = `${rowIndex}|${pathStr}|${offset}`; 
      matches.push({ 
        rowIndex, 
        path: pathStr, 
        value: valueStr, // The full original value string where the term was found
        key, 
        offset,         // The start offset of this specific occurrence
        termLength      // Length of the search term
      });
      offset = lowerValue.indexOf(lowerQuery, offset + 1); // Search for next occurrence
    }
  }
  return matches;
}

export function updateSearchCounter() {
  const counter = document.getElementById('search-counter');
  if (!counter) return;

  const totalLogicalMatches = state.search.matches.length;
  const visibleDomMatchesCount = state.search.domMatches.length;
  
  let currentIndexInUI = 0;
  if (totalLogicalMatches > 0 && state.search.index !== -1) {
      const activeSpan = document.querySelector('span.highlight-active');
      if(activeSpan){
        // Find the 0-based index of the activeSpan within the filtered domMatches array
        const idxInDomMatches = state.search.domMatches.indexOf(activeSpan);
        if(idxInDomMatches !== -1) {
            currentIndexInUI = idxInDomMatches + 1; // 1-based for UI
        } else {
          // Active span exists but not in current domMatches (should not happen if refreshDomMatches is effective)
          // Or if the active span is for a hidden match
          currentIndexInUI = 0; 
        }
      } else if (visibleDomMatchesCount > 0 && state.search.index >=0 && state.search.index < totalLogicalMatches) {
        // A logical match is "current" (state.search.index is valid), but no span is active.
        // This could mean the current logical match is not visible or highlighting failed.
        currentIndexInUI = 0;
      }
  }

  let html = `${currentIndexInUI} of ${visibleDomMatchesCount}`;
  const hiddenCount = totalLogicalMatches - visibleDomMatchesCount;

  if (hiddenCount > 0) {
    html += ` <span style="color: #cc0000; font-size: smaller; margin-left: 8px;">(${hiddenCount} hidden)</span>`;
  } else if (totalLogicalMatches > 0 && visibleDomMatchesCount === 0 && state.search.query) {
    html = `0 of 0 <span style="color: #cc0000; font-size: smaller; margin-left: 8px;">(${totalLogicalMatches} hidden)</span>`;
  } else if (!state.search.query) {
    html = `0 of 0`;
  }
  counter.innerHTML = html;
}

export function applySearchHighlightsToNewContent(root = document.getElementById('data-table')) {
  if (!state.search.query || !root) { // Matches array check removed, allow clearing if query existed but now no matches
    if(root) clearHighlightsInElement(root); 
    refreshDomMatches();
    updateSearchCounter();
    return;
  }
  
  // console.log('[applySearchHighlightsToNewContent] Clearing existing highlights in root and adding new ones.');
  clearHighlightsInElement(root); 

  const lowerQuery = state.search.query;
  const termLength = state.search.query.length; // Use actual query length, not lowerQuery

  const walker = document.createTreeWalker( root, NodeFilter.SHOW_TEXT, {
      acceptNode: node => (node.parentNode?.nodeName === 'SCRIPT' || node.parentNode?.nodeName === 'STYLE') ? NodeFilter.FILTER_REJECT : 
                         node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
    });

  const textNodesToProcess = [];
  let node;
  while ((node = walker.nextNode())) textNodesToProcess.push(node);

  let highlightsAddedCount = 0;

  textNodesToProcess.forEach(textNode => {
    const originalTextValue = textNode.nodeValue; // Full original text of this node
    const lowerTextValue = originalTextValue.toLowerCase();
    
    let cellElement = textNode.parentNode;
    let currentPath = '';
    let isKeyCell = false;

    while (cellElement && cellElement !== root && cellElement.nodeType === Node.ELEMENT_NODE) {
        if (cellElement.hasAttribute('data-path')) {
            currentPath = cellElement.getAttribute('data-path'); break;
        }
        if (cellElement.hasAttribute('data-column-path')) {
            currentPath = cellElement.getAttribute('data-column-path'); break;
        }
        if (cellElement.nodeName === 'TD' && cellElement.matches(':first-child') && cellElement.hasAttribute('data-key')) {
            isKeyCell = true;
            // Construct an approximate path for key cell for matching purposes
            const parentRow = cellElement.closest('tr[data-row-index]');
            const parentPathContainer = parentRow ? parentRow.closest('[data-path]') : null; // Find closest data-path from parent TR
            let baseKeyPath = parentPathContainer ? parentPathContainer.dataset.path : '';
            
            const arrayItemContainer = cellElement.closest('.nested-table[data-parent-path]');
            if(arrayItemContainer && cellElement.parentElement.dataset.arrayIndex !== undefined) { // Cell for an array index itself
                 baseKeyPath = arrayItemContainer.dataset.parentPath + `[${cellElement.parentElement.dataset.arrayIndex}]`;
            } else { // Cell for an object key
                 baseKeyPath = (baseKeyPath ? baseKeyPath + '.' : '') + cellElement.dataset.key;
            }
            currentPath = baseKeyPath;
            break; 
        }
        cellElement = cellElement.parentNode;
    }
    
    let currentRowIndex = null;
    let rowElement = textNode.parentNode;
    while (rowElement && rowElement !== root && rowElement.nodeType === Node.ELEMENT_NODE) {
      if (rowElement.hasAttribute('data-row-index')) {
        currentRowIndex = rowElement.getAttribute('data-row-index'); break;
      }
      rowElement = rowElement.parentNode;
    }
    
    if (currentRowIndex === null || currentPath === '') { // Path can be empty for root level properties in some structures
        // console.warn('[applySearchHighlights] Text node without sufficient row/path context:', originalTextValue);
        // We might still highlight visually but without full logical linking.
        // For now, let's allow highlighting if the text matches, but linking will be partial.
    }

    let matchStartIndex = lowerTextValue.indexOf(lowerQuery);
    if (matchStartIndex === -1) return;

    const frag = document.createDocumentFragment();
    let lastIndex = 0;

    while (matchStartIndex !== -1) {
      if (matchStartIndex > lastIndex) {
        frag.appendChild(document.createTextNode(originalTextValue.substring(lastIndex, matchStartIndex)));
      }

      const matchedText = originalTextValue.substring(matchStartIndex, matchStartIndex + termLength);
      const span = document.createElement('span');
      span.className = 'highlight';
      span.textContent = matchedText;

      // Find the *specific* logical match from state.search.matches
      // Note: isKeyCell may need more refined logic if keys themselves are complex and have paths
      const logicalMatchForThisOccurrence = state.search.matches.find(m => 
        m.path === currentPath && 
        String(m.rowIndex) === String(currentRowIndex) &&
        m.offset === matchStartIndex &&
        m.value === originalTextValue // Ensure it's from the same original full text node value
      );

      if (logicalMatchForThisOccurrence) {
        span.dataset.matchKey = logicalMatchForThisOccurrence.key;
        span.dataset.matchPath = logicalMatchForThisOccurrence.path; 
        span.dataset.rowIndex = String(logicalMatchForThisOccurrence.rowIndex);
      } else if (currentPath !== '' && currentRowIndex !== null) { 
        // Fallback if precise logical match not found (e.g. path mismatch or value discrepancy)
        // This indicates a potential issue in path/value alignment between deepSearch and applySearchHighlights
        // console.warn("Could not find precise logical match for highlight:", {currentPath, currentRowIndex, matchStartIndex, originalTextValue});
        span.dataset.matchPath = currentPath;
        span.dataset.rowIndex = String(currentRowIndex);
        span.dataset.matchKey = `${currentRowIndex}|${currentPath}|${matchStartIndex}`; // Fallback key
      }
      
      frag.appendChild(span);
      highlightsAddedCount++;
      lastIndex = matchStartIndex + termLength;
      matchStartIndex = lowerTextValue.indexOf(lowerQuery, lastIndex);
    }

    if (lastIndex < originalTextValue.length) {
      frag.appendChild(document.createTextNode(originalTextValue.substring(lastIndex)));
    }

    if (textNode.parentNode) {
        textNode.parentNode.replaceChild(frag, textNode);
    } else {
        // console.warn("Text node no longer has a parent during highlighting:", textNode);
    }
  });
  
  // console.log(`[applySearchHighlightsToNewContent] Highlights added/updated: ${highlightsAddedCount}`);
  setTimeout(() => {
    refreshDomMatches(); 
    updateSearchCounter(); 
    highlightCurrentMatch(); 
  }, 0);
}

export function refreshDomMatches() {
  state.search.domMatches = Array.from(
    document.querySelectorAll('span.highlight')
  ).filter(el => el.offsetParent !== null);
}

// expandPathSequentially and findCellForPath remain unchanged from your latest version,
// but ensure rowIndex is consistently passed as a string to findCellForPath if it expects it for attribute selectors.

function expandPathSequentially(pathParts, rowIndexStr, callback, currentDepth = 0) {
  const fullPathToExpand = pathParts.slice(0, currentDepth + 1).reduce((acc, seg) => {
    if (seg.startsWith('[')) return `${acc}${seg}`;
    return acc ? `${acc}.${seg}` : seg;
  }, '');

  // We need to expand containers. The actual value is at the full pathParts length.
  // So we expand up to the parent of the target value.
  if (currentDepth >= pathParts.length -1 && !pathParts[currentDepth].includes('[')) { // If last part is not an array, it's a direct value, no container to expand.
      if (pathParts.length ===1 && !pathParts[0].includes('[')) { // single, non-array path part, e.g. "fieldName"
          // no expansion needed for the value itself, just its parent row.
      } else if (pathParts[currentDepth].includes('[')) {
          // if current part is array like "parent.arr[0]", we expand "parent.arr"
          // then let highlightCurrentMatch find the span within the loaded content.
          // The check above should be currentDepth >= pathParts.length - 1
      } else {
        // console.log("Reached target depth for value, calling callback for path:", fullPathToExpand);
      }
      callback();
      return;
  }


  // console.log(`Attempting to find cell for segment container: ${fullPathToExpand} in row ${rowIndexStr}`);
  const cell = findCellForPath(fullPathToExpand, rowIndexStr); 

  if (!cell) {
      // console.warn(`Cell not found for container: ${fullPathToExpand} in row ${rowIndexStr}. Cannot expand further.`);
      callback(); 
      return;
  }

  const toggle = cell.querySelector(':scope > .toggle-nest');
  const nestedContent = cell.querySelector(':scope > .nested-content');

  if (toggle && nestedContent) {
      const isExpanded = nestedContent.style.display === 'block' || nestedContent.style.display === '';
      
      if (!isExpanded) {
          // console.log(`Expanding container: ${fullPathToExpand}`);
          toggle.click(); 
          
          let checkCount = 0;
          const maxChecks = 40; // Increased checks
          const checkLoaded = () => {
              checkCount++;
              const stillNotExpanded = nestedContent.style.display === 'none';
              // More robust check for content readiness, e.g. specific child indicating data loaded.
              const contentNotReady = nestedContent.childElementCount === 0 && 
                                      !(nestedContent.querySelector('.nested-table') || nestedContent.textContent.length > 10);


              if (!stillNotExpanded && !contentNotReady) {
                  // console.log("Expansion seems complete for:", fullPathToExpand);
                  expandPathSequentially(pathParts, rowIndexStr, callback, currentDepth + 1);
              } else if (checkCount < maxChecks) {
                  // console.log("Waiting for expansion/content for:", fullPathToExpand, {stillNotExpanded, contentNotReady});
                  setTimeout(checkLoaded, 50);
              } else {
                  console.warn("Timeout waiting for expansion/content for:", fullPathToExpand);
                  expandPathSequentially(pathParts, rowIndexStr, callback, currentDepth + 1); 
              }
          };
          setTimeout(checkLoaded, 50); 
          return;
      }
  }
  expandPathSequentially(pathParts, rowIndexStr, callback, currentDepth + 1);
}


function findCellForPath(path, rowIndex) { 
  // console.log(`findCellForPath: path="${path}", rowIndex="${rowIndex}"`);
  let cell = document.querySelector(
      `#data-table tr[data-row-index="${rowIndex}"] td[data-column-path="${path}"]`
  );
  if (cell) return cell;
  
  const rowElement = document.querySelector(`#data-table tr[data-row-index="${rowIndex}"]`);
  if (rowElement) {
    // Search for data-path which should be the exact path to the item the cell represents
    // This should be preferred for nested content.
    const escapedPath = CSS.escape(path); // Use CSS.escape for robust selectors
    cell = rowElement.querySelector(`td[data-path="${escapedPath}"]`);
    if (cell) return cell;

    // Fallback to iterating if direct query fails (e.g. complex paths not easily selectable)
    const allCellsInRow = rowElement.querySelectorAll('td[data-path], td[data-column-path]');
    for(let c of allCellsInRow){
        if(c.dataset.path === path || c.dataset.columnPath === path) return c;
    }
  }
  // console.warn(`findCellForPath: Cell not found for path="${path}", rowIndex="${rowIndex}"`);
  return null;
}