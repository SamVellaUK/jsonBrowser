import { state } from './main.js';
import { splitJsonPath, parsePathSegment } from './Utils.js';

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
    allMatches.push(...deepSearch(row, rowIndex, lower, query.length));
  });
  state.search.matches = allMatches;

  console.log('[Search] Total logical occurrences found:', state.search.matches.length);

  applySearchHighlightsToNewContent(document.getElementById('data-table'));
  
  // Auto-highlight the first match if any matches exist
  if (state.search.matches.length > 0) {
    state.search.index = 0;
    setTimeout(() => {
      const firstMatch = state.search.matches[0];
      const visibleSpan = state.search.domMatches.find(span => span.dataset.matchKey === firstMatch.key);
      
      if (visibleSpan) {
        // First match is already visible
        highlightCurrentMatch();
        updateSearchCounter();
        visibleSpan.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } else {
        // First match needs expansion
        navigateToFirstMatch();
      }
    }, 50);
  }
}

function navigateToFirstMatch() {
  const firstMatch = state.search.matches[0];
  const pathParts = splitJsonPath(firstMatch.path);
  
  if (pathParts.length === 0) {
    highlightCurrentMatch();
    updateSearchCounter();
    return;
  }

  expandPathSequentially(pathParts, String(firstMatch.rowIndex), () => {
    setTimeout(() => {
      // Re-apply search highlights to ensure newly expanded content gets highlighted correctly
      applySearchHighlightsToNewContent(document.getElementById('data-table'));
      
      setTimeout(() => {
        refreshDomMatches();
        highlightCurrentMatch();
        updateSearchCounter();
        
        const activeSpan = document.querySelector('span.highlight-active');
        if (activeSpan) {
          activeSpan.scrollIntoView({ block: 'center', behavior: 'instant' });
        }
      }, 50);
    }, 100);
  });
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
  console.log(`[navigateSearch] Navigating to match ${newIndex + 1}/${totalLogicalMatches}:`, currentLogicalMatch);
  
  // Always refresh DOM matches first
  refreshDomMatches(); 

  // Try to find the current match in visible DOM
  let visibleSpan = state.search.domMatches.find(
    span => span.dataset.matchKey === currentLogicalMatch.key
  );

  if (visibleSpan) {
    console.log('[navigateSearch] Match is already visible, highlighting it');
    highlightCurrentMatch(); 
    updateSearchCounter();
    visibleSpan.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }

  console.log('[navigateSearch] Match is hidden, attempting to expand path:', currentLogicalMatch.path);
  
  // The match needs to be expanded
  const pathParts = splitJsonPath(currentLogicalMatch.path);
  
  if (pathParts.length === 0) {
    console.log('[navigateSearch] No path parts to expand');
    highlightCurrentMatch();
    updateSearchCounter();
    return;
  }

  expandPathSequentially(pathParts, String(currentLogicalMatch.rowIndex), () => {
    console.log('[navigateSearch] Expansion complete, refreshing and highlighting');
    
    // Give DOM time to stabilize after expansion
    setTimeout(() => {
      // Re-apply search highlights to the entire document to ensure newly expanded content gets highlighted
      applySearchHighlightsToNewContent(document.getElementById('data-table'));
      
      // Small delay to let highlighting complete
      setTimeout(() => {
        refreshDomMatches();
        const success = highlightCurrentMatch();
        updateSearchCounter();
        
        if (success) {
          const activeSpan = document.querySelector('span.highlight-active');
          if (activeSpan) {
            activeSpan.scrollIntoView({ block: 'center', behavior: 'instant' });
          }
        } else {
          console.warn('[navigateSearch] Still failed to highlight after re-applying highlights');
        }
      }, 50);
    }, 100);
  });
}

