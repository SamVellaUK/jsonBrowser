import { state } from './state.js';
import { expandToPath } from './renderer.js';
import { splitJsonPath, parseArrayPath  } from './PathUtils.js';

export function performSearch(query) {
  clearHighlights();
  state.search.matches = [];
  state.search.domMatches = [];
  state.search.index = -1;
  state.search.query = '';

  const localLevel = 0;

  if (!query || !query.trim()) return;

  const lower = query.toLowerCase();
  state.search.query = lower;

  // Step 1: Deep‑search JSON and collect results immutably
  const allMatches = [];
  state.data.forEach((row, rowIndex) => {
    allMatches.push(...deepSearch(row, rowIndex, lower));   // NEW
  });
  state.search.matches = allMatches;

  console.log('[Search] Total matches in JSON:', state.search.matches.length);

  // Step 2: Build map of all matches by data path
  const matchPathMap = new Map(); // path -> array of matches
  state.search.matches.forEach(m => {
    if (!matchPathMap.has(m.path)) matchPathMap.set(m.path, []);
    matchPathMap.get(m.path).push(m);
  });

  // ── Step 3: walk the current DOM and inject <span class="highlight"> ─
  const candidates = document.querySelectorAll('[data-path]');

  candidates.forEach(el => {
    const path = el.getAttribute('data-path');
    if (!path || !matchPathMap.has(path)) return;

    const text = el.textContent;
    if (!text) return;

    // Find the row index from parent elements
    let rowElement = el;
    let rowIndex = null;
    while (rowElement && rowIndex === null) {
      rowIndex = rowElement.getAttribute('data-row-index');
      rowElement = rowElement.parentElement;
    }
    
    if (rowIndex === null) {
      console.log('[performSearch] No row index found for element', { path });
      return; // Skip this element if we can't find its row
    }

    // Pull only the matches whose value exactly equals this node's text
    const logicalMatches = matchPathMap.get(path).filter(m => 
      m.value === text && String(m.rowIndex) === String(rowIndex)
    );
    
    if (logicalMatches.length === 0) return;

    // Merge and dedupe offset arrays, then sort ASC
    const positions = [...new Set(
      logicalMatches.flatMap(m => m.offsets)
    )].sort((a, b) => a - b);

    if (positions.length === 0) return;

    // Build a fragment with highlighted spans
    const frag = document.createDocumentFragment();
    let cursor = 0;

    positions.forEach(pos => {
      // Non‑matching slice before the hit
      if (cursor < pos) {
        frag.appendChild(document.createTextNode(text.slice(cursor, pos)));
      }

      // Highlighted hit
      const span = document.createElement('span');
      span.className = 'highlight';
      span.dataset.matchPath = path;  // Add path for lookup
      
      // Use the key directly from the match object for consistency
      const match = logicalMatches[0];
      span.dataset.matchKey = match.key;
      
      // Store rowIndex for debugging/fallback
      span.dataset.rowIndex = rowIndex;
      
      span.textContent = text.substr(pos, query.length);
      frag.appendChild(span);

      cursor = pos + query.length;
    });

    // Trailing text after the last hit
    if (cursor < text.length) {
      frag.appendChild(document.createTextNode(text.slice(cursor)));
    }

    // Swap the node's content
    el.textContent = '';
    el.appendChild(frag);
  });

  // ✅ After all DOM updates, capture final visible highlight spans
  refreshDomMatches();
  
  state.search.index = state.search.domMatches.length > 0 ? 0 : -1;
  updateSearchCounter();
  highlightCurrentMatch();
}

