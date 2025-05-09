/**
 * globalToggles.js
 *
 * • toggleAllNested(expand)    – Expand / collapse every row *and*
 *                                force‑render still‑empty nested tables.
 * • toggleJsonPaths()          – Show / hide <div class="json‑path">.
 */

import * as DomUtils from './DomUtils.js';                     // :contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1}
import { state } from './state.js';
import { renderNestedTable } from './TableRenderer.js';
import { resolvePath } from './PathUtils.js';
import {
  applySearchHighlightsToNewContent,
  refreshDomMatches,
  updateSearchCounter
} from './search.js';                                          // :contentReference[oaicite:2]{index=2}:contentReference[oaicite:3]{index=3}

/* ────────────────────────────────────────────────────────── */
export function toggleAllNested(expand = true) {
  const scope = document.getElementById('table-container');
  if (!scope) return;

  /* -------- Collapse‑all: single pass is enough -------- */
  if (!expand) {
    scope.querySelectorAll('.toggle-nest').forEach(toggle => {
      const nested = toggle.parentElement?.querySelector(':scope > .nested-content');
      if (nested) DomUtils.setToggleState(toggle, nested, false);
    });
    refreshDomMatches();
    updateSearchCounter();
    return;
  }

  /* -------- Full‑depth expansion --------
     Breadth‑first so every newly rendered level is revisited until
     no more collapsed descendants remain.
  ------------------------------------------------------------- */
  const visited = new WeakSet();
  let queue = Array.from(scope.querySelectorAll('.toggle-nest'));

  while (queue.length) {
    const next = [];
    queue.forEach(toggle => {
      if (visited.has(toggle)) return;
      visited.add(toggle);

      const nested = toggle.parentElement?.querySelector(':scope > .nested-content');
      if (!nested) return;

      /* Open the current block */
      DomUtils.setToggleState(toggle, nested, true);

      /* Lazily render rows never opened before */
      if (nested.childElementCount === 0) {
        const parentPath = nested.dataset.parentPath;
        const idxAttr    = nested.dataset.rowIndex;
        if (parentPath == null || idxAttr == null) return;

        const rowIdx = parseInt(idxAttr, 10);
        const obj    = resolvePath(state.data[rowIdx], parentPath);
        if (obj === undefined) return;

        const tbl = renderNestedTable(obj, parentPath, rowIdx);
        nested.appendChild(tbl);
        applySearchHighlightsToNewContent(nested);
      }

      /* Queue any deeper toggles we just exposed */
      nested.querySelectorAll('.toggle-nest').forEach(t => next.push(t));
    });
    queue = next;   // dive one level deeper
  }

  /* ── Search bookkeeping ─────────────────────────────────────────── */
  refreshDomMatches();
  updateSearchCounter();
}

/* ────────────────────────────────────────────────────────── */

export function toggleJsonPaths() {
  state.showJsonPaths = !state.showJsonPaths;  // flip flag
  applyJsonPathVisibility();                   // add / remove class

  // visual cue on the button
  document.getElementById('show-json-paths')
        ?.classList.toggle('active', state.showJsonPaths);
}