export function highlightCurrentMatch() {
  // Clear all previous active highlights
  document.querySelectorAll('span.highlight-active')
    .forEach(el => el.classList.remove('highlight-active'));

  if (state.search.index < 0 || state.search.index >= state.search.matches.length) {
    console.log('[highlightCurrentMatch] Invalid search index');
    return false;
  }

  const currentLogicalMatch = state.search.matches[state.search.index];
  if (!currentLogicalMatch) {
    console.log('[highlightCurrentMatch] No current logical match');
    return false;
  }
 
  // Ensure domMatches is up-to-date
  refreshDomMatches();

  console.log(`[highlightCurrentMatch] Looking for match:`, {
    key: currentLogicalMatch.key,
    path: currentLogicalMatch.path,
    rowIndex: currentLogicalMatch.rowIndex,
    availableSpans: state.search.domMatches.length
  });

  // Find the specific DOM span that corresponds to the currentLogicalMatch using its unique key
  let target = state.search.domMatches.find(
    span => span.dataset.matchKey === currentLogicalMatch.key
  );
  
  if (!target) {
    console.log('[highlightCurrentMatch] Target span not found by key, trying path/row/offset matching');
    
    // More comprehensive fallback: find span with matching path, row, and text content
    target = state.search.domMatches.find(span => {
      const spanPath = span.dataset.matchPath;
      const spanRowIndex = span.dataset.rowIndex;
      const spanText = span.textContent;
      
      const pathMatches = spanPath === currentLogicalMatch.path;
      const rowMatches = String(spanRowIndex) === String(currentLogicalMatch.rowIndex);
      const textMatches = spanText.toLowerCase().includes(state.search.query);
      
      console.log(`[highlightCurrentMatch] Checking span:`, {
        spanPath, 
        spanRowIndex, 
        spanText,
        pathMatches,
        rowMatches,
        textMatches,
        expectedPath: currentLogicalMatch.path,
        expectedRow: currentLogicalMatch.rowIndex
      });
      
      return pathMatches && rowMatches && textMatches;
    });
  }
  
  if (!target) {
    console.log('[highlightCurrentMatch] Still no matching span found - trying text-only matching');
    
    // Last resort: find any span in the right location with matching text
    target = state.search.domMatches.find(span => {
      const spanText = span.textContent.toLowerCase();
      const queryMatches = spanText.includes(state.search.query);
      const rowElement = span.closest('tr[data-row-index]');
      const rowMatches = rowElement && String(rowElement.dataset.rowIndex) === String(currentLogicalMatch.rowIndex);
      
      return queryMatches && rowMatches;
    });
  }
  
  if (!target) {
    console.log('[highlightCurrentMatch] No matching span found in DOM');
    return false; 
  }

  target.classList.add('highlight-active');
  console.log('[highlightCurrentMatch] Successfully highlighted match with key:', target.dataset.matchKey);
  return true;
}

function clearHighlights() {
  clearHighlightsInElement(document.body); 
  clearActiveHighlight(); 
}

function clearActiveHighlight() {
  document.querySelectorAll('.highlight-active').forEach(el =>
    el.classList.remove('highlight-active')
  );
}

function deepSearch(root, rowIndex, lowerQuery, termLength) {
  const matches = [];
  const stack = [{ node: root, pathSegments: [] }];

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
        value: valueStr,
        key, 
        offset,
        termLength
      });
      offset = lowerValue.indexOf(lowerQuery, offset + 1);
    }
  }
  return matches;
}

export function updateSearchCounter() {
  const counter = document.getElementById('search-counter');
  if (!counter) return;

  const totalLogicalMatches = state.search.matches.length;
  const visibleDomMatchesCount = state.search.domMatches.length;
  
  // Find current position in visible DOM matches
  let currentIndexInVisibleDOM = 0;
  if (totalLogicalMatches > 0 && state.search.index !== -1) {
    const currentLogicalMatch = state.search.matches[state.search.index];
    const activeSpan = document.querySelector('span.highlight-active');
    
    if (activeSpan && currentLogicalMatch) {
      // Find the position of the active span in the visible DOM matches
      const activeSpanIndex = state.search.domMatches.findIndex(span => 
        span === activeSpan
      );
      
      if (activeSpanIndex !== -1) {
        currentIndexInVisibleDOM = activeSpanIndex + 1;
      } else {
        // If we can't find the active span, but we know we have a current match,
        // show the logical position to avoid showing 0
        currentIndexInVisibleDOM = state.search.index + 1;
      }
    } else if (state.search.index >= 0) {
      // No active span yet, but we have a valid index - show logical position
      currentIndexInVisibleDOM = state.search.index + 1;
    }
  }

  let html = `${currentIndexInVisibleDOM} of ${visibleDomMatchesCount || totalLogicalMatches}`;
  const hiddenCount = totalLogicalMatches - visibleDomMatchesCount;

  if (hiddenCount > 0) {
    html += ` <span style="color: #cc0000; font-size: smaller; margin-left: 8px;">(${hiddenCount} hidden)</span>`;
  } else if (totalLogicalMatches > 0 && visibleDomMatchesCount === 0 && state.search.query) {
    html = `${state.search.index + 1} of ${totalLogicalMatches} <span style="color: #cc0000; font-size: smaller; margin-left: 8px;">(all hidden)</span>`;
  } else if (!state.search.query) {
    html = `0 of 0`;
  }
  
  counter.innerHTML = html;
  console.log('[updateSearchCounter]', html.replace(/<[^>]*>/g, ''));
}