export function navigateSearch(direction) {
  const matches = state.search.matches;
  const total = matches.length;

  if (total === 0) {
    console.log('[navigateSearch] No matches to navigate');
    return;
  }

  /* ── update logical index ───────────────────────────────────── */
  const oldIndex = state.search.index;
  if (direction === 'next') {
    state.search.index = (state.search.index + 1) % total;
  } else if (direction === 'prev') {
    state.search.index = (state.search.index - 1 + total) % total;
  }

  const currentMatch = matches[state.search.index];
  const { path, rowIndex, key } = currentMatch;

  /* ── is the corresponding span already visible? ────────────── */
  refreshDomMatches();

  // Try to find the exact match span first
  let visibleSpan = state.search.domMatches.find(
    span => span.dataset.matchKey === key
  );

  if (visibleSpan) {
    console.log('[navigateSearch] Span is visible — highlight');
    highlightCurrentMatch();
    updateSearchCounter();
    visibleSpan.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }

  /* ── not visible → expand tree, then retry highlight ───────── */
  console.log('[navigateSearch] Span hidden — expanding...');
  
  // New: Split path and expand each segment sequentially
  const pathParts = splitJsonPath(path);
  if (pathParts.length > 0) {
    expandPathSequentially(pathParts, rowIndex, () => {
      refreshDomMatches();
      if (highlightCurrentMatch()) {
        console.log('[navigateSearch] Successfully expanded and highlighted match');
      } else {
        console.log('[navigateSearch] Failed to highlight after expansion');
        // Roll back to previous index if we couldn't find the match
        if (oldIndex !== -1) {
          state.search.index = oldIndex;
          updateSearchCounter();
        }
      }
    });
  }
}

export function highlightCurrentMatch() {
  // clear any previous "current" box
  document.querySelectorAll('span.highlight-active')
    .forEach(el => el.classList.remove('highlight-active'));

  const currentMatch = state.search.matches[state.search.index];
  if (!currentMatch) return false;

  refreshDomMatches();   // make sure the visible list is current

  const { key, rowIndex, path } = currentMatch;
  
  // Try multiple approaches to find the right highlight span
  let target;
  
  // Method 1: Try matching by the exact key from the match
  target = state.search.domMatches.find(span => span.dataset.matchKey === key);
  
  // Method 2: If that fails, try constructing the key
  if (!target) {
    target = state.search.domMatches.find(
      span => span.dataset.matchKey === `${rowIndex}|${path}`
    );
  }
  
  // Method 3: Last resort - try matching by path alone
  if (!target) {
    target = state.search.domMatches.find(
      span => span.dataset.matchPath === path
    );
  }

  if (!target) {
    console.log('[highlightCurrentMatch] No matching span found', { key, rowIndex, path });
    return false;    // still hidden (expansion hasn't finished yet)
  }

  target.classList.add('highlight-active');
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return true;
}

function clearHighlights() {
  document.querySelectorAll('.highlight, .highlight-active').forEach(span => {
    const parent = span.parentNode;
    if (!parent) return;
    const text = document.createTextNode(span.textContent);
    parent.replaceChild(text, span);
  });

  state.search.domMatches = [];
  state.search.query = '';
  clearActiveHighlight();
}

function clearActiveHighlight() {
  document.querySelectorAll('.highlight-active').forEach(el =>
    el.classList.remove('highlight-active')
  );
}

function deepSearch(root, rowIndex, lowerQuery) {
  const matches = [];
  const stack = [{ node: root, path: [] }];

  while (stack.length) {
    const { node, path } = stack.pop();
    if (node == null) continue;

    if (typeof node === 'object') {
      if (Array.isArray(node)) {
        for (let i = node.length - 1; i >= 0; i--) {
          stack.push({ node: node[i], path: [...path, i] });
        }
      } else {
        const entries = Object.entries(node);
        for (let k = entries.length - 1; k >= 0; k--) {
          const [key, val] = entries[k];
          stack.push({ node: val, path: [...path, key] });
        }
      }
      continue;
    }

    const valueStr = String(node);
    const lowerValue = valueStr.toLowerCase();
    if (!lowerValue.includes(lowerQuery)) continue;

    // Collect every start‑offset where the term appears
    const offsets = [];
    let idx = lowerValue.indexOf(lowerQuery);
    while (idx !== -1) {
      offsets.push(idx);
      idx = lowerValue.indexOf(lowerQuery, idx + lowerQuery.length);
    }

    if (offsets.length === 0) continue; // should never fire but be safe

    const pathStr = path.reduce((acc, seg) => 
      typeof seg === 'number' ? `${acc}[${seg}]` : 
      acc ? `${acc}.${seg}` : seg, 
    '');

    const key = `${rowIndex}|${pathStr}`;     // unique across rows
    matches.push({ rowIndex, path: pathStr, value: valueStr, key, offsets });
  }
  return matches;
}

