import { state } from './state.js';
import { expandToPath } from './renderer.js';

export function performSearch(query) {
  clearHighlights();
  state.search.matches = [];
  state.search.domMatches = [];
  state.search.index = -1;

  if (!query || !query.trim()) return;

  const lower = query.toLowerCase();

  // Step 1: Deep‑search JSON (collect immutably)
  const allMatches = [];
  state.data.forEach((row, rowIndex) => {
    allMatches.push(...deepSearch(row, rowIndex, lower));
  });
  state.search.matches = allMatches;
  

  console.log('[Search] Total matches in JSON:', state.search.matches.length);

  // Step 2: Build map of all matches by data path
  const matchPathMap = new Map(); // path -> array of matches
  state.search.matches.forEach(m => {
    if (!matchPathMap.has(m.path)) matchPathMap.set(m.path, []);
    matchPathMap.get(m.path).push(m);
  });

  // Step 3: Highlight DOM where data-path exists AND text matches
  const candidates = document.querySelectorAll('[data-path]');
  candidates.forEach(el => {
    const path = el.getAttribute('data-path');
    if (!path || !matchPathMap.has(path)) return;

    const text = el.textContent;
    if (!text || !text.toLowerCase().includes(lower)) return;

    const logicalMatches = matchPathMap.get(path);
    const hasValidMatch = logicalMatches.some(m =>
      text.toLowerCase().includes(m.value.toLowerCase())
    );
    if (!hasValidMatch) return;

    // Highlight all occurrences of the query in this element
    const original = text;
    const lowerOriginal = original.toLowerCase();
    let currentIndex = 0;
    const frag = document.createDocumentFragment();
    const spansToAdd = [];

    while (true) {
      const matchIndex = lowerOriginal.indexOf(lower, currentIndex);
      if (matchIndex === -1) break;

      const before = original.slice(currentIndex, matchIndex);
      const matchText = original.slice(matchIndex, matchIndex + query.length);
      const afterIndex = matchIndex + query.length;

      if (before) frag.appendChild(document.createTextNode(before));

      const span = document.createElement('span');
      span.className = 'highlight';
      span.textContent = matchText;
      span.dataset.matchPath = path; // Add the match path to the span
      frag.appendChild(span);
      spansToAdd.push(span);

      currentIndex = afterIndex;
    }

    if (currentIndex < original.length) {
      frag.appendChild(document.createTextNode(original.slice(currentIndex)));
    }

    if (spansToAdd.length > 0) {
      el.textContent = '';
      el.appendChild(frag);
    }
  });

  // ✅ After all DOM updates, capture final visible highlight spans
  state.search.domMatches = Array.from(document.querySelectorAll('span.highlight'))
    .filter(el => el.offsetParent !== null);  // only visible ones

  console.log('[Search] Visible DOM matches:', state.search.domMatches.length);

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

  // Step 1: Update index in global match list
  if (direction === 'next') {
    state.search.index = (state.search.index + 1) % total;
  } else if (direction === 'prev') {
    state.search.index = (state.search.index - 1 + total) % total;
  }

  const match = matches[state.search.index];
  const { path, rowIndex } = match;

  console.log(`[navigateSearch] Moving to index ${state.search.index}: path=${path}, row=${rowIndex}`);

  // Step 2: Check if this match is visible in DOM
  const visibleSpan = Array.from(document.querySelectorAll('span.highlight'))
  .find(span =>
    span.dataset.matchPath === path &&
    span.closest('tr')?.dataset.rowIndex === String(rowIndex) &&
    span.offsetParent !== null
  );

  if (visibleSpan) {
    // ✅ Already visible, highlight it
    console.log('[navigateSearch] Match is visible — highlighting');
    state.search.domMatches = Array.from(document.querySelectorAll('span.highlight'))
      .filter(el => el.offsetParent !== null);
    highlightCurrentMatch();
    updateSearchCounter();
  } else {
    // ❌ Hidden — expand to reveal it
    console.log('[navigateSearch] Match is hidden — expanding...');
    expandToPath(path, rowIndex);

    // After expansion, retry highlight
    setTimeout(() => {
      // Refresh all visible highlights
      state.search.domMatches = Array.from(document.querySelectorAll('span.highlight'))
        .filter(el => el.offsetParent !== null);

      // Try to find the newly visible one
      const matchSpan = state.search.domMatches.find(
        span => span.dataset.matchPath === path
      );

      if (matchSpan) {
        console.log('[navigateSearch] Highlighting now-visible match');
        highlightCurrentMatch();
      } else {
        console.warn('[navigateSearch] Could not find visible span even after expansion');
      }

      updateSearchCounter();
    }, 200);
  }
}

function highlightCurrentMatch() {
  clearActiveHighlight();

  const span = state.search.domMatches[state.search.index];
  if (span) {
    span.classList.add('highlight-active');
    span.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function clearHighlights() {
  document.querySelectorAll('.highlight, .highlight-active').forEach(span => {
    const parent = span.parentNode;
    if (!parent) return;
    const text = document.createTextNode(span.textContent);
    parent.replaceChild(text, span);
  });

  // ✅ Add this line:
  state.search.domMatches = [];

  state.search.domMatches = [];
  clearActiveHighlight();
}

function clearActiveHighlight() {
  document.querySelectorAll('.highlight-active').forEach(el =>
    el.classList.remove('highlight-active')
  );
}

function deepSearch(root, rowIndex, lowerQuery) {
  const matches = [];
  const stack = [{ node: root, path: [] }]; // path is an array of segments
  
  while (stack.length) {
    const { node, path } = stack.pop();
    if (node == null) continue;
      if (typeof node === 'object') {
        if (Array.isArray(node)) {
        node.forEach((item, i) => stack.push({ node: item, path: [...path, i] }));
      } else {
        Object.entries(node).forEach(([k, v]) =>
          stack.push({ node: v, path: [...path, k] })
        );
      }
      continue;
    }
  
    const valueStr = String(node);
    if (!valueStr.toLowerCase().includes(lowerQuery)) continue;
  
    // Build path string exactly once per hit
    const pathStr = path.reduce((acc, seg) =>
      typeof seg === 'number' ? `${acc}[${seg}]` : acc ? `${acc}.${seg}` : seg,
      ''
    );
  
    matches.push({ rowIndex, path: pathStr, value: valueStr });
  }
  
  return matches;
}

function updateSearchCounter() {
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

  // Get search query from the first match
  const query = state.search.matches[0]?.value || '';
  if (!query) return;
  
  const lowerQuery = query.toLowerCase();

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
      
      const before = text.slice(0, index);
      const matchText = text.slice(index, index + lowerQuery.length);
      const after = text.slice(index + lowerQuery.length);

      const span = document.createElement('span');
      span.className = 'highlight';
      span.textContent = matchText;
      span.dataset.matchPath = path;

      const frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));
      frag.appendChild(span);
      if (after) frag.appendChild(document.createTextNode(after));

      textNode.parentNode.replaceChild(frag, textNode);
      
      // Refresh the DOM matches after adding new highlights
      setTimeout(() => {
        state.search.domMatches = Array.from(document.querySelectorAll('span.highlight'))
          .filter(el => el.offsetParent !== null);
        updateSearchCounter();
      }, 0);
    }
  });
}