export function applySearchHighlightsToNewContent(root = document.getElementById('data-table')) {
  if (!state.search.query || !root) {
    if(root) clearHighlightsInElement(root); 
    refreshDomMatches();
    updateSearchCounter();
    return;
  }
  
  clearHighlightsInElement(root); 

  const lowerQuery = state.search.query;
  const termLength = state.search.query.length;

  const walker = document.createTreeWalker( root, NodeFilter.SHOW_TEXT, {
      acceptNode: node => (node.parentNode?.nodeName === 'SCRIPT' || node.parentNode?.nodeName === 'STYLE') ? NodeFilter.FILTER_REJECT : 
                         node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
    });

  const textNodesToProcess = [];
  let node;
  while ((node = walker.nextNode())) textNodesToProcess.push(node);

  let highlightsAddedCount = 0;

  textNodesToProcess.forEach(textNode => {
    const originalTextValue = textNode.nodeValue;
    const lowerTextValue = originalTextValue.toLowerCase();
    
    let cellElement = textNode.parentNode;
    let currentPath = '';

    while (cellElement && cellElement !== root && cellElement.nodeType === Node.ELEMENT_NODE) {
        if (cellElement.hasAttribute('data-path')) {
            currentPath = cellElement.getAttribute('data-path'); break;
        }
        if (cellElement.hasAttribute('data-column-path')) {
            currentPath = cellElement.getAttribute('data-column-path'); break;
        }
        if (cellElement.nodeName === 'TD' && cellElement.matches(':first-child') && cellElement.hasAttribute('data-key')) {
            const parentRow = cellElement.closest('tr[data-row-index]');
            const parentPathContainer = parentRow ? parentRow.closest('[data-path]') : null;
            let baseKeyPath = parentPathContainer ? parentPathContainer.dataset.path : '';
            
            const arrayItemContainer = cellElement.closest('.nested-table[data-parent-path]');
            if(arrayItemContainer && cellElement.parentElement.dataset.arrayIndex !== undefined) {
                 baseKeyPath = arrayItemContainer.dataset.parentPath + `[${cellElement.parentElement.dataset.arrayIndex}]`;
            } else {
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
      const logicalMatchForThisOccurrence = state.search.matches.find(m => 
        m.path === currentPath && 
        String(m.rowIndex) === String(currentRowIndex) &&
        m.offset === matchStartIndex &&
        m.value === originalTextValue
      );

      if (logicalMatchForThisOccurrence) {
        span.dataset.matchKey = logicalMatchForThisOccurrence.key;
        span.dataset.matchPath = logicalMatchForThisOccurrence.path; 
        span.dataset.rowIndex = String(logicalMatchForThisOccurrence.rowIndex);
      } else if (currentPath !== '' && currentRowIndex !== null) { 
        span.dataset.matchPath = currentPath;
        span.dataset.rowIndex = String(currentRowIndex);
        span.dataset.matchKey = `${currentRowIndex}|${currentPath}|${matchStartIndex}`;
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
        console.warn("Text node no longer has a parent during highlighting:", textNode);
    }
  });
  
  // Immediate refresh and update
  refreshDomMatches(); 
  updateSearchCounter(); 
  highlightCurrentMatch(); 
}

export function refreshDomMatches() {
  state.search.domMatches = Array.from(
    document.querySelectorAll('span.highlight')
  ).filter(el => el.offsetParent !== null);
  
  console.log('[refreshDomMatches] Found', state.search.domMatches.length, 'visible DOM matches');
}

function expandPathSequentially(pathParts, rowIndexStr, callback, currentDepth = 0) {
  const fullPathToExpand = pathParts.slice(0, currentDepth + 1).reduce((acc, seg) => {
    if (seg.startsWith('[')) return `${acc}${seg}`;
    return acc ? `${acc}.${seg}` : seg;
  }, '');

  console.log(`[expandPathSequentially] Expanding path: ${fullPathToExpand}, depth: ${currentDepth}`);

  if (currentDepth >= pathParts.length) {
    console.log(`[expandPathSequentially] Reached target depth, calling callback`);
    callback();
    return;
  }

  // For the final segment that's just a field name (not array/object), we don't need to expand it
  if (currentDepth === pathParts.length - 1 && !pathParts[currentDepth].includes('[')) {
    console.log(`[expandPathSequentially] Final segment is a field, calling callback`);
    callback();
    return;
  }

  const cell = findCellForPath(fullPathToExpand, rowIndexStr); 

  if (!cell) {
    console.log(`[expandPathSequentially] No cell found for path: ${fullPathToExpand}`);
    callback(); 
    return;
  }

  // Check if this cell is expandable
  const isExpandable = cell.hasAttribute('data-expandable') || cell.querySelector('.toggle-nest');
  if (!isExpandable) {
    console.log(`[expandPathSequentially] Cell not expandable, continuing to next depth`);
    expandPathSequentially(pathParts, rowIndexStr, callback, currentDepth + 1);
    return;
  }

  const toggle = cell.querySelector('.toggle-nest');
  const nestedContent = cell.querySelector('.nested-content');

  if (toggle && nestedContent) {
    const computedDisplay = window.getComputedStyle(nestedContent).display;
    const isExpanded = computedDisplay !== 'none';
    
    if (!isExpanded) {
      console.log(`[expandPathSequentially] Expanding cell at path: ${fullPathToExpand}`);
      
      // Simulate click on the cell instead of the toggle to use our improved click handler
      cell.click();
      
      let checkCount = 0;
      const maxChecks = 40;
      const checkLoaded = () => {
        checkCount++;
        const stillNotExpanded = window.getComputedStyle(nestedContent).display === 'none';
        const contentNotReady = nestedContent.childElementCount === 0;

        if (!stillNotExpanded && !contentNotReady) {
          console.log(`[expandPathSequentially] Cell expanded successfully`);
          // No delay - continue immediately
          expandPathSequentially(pathParts, rowIndexStr, callback, currentDepth + 1);
        } else if (checkCount < maxChecks) {
          setTimeout(checkLoaded, 25); // Faster checking
        } else {
          console.warn(`[expandPathSequentially] Timeout waiting for expansion/content for: ${fullPathToExpand}`);
          expandPathSequentially(pathParts, rowIndexStr, callback, currentDepth + 1); 
        }
      };
      setTimeout(checkLoaded, 25); // Start checking sooner 
      return;
    } else {
      console.log(`[expandPathSequentially] Cell already expanded`);
    }
  }
  expandPathSequentially(pathParts, rowIndexStr, callback, currentDepth + 1);
}

function findCellForPath(path, rowIndex) { 
  console.log(`[findCellForPath] Looking for cell: path="${path}", row="${rowIndex}"`);
  
  // First try to find it in the main table
  let cell = document.querySelector(
    `#data-table tr[data-row-index="${rowIndex}"] td[data-column-path="${path}"]`
  );
  if (cell) {
    console.log(`[findCellForPath] Found cell in main table`);
    return cell;
  }
  
  // Try to find the row first
  const rowElement = document.querySelector(`#data-table tr[data-row-index="${rowIndex}"]`);
  if (!rowElement) {
    console.log(`[findCellForPath] Row not found: ${rowIndex}`);
    return null;
  }

  // Look for cells with matching data-path attribute (including in nested tables)
  const allCells = rowElement.querySelectorAll('td[data-path], td[data-column-path]');
  for (let c of allCells) {
    if (c.dataset.path === path || c.dataset.columnPath === path) {
      console.log(`[findCellForPath] Found cell with matching path`);
      return c;
    }
  }

  // For nested paths, we might need to look in already-expanded nested tables
  // Try to find parent paths and look within them
  const pathParts = splitJsonPath(path);
  if (pathParts.length > 1) {
    // Build parent path
    const parentPath = pathParts.slice(0, -1).reduce((acc, seg) => {
      if (seg.startsWith('[')) return `${acc}${seg}`;
      return acc ? `${acc}.${seg}` : seg;
    }, '');
    
    console.log(`[findCellForPath] Trying parent path: ${parentPath}`);
    
    // Find the parent cell
    const parentCell = findCellForPath(parentPath, rowIndex);
    if (parentCell) {
      // Look for the nested table within this parent
      const nestedContent = parentCell.querySelector('.nested-content');
      if (nestedContent) {
        // Look for cells within the nested content
        const nestedCells = nestedContent.querySelectorAll('td[data-path]');
        for (let nc of nestedCells) {
          if (nc.dataset.path === path) {
            console.log(`[findCellForPath] Found cell in nested content`);
            return nc;
          }
        }
      }
    }
  }
  
  console.log(`[findCellForPath] Cell not found`);
  return null;
}