export function updateSearchCounter() {
  const counter = document.getElementById('search-counter');
  if (!counter) return;

  const total = state.search.matches.length;
  const visible = state.search.domMatches.length;
  const current = visible > 0 ? state.search.index + 1 : 0;

  let html = `${current} of ${visible}`;
  const hidden = total - visible;

  if (hidden > 0) {
    html += ` <span style="color: red; font-size: 10px; margin-left: 8px;">${hidden} hidden</span>`;
  }

  counter.innerHTML = html;
}

export function applySearchHighlightsToNewContent(root = document.getElementById('data-table')) {
  if (!state.search?.matches?.length || !root) return;
  
  const lowerQuery = state.search.query;
  if (!lowerQuery) return;

  console.log('[applySearchHighlightsToNewContent] Adding highlights to new content');

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: node => node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
    }
  );

  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  let highlightsAdded = 0;

  textNodes.forEach(textNode => {
    const text = textNode.nodeValue;
    const lowerText = text.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    
    if (index !== -1) {
      // Find the closest parent with data-path attribute
      let parentEl = textNode.parentNode;
      let path = '';
      while (parentEl && !path) {
        path = parentEl.getAttribute('data-path');
        if (!path) parentEl = parentEl.parentNode;
      }
      
      if (!path) return; // No path found, skip highlighting
      
      // Find the closest parent with data-row-index attribute
      let rowEl = textNode.parentNode;
      let rowIndex = null;
      while (rowEl && rowIndex === null) {
        rowIndex = rowEl.getAttribute('data-row-index');
        if (rowIndex === null) rowEl = rowEl.parentNode;
      }
      
      if (rowIndex === null) return; // No row index found, skip highlighting
      
      // Look for a matching logical result in our search matches
      const matchingLogical = state.search.matches.find(m => 
        m.path === path && 
        String(m.rowIndex) === String(rowIndex) &&
        m.value === text
      );
      
      const matchKey = matchingLogical ? matchingLogical.key : `${rowIndex}|${path}`;
      
      const before = text.slice(0, index);
      const matchText = text.slice(index, index + lowerQuery.length);
      const after = text.slice(index + lowerQuery.length);

      const span = document.createElement('span');
      span.className = 'highlight';
      span.textContent = matchText;
      span.dataset.matchPath = path;
      span.dataset.rowIndex = rowIndex;
      span.dataset.matchKey = matchKey;

      const frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));
      frag.appendChild(span);
      if (after) frag.appendChild(document.createTextNode(after));

      textNode.parentNode.replaceChild(frag, textNode);
      highlightsAdded++;
    }
  });
  
  // Refresh the DOM matches after adding new highlights
  if (highlightsAdded > 0) {
    console.log(`[applySearchHighlightsToNewContent] Added ${highlightsAdded} highlights`);
    
    setTimeout(() => {
      refreshDomMatches();
      updateSearchCounter();
      // Try to highlight the current match after adding new ones
      highlightCurrentMatch();
    }, 0);
  }
}

export function refreshDomMatches() {
  state.search.domMatches = Array.from(
    document.querySelectorAll('span.highlight')
  ).filter(el => el.offsetParent !== null);
}

