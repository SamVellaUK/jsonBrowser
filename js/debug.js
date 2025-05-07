/* ────────────────────────────────────────────
 *  DEBUG HELPER
 *  Usage examples:
 *    debug();                                // quick dump -> default sink(s)
 *    debug(DebugLevel.PANEL, {foo: 1});      // force to panel only
 *    setGlobalDebugLevel(DebugLevel.NONE);   // silence everything
 * ────────────────────────────────────────────
 */

export const DebugLevel = Object.freeze({
  NONE:    0,
  CONSOLE: 1,
  PANEL:   2,
  BOTH:    3,
});

let globalLevel = DebugLevel.CONSOLE;   // default sink

export function setGlobalDebugLevel(level) {
  globalLevel = level;
}

/**
 * Escapes HTML so code snippets render as text.
 */
function escapeHtml(str) {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/**
 * Serialises the variadic args into a single string:
 * - primitives → String()
 * - objects    → JSON.stringify pretty
 */
function serialiseArgs(args) {
  return args
    .map(a => {
      if (typeof a === 'string')   return a;
      if (typeof a === 'number' ||
          typeof a === 'boolean')  return String(a);
      if (a instanceof Element)    return escapeHtml(a.outerHTML);
      return '```json\n' + escapeHtml(JSON.stringify(a, null, 2)) + '\n```';
    })
    .join(' ');
}

/**
 * Ensures the floating debug panel exists.
 */
function ensurePanel() {
  if (document.getElementById('debug-panel')) return;
  const div = document.createElement('div');
  div.id = 'debug-panel';
  document.body.appendChild(div);
}

/**
 * Core debug function.
 * @param {DebugLevel} localLevel  optional – override global sink
 * @param  {...any}    args        anything printable
 */
export function debug(localLevel, ...args) {
  // allow omitting localLevel
  if (typeof localLevel !== 'number') {
    args.unshift(localLevel);
    localLevel = DebugLevel.NONE;
  }

  const effective =
    localLevel !== DebugLevel.NONE ? localLevel : globalLevel;

  if (effective === DebugLevel.NONE) return;

  const message = serialiseArgs(args);

  if (effective & DebugLevel.CONSOLE) {
    // strip code‑block fences for console readability
    console.log(message.replace(/```json|```/g, ''));
  }

  if (effective & DebugLevel.PANEL) {
    ensurePanel();
    const pre = document.createElement('pre');
    pre.innerHTML = message;  // already escaped / fenced
    document.getElementById('debug-panel').appendChild(pre);
    // keep newest on screen
    pre.scrollIntoView({ block: 'end' });
  }
}

/* Helper to clear the panel */
export function clearDebugPanel() {
  const panel = document.getElementById('debug-panel');
  if (panel) panel.textContent = '';
}