function expandPathSequentially(pathParts, rowIndex, callback, currentDepth = 0) {
  console.log(`Expanding path: ${pathParts.join('.')} at depth ${currentDepth}`);
  if (currentDepth >= pathParts.length) {
      callback();
      return;
  }

  const currentPath = pathParts.slice(0, currentDepth + 1).join('.').replace('.[', '['); // Handle array syntax;

  console.log(`Attempting to expand: ${currentPath}`);

  const cell = findCellForPath(currentPath, rowIndex);
  if (!cell) {
      console.warn(`Cell not found for: ${currentPath}`);
      callback();
      return;
  }

  const toggle = cell.querySelector('.toggle-nest');
  const nestedContent = cell.querySelector('.nested-content');

  if (toggle && nestedContent) {
      const isExpanded = nestedContent.style.display === 'block';
      
      if (!isExpanded) {
          console.log(`Expanding: ${currentPath}`);
          toggle.click();
          
          // Wait for content to load
          const checkLoaded = () => {
              if (nestedContent.childElementCount > 0 || nestedContent.style.display === 'block') {
                  expandPathSequentially(pathParts, rowIndex, callback, currentDepth + 1);
              } else {
                  setTimeout(checkLoaded, 50);
              }
          };
          setTimeout(checkLoaded, 50);
          return;
      }
  }

  // Proceed to next segment
  expandPathSequentially(pathParts, rowIndex, callback, currentDepth + 1);
}

// Helper function to expand parent arrays
function expandParentArray(parentPath, arrayIndex, rowIndex, callback) {
  console.log(`Expanding parent array: ${parentPath}[${arrayIndex}]`);
  
  const parentCell = findCellForPath(parentPath, rowIndex);
  if (!parentCell) {
    console.warn(`Parent cell not found for: ${parentPath}`);
    callback();
    return;
  }

  const parentToggle = parentCell.querySelector('.toggle-nest');
  const parentNested = parentCell.querySelector('.nested-content');

  if (parentToggle && parentNested) {
    const isParentExpanded = parentNested.style.display === 'block';
    
    if (!isParentExpanded) {
      parentToggle.click();
      
      // Wait for parent to expand and content to render
      const checkParentLoaded = () => {
        if (parentNested.childElementCount > 0) {
          // Now find and expand the specific array item
          const arrayItemCell = findArrayItemCell(parentNested, arrayIndex);
          if (arrayItemCell) {
            const itemToggle = arrayItemCell.querySelector('.toggle-nest');
            const itemNested = arrayItemCell.querySelector('.nested-content');
            
            if (itemToggle && itemNested && itemNested.style.display !== 'block') {
              itemToggle.click();
              
              // Wait for item to expand
              setTimeout(() => {
                if (itemNested.style.display === 'block') {
                  callback();
                }
              }, 50);
            } else {
              callback();
            }
          } else {
            callback();
          }
        } else {
          setTimeout(checkParentLoaded, 50);
        }
      };
      setTimeout(checkParentLoaded, 50);
      return;
    }
  }
  
  // Parent already expanded, proceed directly to callback
  callback();
}

// Helper to find specific array item cell
function findArrayItemCell(parentNested, index) {
  const nestedTable = parentNested.querySelector('.nested-table');
  if (!nestedTable) return null;
  
  const rows = nestedTable.querySelectorAll('tr');
  if (rows.length > index) {
    return rows[index].querySelector('td:nth-child(2)');
  }
  return null;
}

// New helper function to find a cell by path and row index
function findCellForPath(path, rowIndex) {
  // First try exact match in main table
  let cell = document.querySelector(
      `#data-table tr[data-row-index="${rowIndex}"] td[data-column-path="${path}"]`
  );
  
  // If not found, try in nested tables with proper array syntax
  if (!cell) {
      // Convert path to selector-friendly format
      const selectorPath = path.replace(/\[(\d+)\]/g, '\\[$1\\]');
      cell = document.querySelector(
          `[data-row-index="${rowIndex}"] [data-path="${selectorPath}"], 
           [data-row-index="${rowIndex}"] [data-column-path="${selectorPath}"]`
      );
  }
  
  // Special handling for array items
  if (!cell && path.includes('[')) {
      const arrayMatch = path.match(/^(.*)\[(\d+)\]$/);
      if (arrayMatch) {
          const [_, basePath, index] = arrayMatch;
          const parentCell = findCellForPath(basePath, rowIndex);
          if (parentCell) {
              const nestedTable = parentCell.querySelector('.nested-content .nested-table');
              if (nestedTable) {
                  const rows = nestedTable.querySelectorAll('tr');
                  if (rows[index]) {
                      cell = rows[index].querySelector('td:nth-child(2)');
                  }
              }
          }
      }
  }
  
  return cell;
}